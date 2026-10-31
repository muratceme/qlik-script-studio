import type { Link, LinkType } from '@/model/types';
import { isSourceTable } from '@/model/types';
import { KEEP_TYPES, JOIN_TYPES, type Context } from '../context';
import { compositeKeyExpr, hasCompositeKey } from '../plan';
import { qName, qTable } from '../quote';
import { formatColumns, type ScriptWriter } from '../writer';

const PREFIX: Partial<Record<LinkType, string>> = {
  leftJoin: 'LEFT JOIN',
  rightJoin: 'RIGHT JOIN',
  innerJoin: 'INNER JOIN',
  outerJoin: 'OUTER JOIN',
  leftKeep: 'LEFT KEEP',
  rightKeep: 'RIGHT KEEP',
  innerKeep: 'INNER KEEP',
  concatenate: 'CONCATENATE',
};

const LABEL: Partial<Record<LinkType, string>> = {
  leftJoin: 'Left join',
  rightJoin: 'Right join',
  innerJoin: 'Inner join',
  outerJoin: 'Outer join',
  leftKeep: 'Left keep',
  rightKeep: 'Right keep',
  innerKeep: 'Inner keep',
  concatenate: 'Concatenate',
};

/**
 * Column list for loading the right table RESIDENT into the left one:
 * pair fields are renamed to the left side's names (or replaced by the
 * composite key), every other field keeps its name.
 */
export function rightSideColumns(ctx: Context, link: Link): { expr: string; alias: string | null }[] {
  const right = ctx.table(link.rightTableId);
  if (!right) return [];
  const columns: { expr: string; alias: string | null }[] = [];
  const pairByRight = new Map(link.pairs.map((p) => [p.rightFieldId, p.leftFieldId]));
  const composite = hasCompositeKey(link);

  const ownRefs: { id: string }[] = isSourceTable(right)
    ? right.fields.filter((f) => f.role !== 'ignore')
    : right.columns;

  if (composite) {
    columns.push({ expr: compositeKeyExpr(ctx, link, 'right'), alias: qName(link.compositeKey!.name) });
  }
  for (const item of ownRefs) {
    const rightName = qName(ctx.outName({ tableId: right.id, fieldId: item.id }));
    const leftFieldId = pairByRight.get(item.id);
    if (leftFieldId !== undefined) {
      if (composite) continue;
      const leftName = qName(ctx.outName({ tableId: link.leftTableId, fieldId: leftFieldId }));
      columns.push({ expr: rightName, alias: leftName === rightName ? null : leftName });
    } else {
      columns.push({ expr: rightName, alias: null });
    }
  }
  return columns;
}

function pairDescription(ctx: Context, link: Link): string {
  if (link.pairs.length === 0) return '';
  const parts = link.pairs.map((p) => {
    const l = ctx.outName({ tableId: link.leftTableId, fieldId: p.leftFieldId });
    const r = ctx.outName({ tableId: link.rightTableId, fieldId: p.rightFieldId });
    return l === r ? l : `${l} = ${r}`;
  });
  return ` on ${parts.join(', ')}`;
}

export function emitLink(ctx: Context, w: ScriptWriter, link: Link): void {
  const prefix = PREFIX[link.type];
  if (!prefix) return;
  const leftName = ctx.tableName(link.leftTableId);
  const rightName = ctx.tableName(link.rightTableId);
  const columns = rightSideColumns(ctx, link);

  w.comment(`${LABEL[link.type]}: ${rightName} -> ${leftName}${pairDescription(ctx, link)}`);

  if (KEEP_TYPES.has(link.type)) {
    // KEEP creates a new table from the right one. Loading it with the same
    // field set would silently concatenate onto the original, so load into a
    // temporary name, drop the original and rename.
    const temp = `${rightName}_keep`;
    w.line(`${qTable(temp)}:`);
    w.line('NoConcatenate');
    w.line(`${prefix} (${qTable(leftName)})`);
    w.line('LOAD');
    w.lines(formatColumns(columns.length > 0 ? columns : [{ expr: '*', alias: null }]));
    w.line(`RESIDENT ${qTable(rightName)};`);
    w.line(`DROP TABLE ${qTable(rightName)};`);
    w.line(`RENAME TABLE ${qTable(temp)} TO ${qTable(rightName)};`);
    w.blank();
    return;
  }

  if (JOIN_TYPES.has(link.type) || link.type === 'concatenate') {
    w.line(`${prefix} (${qTable(leftName)})`);
    w.line('LOAD');
    w.lines(formatColumns(columns.length > 0 ? columns : [{ expr: '*', alias: null }]));
    w.line(`RESIDENT ${qTable(rightName)};`);
    w.blank();
  }
}
