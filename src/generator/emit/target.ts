import type { Aggregation, FieldRef, TargetColumn, TargetTable } from '@/model/types';
import type { Context } from '../context';
import { defaultScope, renderExpr, renderGroup, type ExprScope } from '../expr';
import { extraColumns, hasCompositeKey, MERGE_TYPES, unqualifiedKeyNames } from '../plan';
import { qName, qTable } from '../quote';
import { formatColumns, type ScriptWriter } from '../writer';

const AGGREGATION_FN: Record<Aggregation, (arg: string) => string> = {
  sum: (a) => `Sum(${a})`,
  count: (a) => `Count(${a})`,
  countDistinct: (a) => `Count(DISTINCT ${a})`,
  avg: (a) => `Avg(${a})`,
  min: (a) => `Min(${a})`,
  max: (a) => `Max(${a})`,
  firstValue: (a) => `FirstValue(${a})`,
  lastValue: (a) => `LastValue(${a})`,
};

/**
 * Scope used inside a target's RESIDENT load. Fields of tables merged into the
 * primary table are addressed by the name they have after the merge: pair
 * fields take the left (primary) side's name.
 */
export function targetScope(ctx: Context, target: TargetTable): ExprScope {
  const base = defaultScope(ctx);
  const primary = target.primarySourceId;
  const renamed = new Map<string, string>();
  if (primary) {
    for (const link of ctx.project.links) {
      if (link.leftTableId !== primary || !MERGE_TYPES.has(link.type)) continue;
      if (hasCompositeKey(link)) continue;
      for (const p of link.pairs) {
        renamed.set(`${link.rightTableId}:${p.rightFieldId}`, ctx.outName({ tableId: primary, fieldId: p.leftFieldId }));
      }
    }
  }
  return {
    ...base,
    fieldName: (ref: FieldRef) => renamed.get(`${ref.tableId}:${ref.fieldId}`) ?? base.fieldName(ref),
  };
}

export function columnExpr(column: TargetColumn, scope: ExprScope): string {
  switch (column.kind) {
    case 'field':
      return qName(scope.fieldName(column.ref));
    case 'measure':
      return AGGREGATION_FN[column.aggregation](qName(scope.fieldName(column.ref)));
    case 'calculated':
      return renderExpr(column.expr, scope);
  }
}

export function emitTarget(ctx: Context, w: ScriptWriter, target: TargetTable): void {
  const scope = targetScope(ctx, target);
  const primaryName = target.primarySourceId ? ctx.tableName(target.primarySourceId) : '?';
  const columns: { expr: string; alias: string | null }[] = [];
  const groupBy: string[] = [];
  let hasMeasure = false;

  for (const column of target.columns) {
    const expr = columnExpr(column, scope);
    const alias = qName(ctx.columnName(column));
    columns.push({ expr, alias: expr === alias ? null : alias });
    if (column.kind === 'measure') hasMeasure = true;
    else groupBy.push(expr);
  }
  for (const extra of extraColumns(ctx, target.id, scope)) {
    columns.push({ expr: extra.expr, alias: extra.alias });
    groupBy.push(extra.expr);
  }

  w.comment(`${target.name} (from ${primaryName})`);
  if (target.qualify) {
    w.line('QUALIFY *;');
    const keys = unqualifiedKeyNames(ctx, target.id);
    if (keys.length > 0) w.line(`UNQUALIFY ${keys.map(qName).join(', ')};`);
  }
  w.line(`${qTable(target.name)}:`);
  // Always NoConcatenate: a resident load with the same field set would otherwise
  // be appended to the primary table instead of creating a new one.
  w.line('NoConcatenate');
  w.line(target.distinct ? 'LOAD DISTINCT' : 'LOAD');
  w.lines(formatColumns(columns));
  const where = target.filter ? renderGroup(target.filter, scope, true) : '';
  const tail: string[] = [];
  if (where) tail.push(`WHERE ${where}`);
  if (hasMeasure && groupBy.length > 0) tail.push(`GROUP BY ${groupBy.join(', ')}`);
  if (tail.length === 0) {
    w.line(`RESIDENT ${qTable(primaryName)};`);
  } else {
    w.line(`RESIDENT ${qTable(primaryName)}`);
    w.lines(tail.map((t, i) => (i === tail.length - 1 ? `${t};` : t)));
  }
  if (target.qualify) w.line('UNQUALIFY *;');
  w.blank();
}
