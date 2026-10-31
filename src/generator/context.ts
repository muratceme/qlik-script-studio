/**
 * Pre-computed lookups over a project. Built once per generation and shared by
 * validation, analysis and emitters.
 */
import type {
  AnyTable,
  Field,
  FieldRef,
  Link,
  Project,
  SourceTable,
  TargetColumn,
  TargetTable,
} from '@/model/types';
import { isSourceTable } from '@/model/types';

export const JOIN_TYPES = new Set(['leftJoin', 'rightJoin', 'innerJoin', 'outerJoin']);
export const KEEP_TYPES = new Set(['leftKeep', 'rightKeep', 'innerKeep']);

export interface Context {
  project: Project;
  tables: Map<string, AnyTable>;
  sources: Map<string, SourceTable>;
  targets: Map<string, TargetTable>;
  /** fieldId -> { field, tableId } for source fields. */
  fields: Map<string, { field: Field; tableId: string }>;
  /** columnId -> { column, tableId } for target columns (referenced like fields). */
  columns: Map<string, { column: TargetColumn; tableId: string }>;
  links: Map<string, Link>;
  connections: Map<string, Project['connections'][number]>;
  /** Output name of a source field after alias and association renames. */
  outName: (ref: FieldRef) => string;
  /** Resolve a source field; undefined when the ref is dangling. */
  field: (ref: FieldRef) => Field | undefined;
  table: (id: string) => AnyTable | undefined;
  tableName: (id: string) => string;
  /** Output column name of a target column. */
  columnName: (column: TargetColumn) => string;
  /** Links of a type set where the given table is on the left. */
  linksInto: (tableId: string, types?: Set<string>) => Link[];
  /** All links touching a table. */
  linksOf: (tableId: string) => Link[];
}

export function buildContext(project: Project): Context {
  const tables = new Map<string, AnyTable>();
  const sources = new Map<string, SourceTable>();
  const targets = new Map<string, TargetTable>();
  const fields = new Map<string, { field: Field; tableId: string }>();
  const links = new Map<string, Link>();
  const connections = new Map<string, Project['connections'][number]>();

  for (const s of project.sources) {
    tables.set(s.id, s);
    sources.set(s.id, s);
    for (const f of s.fields) fields.set(f.id, { field: f, tableId: s.id });
  }
  const columns = new Map<string, { column: TargetColumn; tableId: string }>();
  for (const t of project.targets) {
    tables.set(t.id, t);
    targets.set(t.id, t);
    for (const c of t.columns) columns.set(c.id, { column: c, tableId: t.id });
  }
  for (const l of project.links) links.set(l.id, l);
  for (const c of project.connections) connections.set(c.id, c);

  // Association links with `renameRightToLeft` rename the right field to the
  // left field's output name. Resolved in link order; the first wins.
  const renames = new Map<string, string>();
  for (const link of project.links) {
    if (link.type !== 'association' || !link.renameRightToLeft) continue;
    for (const pair of link.pairs) {
      const left = fields.get(pair.leftFieldId);
      if (!left || renames.has(pair.rightFieldId)) continue;
      renames.set(pair.rightFieldId, left.field.alias ?? left.field.name);
    }
  }

  const field = (ref: FieldRef): Field | undefined => {
    const entry = fields.get(ref.fieldId);
    return entry && entry.tableId === ref.tableId ? entry.field : undefined;
  };

  const columnName = (column: TargetColumn): string => {
    switch (column.kind) {
      case 'field':
        return column.alias ?? outName(column.ref);
      case 'measure':
      case 'calculated':
        return column.alias;
    }
  };

  const outName = (ref: FieldRef): string => {
    const renamed = renames.get(ref.fieldId);
    if (renamed !== undefined) return renamed;
    const col = columns.get(ref.fieldId);
    if (col && col.tableId === ref.tableId) return columnName(col.column);
    const f = field(ref);
    if (!f) return '?';
    return f.alias ?? f.name;
  };

  const table = (id: string) => tables.get(id);
  const tableName = (id: string) => tables.get(id)?.name ?? '?';

  const linksInto = (tableId: string, types?: Set<string>) =>
    project.links.filter((l) => l.leftTableId === tableId && (!types || types.has(l.type)));
  const linksOf = (tableId: string) =>
    project.links.filter((l) => l.leftTableId === tableId || l.rightTableId === tableId);

  return {
    project,
    tables,
    sources,
    targets,
    fields,
    columns,
    links,
    connections,
    outName,
    field,
    table,
    tableName,
    columnName,
    linksInto,
    linksOf,
  };
}

/**
 * Final field names of a table as they exist in the data model after all
 * loads, joins and concatenations. Used by the analysis step.
 */
export function finalFieldNames(ctx: Context, tableId: string): string[] {
  const table = ctx.table(tableId);
  if (!table) return [];
  const names: string[] = [];
  const push = (n: string) => {
    if (!names.includes(n)) names.push(n);
  };

  if (isSourceTable(table)) {
    for (const f of table.fields) {
      if (f.role === 'ignore') continue;
      push(ctx.outName({ tableId: table.id, fieldId: f.id }));
    }
  } else {
    for (const c of table.columns) push(ctx.columnName(c));
  }

  for (const link of ctx.linksOf(tableId)) {
    // Composite keys are added to both sides; right-side originals are removed.
    if (link.compositeKey && link.pairs.length >= 2) {
      push(link.compositeKey.name);
      if (link.rightTableId === tableId) {
        for (const pair of link.pairs) {
          const name = ctx.outName({ tableId, fieldId: pair.rightFieldId });
          const idx = names.indexOf(name);
          if (idx >= 0) names.splice(idx, 1);
        }
      }
    }
    if (link.type === 'applyMap' && link.applyMap && link.leftTableId === tableId) {
      push(link.applyMap.outputName);
    }
    if (link.leftTableId === tableId && (JOIN_TYPES.has(link.type) || link.type === 'concatenate')) {
      const rightNames = ownFieldNames(ctx, link.rightTableId);
      const pairRight = new Set(link.pairs.map((p) => ctx.outName({ tableId: link.rightTableId, fieldId: p.rightFieldId })));
      for (const n of rightNames) {
        if (link.compositeKey && link.pairs.length >= 2 && pairRight.has(n)) continue;
        push(n);
      }
      // Keys from the right side arrive under the left side's names.
      for (const pair of link.pairs) {
        if (link.compositeKey && link.pairs.length >= 2) continue;
        push(ctx.outName({ tableId: link.leftTableId, fieldId: pair.leftFieldId }));
      }
    }
  }
  return names;
}

/** Field names a table has on its own, before links. */
export function ownFieldNames(ctx: Context, tableId: string): string[] {
  const table = ctx.table(tableId);
  if (!table) return [];
  if (isSourceTable(table)) {
    return table.fields.filter((f) => f.role !== 'ignore').map((f) => ctx.outName({ tableId, fieldId: f.id }));
  }
  return table.columns.map((c) => ctx.columnName(c));
}

/** Qualifies a field name after `QUALIFY *` has been applied to its table. */
export function qualifiedName(tableName: string, fieldName: string): string {
  return `${tableName}.${fieldName}`;
}
