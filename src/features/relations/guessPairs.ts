import type { FieldPair, Project } from '@/model/types';
import { isSourceTable } from '@/model/types';
import { buildContext } from '@/generator/context';

interface Candidate {
  id: string;
  name: string;
  key: boolean;
}

function candidates(project: Project, tableId: string): Candidate[] {
  const ctx = buildContext(project);
  const table = ctx.table(tableId);
  if (!table) return [];
  if (isSourceTable(table)) {
    return table.fields
      .filter((f) => f.role !== 'ignore')
      .map((f) => ({ id: f.id, name: ctx.outName({ tableId, fieldId: f.id }), key: f.role === 'key' }));
  }
  return table.columns.map((c) => ({
    id: c.id,
    name: ctx.columnName(c),
    key: c.kind === 'field' && ctx.field(c.ref)?.role === 'key',
  }));
}

/**
 * Guesses how two tables match: fields with the same name first (keys before
 * others), then a key on each side, then the first field of each.
 */
export function guessPairs(project: Project, leftTableId: string, rightTableId: string): FieldPair[] {
  const left = candidates(project, leftTableId);
  const right = candidates(project, rightTableId);
  const norm = (s: string) => s.trim().toLowerCase();
  const sameName: FieldPair[] = [];
  for (const l of left) {
    const r = right.find((x) => norm(x.name) === norm(l.name));
    if (r) sameName.push({ leftFieldId: l.id, rightFieldId: r.id });
  }
  if (sameName.length > 0) {
    const keyed = sameName.filter(
      (p) => left.find((l) => l.id === p.leftFieldId)?.key || right.find((r) => r.id === p.rightFieldId)?.key,
    );
    return keyed.length > 0 ? keyed : [sameName[0]!];
  }
  const lk = left.find((l) => l.key) ?? left[0];
  const rk = right.find((r) => r.key) ?? right[0];
  return lk && rk ? [{ leftFieldId: lk.id, rightFieldId: rk.id }] : [];
}
