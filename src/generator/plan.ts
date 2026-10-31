/**
 * Derived facts about a project that several emitters share: which tables are
 * consumed, which are dropped at the end, and which extra columns a table's
 * LOAD receives because of links (composite keys, ApplyMap outputs).
 */
import type { Link, SourceTable, TargetTable } from '@/model/types';
import { isSourceTable } from '@/model/types';
import { JOIN_TYPES, type Context } from './context';
import { renderExpr, type ExprScope } from './expr';
import { qName, qStr } from './quote';

export const MERGE_TYPES = new Set([...JOIN_TYPES, 'concatenate']);

/** True when the table's rows end up inside another table (join / concatenate / mapping / resident). */
export function isConsumed(ctx: Context, tableId: string): boolean {
  for (const t of ctx.project.targets) {
    if (t.primarySourceId === tableId) return true;
  }
  for (const l of ctx.project.links) {
    if (l.rightTableId !== tableId) continue;
    if (MERGE_TYPES.has(l.type) || l.type === 'applyMap') return true;
  }
  return false;
}

/** Tables dropped in the Cleanup section, in model order (sources first, then targets). */
export function droppedTables(ctx: Context): (SourceTable | TargetTable)[] {
  const out: (SourceTable | TargetTable)[] = [];
  for (const s of ctx.project.sources) {
    if (!s.keepInModel && ctx.project.settings.dropConsumedSources && isConsumed(ctx, s.id)) out.push(s);
  }
  for (const t of ctx.project.targets) {
    if (!t.keepInModel) out.push(t);
  }
  return out;
}

export function droppedTableIds(ctx: Context): Set<string> {
  return new Set(droppedTables(ctx).map((t) => t.id));
}

/** Tables that remain in the data model after the script has run. */
export function survivingTableIds(ctx: Context): string[] {
  const dropped = droppedTableIds(ctx);
  return [...ctx.tables.keys()].filter((id) => !dropped.has(id));
}

/** True when a composite key is active for the link (needs two or more pairs). */
export function hasCompositeKey(link: Link): boolean {
  return link.compositeKey !== null && link.pairs.length >= 2;
}

/** Renders the composite key expression for one side of a link. */
export function compositeKeyExpr(ctx: Context, link: Link, side: 'left' | 'right'): string {
  const key = link.compositeKey!;
  const tableId = side === 'left' ? link.leftTableId : link.rightTableId;
  const parts = link.pairs.map((p) =>
    qName(ctx.outName({ tableId, fieldId: side === 'left' ? p.leftFieldId : p.rightFieldId })),
  );
  const concat = parts.join(` & ${qStr(key.separator)} & `);
  return key.mode === 'autoNumber' ? `AutoNumber(${concat}, ${qStr(key.name)})` : concat;
}

export interface ExtraColumn {
  expr: string;
  alias: string;
}

/**
 * Field ids on the right side of composite-key links that must be left out of
 * the table's own LOAD (they are replaced by the composite key).
 */
export function suppressedFieldIds(ctx: Context, tableId: string): Set<string> {
  const ids = new Set<string>();
  for (const link of ctx.project.links) {
    if (link.rightTableId !== tableId || !hasCompositeKey(link)) continue;
    if (link.type === 'applyMap' || link.type === 'noConcatenate' || link.type === 'concatenate') continue;
    for (const p of link.pairs) ids.add(p.rightFieldId);
  }
  return ids;
}

/** Extra columns added to a table's own LOAD because of links. */
export function extraColumns(ctx: Context, tableId: string, scope: ExprScope): ExtraColumn[] {
  const out: ExtraColumn[] = [];
  const seen = new Set<string>();
  for (const link of ctx.project.links) {
    if (hasCompositeKey(link) && link.type !== 'applyMap' && link.type !== 'noConcatenate' && link.type !== 'concatenate') {
      const key = link.compositeKey!;
      if (link.leftTableId === tableId && !seen.has(key.name)) {
        seen.add(key.name);
        out.push({ expr: compositeKeyExpr(ctx, link, 'left'), alias: qName(key.name) });
      }
      // Right side of a join/keep gets the key inside the merge statement, not here.
      if (link.rightTableId === tableId && link.type === 'association' && !seen.has(key.name)) {
        seen.add(key.name);
        out.push({ expr: compositeKeyExpr(ctx, link, 'right'), alias: qName(key.name) });
      }
    }
    if (link.type === 'applyMap' && link.applyMap && link.leftTableId === tableId) {
      const pair = link.pairs[0];
      if (!pair) continue;
      const keyExpr = renderExpr({ kind: 'field', ref: { tableId, fieldId: pair.leftFieldId } }, scope);
      const text = scope.applyMap(link.id, keyExpr);
      if (text) out.push({ expr: text, alias: qName(link.applyMap.outputName) });
    }
  }
  return out;
}

/** Key field names to keep unqualified when a table is QUALIFY'd. */
export function unqualifiedKeyNames(ctx: Context, tableId: string): string[] {
  const names: string[] = [];
  const push = (n: string) => {
    if (!names.includes(n)) names.push(n);
  };
  const table = ctx.table(tableId);
  if (table && isSourceTable(table)) {
    for (const f of table.fields) {
      if (f.role === 'key') push(ctx.outName({ tableId, fieldId: f.id }));
    }
  }
  for (const link of ctx.linksOf(tableId)) {
    if (hasCompositeKey(link)) push(link.compositeKey!.name);
    for (const p of link.pairs) {
      push(ctx.outName({ tableId: link.leftTableId, fieldId: p.leftFieldId }));
    }
  }
  return names;
}

/** Whether a table's own LOAD needs the NoConcatenate prefix. */
export function needsNoConcatenate(ctx: Context, tableId: string): boolean {
  return ctx.project.links.some(
    (l) => l.type === 'noConcatenate' && (l.leftTableId === tableId || l.rightTableId === tableId),
  );
}
