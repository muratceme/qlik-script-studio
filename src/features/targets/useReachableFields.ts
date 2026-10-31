import { useMemo } from 'react';
import type { Field, FieldRef, Project, SourceTable, TargetTable } from '@/model/types';
import { MERGE_TYPES } from '@/generator/plan';
import { useProjectStore } from '@/store/projectStore';

export interface ReachableField {
  ref: FieldRef;
  table: SourceTable;
  field: Field;
  /** Display name after alias. */
  name: string;
  /** True when the field lives in the primary table itself. */
  primary: boolean;
}

/** Fields a target may use: the primary table's and those of tables merged into it. */
export function reachableFields(project: Project, target: TargetTable | null): ReachableField[] {
  if (!target?.primarySourceId) return [];
  const ids = [target.primarySourceId];
  for (const l of project.links) {
    if (l.leftTableId === target.primarySourceId && MERGE_TYPES.has(l.type) && !ids.includes(l.rightTableId))
      ids.push(l.rightTableId);
  }
  const out: ReachableField[] = [];
  for (const id of ids) {
    const table = project.sources.find((s) => s.id === id);
    if (!table) continue;
    for (const field of table.fields) {
      if (field.role === 'ignore') continue;
      out.push({
        ref: { tableId: table.id, fieldId: field.id },
        table,
        field,
        name: field.alias ?? field.name,
        primary: id === target.primarySourceId,
      });
    }
  }
  return out;
}

export function useReachableFields(target: TargetTable | null): ReachableField[] {
  const project = useProjectStore((s) => s.project);
  return useMemo(() => reachableFields(project, target), [project, target]);
}

export function fieldLabel(project: Project, ref: FieldRef): string {
  const table = project.sources.find((s) => s.id === ref.tableId);
  const field = table?.fields.find((f) => f.id === ref.fieldId);
  if (table && field) return `${table.name}.${field.alias ?? field.name}`;
  const target = project.targets.find((t) => t.id === ref.tableId);
  const column = target?.columns.find((c) => c.id === ref.fieldId);
  if (target && column)
    return `${target.name}.${column.kind === 'field' ? (column.alias ?? '?') : column.alias}`;
  return '?';
}
