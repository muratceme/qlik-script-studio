/**
 * Data-model analysis: warnings about the model Qlik will build, each with
 * one-click fixes. The script is still generated when warnings exist.
 */
import type { DataType, Project } from '@/model/types';
import { isSourceTable } from '@/model/types';
import { buildContext, finalFieldNames, JOIN_TYPES, ownFieldNames, type Context } from './context';
import { warning, type Diagnostic, type Fix } from './diagnostics';
import { droppedTableIds, hasCompositeKey, survivingTableIds } from './plan';

export function analyzeModel(project: Project): Diagnostic[] {
  return analyzeWithContext(buildContext(project));
}

/** Finds the own field (or target column) id that produces `name` in a table. */
function fieldIdByOutName(ctx: Context, tableId: string, name: string): string | undefined {
  const table = ctx.table(tableId);
  if (!table) return undefined;
  if (isSourceTable(table)) {
    return table.fields.find((f) => f.role !== 'ignore' && ctx.outName({ tableId, fieldId: f.id }) === name)?.id;
  }
  return table.columns.find((c) => ctx.columnName(c) === name)?.id;
}

function renameFix(ctx: Context, tableId: string, name: string): Fix | null {
  const fieldId = fieldIdByOutName(ctx, tableId, name);
  if (!fieldId) return null;
  return { kind: 'renameField', tableId, fieldId, newName: `${name}_${ctx.tableName(tableId)}` };
}

function roleOf(ctx: Context, tableId: string, name: string): string | null {
  const fieldId = fieldIdByOutName(ctx, tableId, name);
  if (!fieldId) return null;
  const entry = ctx.fields.get(fieldId);
  if (entry) return entry.field.role;
  const col = ctx.columns.get(fieldId);
  if (col?.column.kind === 'field') return ctx.field(col.column.ref)?.role ?? null;
  return null;
}

function normalizeType(t: DataType): string {
  return t === 'money' ? 'number' : t;
}

export function analyzeWithContext(ctx: Context): Diagnostic[] {
  const { project } = ctx;
  const out: Diagnostic[] = [];
  const surviving = survivingTableIds(ctx);
  const dropped = droppedTableIds(ctx);
  const fieldSets = new Map(surviving.map((id) => [id, finalFieldNames(ctx, id)]));

  // Synthetic keys: two surviving tables sharing two or more field names.
  for (let i = 0; i < surviving.length; i++) {
    for (let j = i + 1; j < surviving.length; j++) {
      const a = surviving[i]!;
      const b = surviving[j]!;
      const setB = new Set(fieldSets.get(b));
      const common = fieldSets.get(a)!.filter((n) => setB.has(n));
      if (common.length < 2) continue;
      const keyName = common.find((n) => roleOf(ctx, a, n) === 'key' || roleOf(ctx, b, n) === 'key') ?? common[0]!;
      const fixes: Fix[] = [];
      for (const name of common) {
        if (name === keyName) continue;
        const fix = renameFix(ctx, b, name) ?? renameFix(ctx, a, name);
        if (fix) fixes.push(fix);
      }
      fixes.push({ kind: 'qualifyTable', tableId: b });
      const link = project.links.find(
        (l) =>
          ((l.leftTableId === a && l.rightTableId === b) || (l.leftTableId === b && l.rightTableId === a)) &&
          l.pairs.length >= 2 &&
          !hasCompositeKey(l),
      );
      if (link) fixes.push({ kind: 'compositeKey', linkId: link.id, mode: 'autoNumber' });
      out.push(
        warning(
          'SYNTHETIC_KEY',
          { left: ctx.tableName(a), right: ctx.tableName(b), fields: common.join(', ') },
          { tableIds: [a, b], linkIds: link ? [link.id] : [] },
          fixes,
        ),
      );
    }
  }

  // Circular references: a cycle in the graph whose nodes are surviving tables
  // and whose edges are shared field names.
  const adjacency = new Map<string, Map<string, string>>();
  for (const id of surviving) adjacency.set(id, new Map());
  for (let i = 0; i < surviving.length; i++) {
    for (let j = i + 1; j < surviving.length; j++) {
      const a = surviving[i]!;
      const b = surviving[j]!;
      const setB = new Set(fieldSets.get(b));
      const shared = fieldSets.get(a)!.find((n) => setB.has(n));
      if (shared === undefined) continue;
      adjacency.get(a)!.set(b, shared);
      adjacency.get(b)!.set(a, shared);
    }
  }
  const cycle = findCycle(surviving, adjacency);
  if (cycle) {
    const fixes: Fix[] = [];
    for (let k = 0; k < cycle.length; k++) {
      const a = cycle[k]!;
      const b = cycle[(k + 1) % cycle.length]!;
      const shared = adjacency.get(a)!.get(b)!;
      if (roleOf(ctx, a, shared) === 'key' && roleOf(ctx, b, shared) === 'key') continue;
      const fix = renameFix(ctx, b, shared) ?? renameFix(ctx, a, shared);
      if (fix) fixes.push(fix);
    }
    if (fixes.length === 0) {
      const a = cycle[0]!;
      const b = cycle[1]!;
      const fix = renameFix(ctx, b, adjacency.get(a)!.get(b)!);
      if (fix) fixes.push(fix);
    }
    fixes.push({ kind: 'qualifyTable', tableId: cycle[cycle.length - 1]! });
    out.push(
      warning(
        'CIRCULAR_REFERENCE',
        { tables: cycle.map((id) => ctx.tableName(id)).join(' -> ') },
        { tableIds: cycle },
        fixes,
      ),
    );
  }

  // Implicit concatenation: two surviving source tables with identical field sets.
  for (let i = 0; i < surviving.length; i++) {
    for (let j = i + 1; j < surviving.length; j++) {
      const a = surviving[i]!;
      const b = surviving[j]!;
      if (!ctx.sources.has(a) || !ctx.sources.has(b)) continue;
      const fa = ownFieldNames(ctx, a);
      const fb = ownFieldNames(ctx, b);
      if (fa.length === 0 || fa.length !== fb.length) continue;
      const setB = new Set(fb);
      if (!fa.every((n) => setB.has(n))) continue;
      const linked = project.links.some(
        (l) =>
          (l.type === 'noConcatenate' || l.type === 'concatenate') &&
          ((l.leftTableId === a && l.rightTableId === b) || (l.leftTableId === b && l.rightTableId === a)),
      );
      if (linked) continue;
      out.push(
        warning(
          'IMPLICIT_CONCATENATE',
          { left: ctx.tableName(a), right: ctx.tableName(b) },
          { tableIds: [a, b] },
          [
            { kind: 'createLink', type: 'noConcatenate', leftTableId: a, rightTableId: b, pairs: [] },
            { kind: 'createLink', type: 'concatenate', leftTableId: a, rightTableId: b, pairs: [] },
          ],
        ),
      );
    }
  }

  for (const link of project.links) {
    const left = ctx.table(link.leftTableId);
    const right = ctx.table(link.rightTableId);
    if (!left || !right) continue;
    const refs = { linkIds: [link.id], tableIds: [left.id, right.id] };

    // Key type mismatch between paired fields.
    for (const pair of link.pairs) {
      const lf = ctx.fields.get(pair.leftFieldId)?.field;
      const rf = ctx.fields.get(pair.rightFieldId)?.field;
      if (!lf || !rf) continue;
      if (normalizeType(lf.dataType) !== normalizeType(rf.dataType)) {
        out.push(
          warning(
            'KEY_TYPE_MISMATCH',
            { left: left.name, leftField: lf.name, leftType: lf.dataType, right: right.name, rightField: rf.name, rightType: rf.dataType },
            { ...refs, fieldIds: [lf.id, rf.id] },
            [],
          ),
        );
      }
    }

    if (JOIN_TYPES.has(link.type)) {
      // Row fan-out: the side that is looked up should be unique on the key.
      const lookupSide = link.type === 'rightJoin' ? 'left' : 'right';
      const tableId = lookupSide === 'left' ? left.id : right.id;
      const fieldIds = link.pairs.map((p) => (lookupSide === 'left' ? p.leftFieldId : p.rightFieldId));
      const keyFields = fieldIds.map((id) => ctx.fields.get(id)?.field).filter((f) => f !== undefined);
      const unique = keyFields.some((f) => f.isUnique) || keyFields.some((f) => f.role === 'key');
      if (keyFields.length > 0 && !unique) {
        out.push(
          warning(
            'JOIN_FANOUT_RISK',
            { table: ctx.tableName(tableId), fields: keyFields.map((f) => f.name).join(', '), left: left.name, right: right.name },
            { ...refs, fieldIds: keyFields.map((f) => f.id) },
            keyFields.map((f) => ({ kind: 'setRole', tableId, fieldId: f.id, role: 'key' }) as Fix),
          ),
        );
      }

      // Common fields besides the chosen keys silently become part of the join.
      const pairLeft = new Set(link.pairs.map((p) => ctx.outName({ tableId: left.id, fieldId: p.leftFieldId })));
      const rightNames = ownFieldNames(ctx, right.id).filter(
        (n) => !link.pairs.some((p) => ctx.outName({ tableId: right.id, fieldId: p.rightFieldId }) === n),
      );
      const leftNames = new Set(ownFieldNames(ctx, left.id));
      const unintended = rightNames.filter((n) => leftNames.has(n) && !pairLeft.has(n));
      if (unintended.length > 0) {
        const fixes = unintended.map((n) => renameFix(ctx, right.id, n)).filter((f): f is Fix => f !== null);
        out.push(
          warning(
            'JOIN_UNINTENDED_COMMON_FIELD',
            { left: left.name, right: right.name, fields: unintended.join(', ') },
            refs,
            fixes,
          ),
        );
      }
    }
  }

  const calendar = project.calendar;
  if (calendar?.enabled && calendar.dateField && dropped.has(calendar.dateField.tableId)) {
    out.push(
      warning(
        'DROPPED_TABLE_REFERENCED',
        { table: ctx.tableName(calendar.dateField.tableId), by: calendar.tableName },
        { tableIds: [calendar.dateField.tableId] },
        [{ kind: 'keepTable', tableId: calendar.dateField.tableId }],
      ),
    );
  }

  return out;
}

/** Returns the nodes of the first cycle (length >= 3) found, or null. */
export function findCycle(nodes: string[], adjacency: Map<string, Map<string, string>>): string[] | null {
  const visited = new Set<string>();
  const parent = new Map<string, string | null>();
  for (const start of nodes) {
    if (visited.has(start)) continue;
    const stack: { node: string; from: string | null }[] = [{ node: start, from: null }];
    while (stack.length > 0) {
      const { node, from } = stack.pop()!;
      if (visited.has(node)) continue;
      visited.add(node);
      parent.set(node, from);
      for (const next of adjacency.get(node)?.keys() ?? []) {
        if (next === from) continue;
        if (visited.has(next)) {
          // Walk back from `node` to `next` to collect the cycle.
          const cycle = [node];
          let cur = parent.get(node) ?? null;
          while (cur !== null && cur !== next) {
            cycle.push(cur);
            cur = parent.get(cur) ?? null;
          }
          if (cur === next) {
            cycle.push(next);
            if (cycle.length >= 3) return cycle.reverse();
          }
          continue;
        }
        stack.push({ node: next, from: node });
      }
    }
  }
  return null;
}
