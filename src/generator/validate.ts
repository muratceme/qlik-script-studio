/**
 * Structural validation. Any error here blocks script generation.
 */
import type { FieldPair, Project } from '@/model/types';
import { isSourceTable } from '@/model/types';
import { buildContext, JOIN_TYPES, KEEP_TYPES, type Context } from './context';
import { error, type Diagnostic } from './diagnostics';
import { orderSources, orderTransform } from './order';
import { MERGE_TYPES } from './plan';
import { isValidName } from './quote';
import { exprHasEmptyRaw, targetRefs } from './refs';

function checkName(out: Diagnostic[], name: string, what: string, refs: Diagnostic['refs']): void {
  if (name.trim().length === 0) out.push(error('EMPTY_NAME', { what }, refs));
  else if (!isValidName(name)) out.push(error('INVALID_NAME', { what, name }, refs));
}

export function validateModel(project: Project): Diagnostic[] {
  return validateWithContext(buildContext(project));
}

export function validateWithContext(ctx: Context): Diagnostic[] {
  const { project } = ctx;
  const out: Diagnostic[] = [];

  if (project.sources.length === 0) {
    out.push(error('EMPTY_PROJECT'));
    return out;
  }

  // Table names must be unique across sources, targets, mapping tables and the calendar.
  const seenTables = new Map<string, string>();
  const allNamed: { id: string; name: string }[] = [
    ...project.sources,
    ...project.targets,
    ...project.links
      .filter((l) => l.type === 'applyMap' && l.applyMap)
      .map((l) => ({ id: l.id, name: l.applyMap!.mapName })),
  ];
  if (project.calendar?.enabled) allNamed.push({ id: 'calendar', name: project.calendar.tableName });
  for (const t of allNamed) {
    checkName(out, t.name, 'table', { tableIds: [t.id] });
    const key = t.name.toLowerCase();
    const other = seenTables.get(key);
    if (other !== undefined)
      out.push(error('DUPLICATE_TABLE_NAME', { name: t.name }, { tableIds: [other, t.id] }));
    else seenTables.set(key, t.id);
  }

  for (const source of project.sources) {
    const refs = { tableIds: [source.id] };
    switch (source.kind) {
      case 'qvd':
      case 'excel':
      case 'csv':
        if (!source.path.trim()) out.push(error('SOURCE_PATH_MISSING', { table: source.name }, refs));
        if (source.kind === 'excel' && !source.excel?.sheet.trim())
          out.push(error('EXCEL_SHEET_MISSING', { table: source.name }, refs));
        break;
      case 'sql':
        if (!source.connectionId || !ctx.connections.has(source.connectionId))
          out.push(error('SOURCE_CONNECTION_MISSING', { table: source.name }, refs));
        if (!source.sql?.query.trim()) out.push(error('SQL_QUERY_MISSING', { table: source.name }, refs));
        break;
      case 'inline':
        if (!source.inline || source.inline.rows.length < 1 || (source.inline.rows[0]?.length ?? 0) === 0)
          out.push(error('INLINE_EMPTY', { table: source.name }, refs));
        break;
    }
    const seenFields = new Map<string, string>();
    for (const field of source.fields) {
      const fieldRefs = { tableIds: [source.id], fieldIds: [field.id] };
      checkName(out, field.name, 'field', fieldRefs);
      if (field.alias !== null) checkName(out, field.alias, 'alias', fieldRefs);
      if (field.role === 'ignore') continue;
      const outName = ctx.outName({ tableId: source.id, fieldId: field.id }).toLowerCase();
      const other = seenFields.get(outName);
      if (other !== undefined)
        out.push(
          error(
            'DUPLICATE_FIELD_NAME',
            { table: source.name, name: field.alias ?? field.name },
            { tableIds: [source.id], fieldIds: [other, field.id] },
          ),
        );
      else seenFields.set(outName, field.id);
    }
  }

  for (const target of project.targets) {
    const refs = { tableIds: [target.id], targetIds: [target.id] };
    if (!target.primarySourceId || !ctx.tables.has(target.primarySourceId)) {
      out.push(error('TARGET_PRIMARY_MISSING', { table: target.name }, refs));
    }
    if (target.columns.length === 0) out.push(error('TARGET_NO_COLUMNS', { table: target.name }, refs));
    const seenCols = new Map<string, string>();
    for (const column of target.columns) {
      const name = ctx.columnName(column);
      checkName(out, name, 'column', { tableIds: [target.id], fieldIds: [column.id] });
      const key = name.toLowerCase();
      const other = seenCols.get(key);
      if (other !== undefined)
        out.push(
          error(
            'DUPLICATE_FIELD_NAME',
            { table: target.name, name },
            { tableIds: [target.id], fieldIds: [other, column.id] },
          ),
        );
      else seenCols.set(key, column.id);
      if (column.kind === 'calculated' && exprHasEmptyRaw(column.expr))
        out.push(
          error(
            'RAW_EXPRESSION_EMPTY',
            { table: target.name, column: name },
            { tableIds: [target.id], fieldIds: [column.id] },
          ),
        );
    }

    // Every referenced field must exist and be reachable from the primary table.
    const primary = target.primarySourceId;
    const reachable = new Set<string>();
    if (primary) {
      reachable.add(primary);
      for (const l of project.links) {
        if (l.leftTableId === primary && MERGE_TYPES.has(l.type)) reachable.add(l.rightTableId);
      }
    }
    const reported = new Set<string>();
    for (const ref of targetRefs(target)) {
      const key = `${ref.tableId}:${ref.fieldId}`;
      if (reported.has(key)) continue;
      const field = ctx.field(ref);
      const column = ctx.columns.get(ref.fieldId);
      const exists = field !== undefined || (column !== undefined && column.tableId === ref.tableId);
      if (!exists) {
        reported.add(key);
        out.push(
          error(
            'FIELD_NOT_FOUND',
            { table: target.name },
            { tableIds: [target.id], fieldIds: [ref.fieldId] },
          ),
        );
        continue;
      }
      if (field && field.role === 'ignore') {
        reported.add(key);
        out.push(
          error(
            'FIELD_IGNORED',
            { table: target.name, field: field.name, source: ctx.tableName(ref.tableId) },
            { tableIds: [target.id, ref.tableId], fieldIds: [ref.fieldId] },
            [{ kind: 'setRole', tableId: ref.tableId, fieldId: ref.fieldId, role: 'dimension' }],
          ),
        );
      }
      if (primary && !reachable.has(ref.tableId)) {
        reported.add(key);
        const pairs = commonKeyPairs(ctx, primary, ref.tableId);
        out.push(
          error(
            'FIELD_NOT_REACHABLE',
            {
              table: target.name,
              field: ctx.outName(ref),
              source: ctx.tableName(ref.tableId),
              primary: ctx.tableName(primary),
            },
            { tableIds: [target.id, ref.tableId], fieldIds: [ref.fieldId] },
            pairs.length > 0
              ? [
                  {
                    kind: 'createLink',
                    type: 'leftJoin',
                    leftTableId: primary,
                    rightTableId: ref.tableId,
                    pairs,
                  },
                ]
              : [],
          ),
        );
      }
    }
  }

  for (const link of project.links) {
    const refs = { linkIds: [link.id], tableIds: [link.leftTableId, link.rightTableId] };
    const left = ctx.table(link.leftTableId);
    const right = ctx.table(link.rightTableId);
    if (!left || !right) {
      out.push(error('LINK_TABLE_MISSING', {}, refs));
      continue;
    }
    if (link.leftTableId === link.rightTableId) {
      out.push(error('LINK_SELF', { table: left.name }, refs));
      continue;
    }
    const needsPairs = JOIN_TYPES.has(link.type) || KEEP_TYPES.has(link.type) || link.type === 'association';
    if (needsPairs && link.pairs.length === 0) {
      out.push(error('LINK_NO_PAIRS', { left: left.name, right: right.name }, refs));
    }
    for (const pair of link.pairs) {
      const l = ctx.outName({ tableId: link.leftTableId, fieldId: pair.leftFieldId });
      const r = ctx.outName({ tableId: link.rightTableId, fieldId: pair.rightFieldId });
      if (l === '?' || r === '?')
        out.push(error('FIELD_NOT_FOUND', { table: l === '?' ? left.name : right.name }, refs));
    }
    if (link.compositeKey && link.pairs.length >= 2)
      checkName(out, link.compositeKey.name, 'composite key', refs);
    if (link.type === 'applyMap') {
      const opts = link.applyMap;
      const keyOk = opts && ctx.outName({ tableId: link.rightTableId, fieldId: opts.keyFieldId }) !== '?';
      const valueOk = opts && ctx.outName({ tableId: link.rightTableId, fieldId: opts.valueFieldId }) !== '?';
      if (!opts || !keyOk || !valueOk || link.pairs.length === 0) {
        out.push(error('APPLYMAP_FIELDS_MISSING', { left: left.name, right: right.name }, refs));
      } else {
        checkName(out, opts.outputName, 'field', refs);
      }
    }
  }

  const calendar = project.calendar;
  if (calendar?.enabled) {
    const ref = calendar.dateField;
    if (!ref || ctx.outName(ref) === '?') out.push(error('CALENDAR_DATE_MISSING', {}, {}));
  }

  const sourceOrder = orderSources(ctx);
  if (!sourceOrder.ok) {
    out.push(
      error(
        'CYCLIC_DEPENDENCY',
        { tables: sourceOrder.cycle.map((s) => s.name).join(', ') },
        { tableIds: sourceOrder.cycle.map((s) => s.id) },
      ),
    );
  }
  const transformOrder = orderTransform(ctx);
  if (!transformOrder.ok) {
    const names = transformOrder.cycle.map((n) =>
      n.kind === 'target'
        ? n.target.name
        : `${ctx.tableName(n.link.rightTableId)} -> ${ctx.tableName(n.link.leftTableId)}`,
    );
    out.push(
      error(
        'CYCLIC_DEPENDENCY',
        { tables: names.join(', ') },
        {
          tableIds: transformOrder.cycle.filter((n) => n.kind === 'target').map((n) => n.id.slice(2)),
          linkIds: transformOrder.cycle.filter((n) => n.kind === 'link').map((n) => n.id.slice(2)),
        },
      ),
    );
  }

  return out;
}

/** Field pairs with the same output name where at least one side is a key field. */
export function commonKeyPairs(ctx: Context, leftTableId: string, rightTableId: string): FieldPair[] {
  const left = ctx.table(leftTableId);
  const right = ctx.table(rightTableId);
  if (!left || !right || !isSourceTable(left) || !isSourceTable(right)) return [];
  const pairs: FieldPair[] = [];
  for (const lf of left.fields) {
    if (lf.role === 'ignore') continue;
    const ln = ctx.outName({ tableId: leftTableId, fieldId: lf.id });
    for (const rf of right.fields) {
      if (rf.role === 'ignore') continue;
      const rn = ctx.outName({ tableId: rightTableId, fieldId: rf.id });
      if (ln === rn && (lf.role === 'key' || rf.role === 'key'))
        pairs.push({ leftFieldId: lf.id, rightFieldId: rf.id });
    }
  }
  return pairs;
}
