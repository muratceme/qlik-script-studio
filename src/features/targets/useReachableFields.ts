import { useMemo } from 'react';
import type { FieldRef, Project, TargetTable } from '@/model/types';
import { MERGE_TYPES } from '@/generator/plan';
import { useProjectStore } from '@/store/projectStore';
import { resolveRef, type ResolvedRef } from '@/lib/resolveRef';

export interface ReachableField extends ResolvedRef {
  ref: FieldRef;
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
    const source = project.sources.find((s) => s.id === id);
    const refs: FieldRef[] = source
      ? source.fields.filter((f) => f.role !== 'ignore').map((f) => ({ tableId: id, fieldId: f.id }))
      : (project.targets.find((t) => t.id === id)?.columns.map((c) => ({ tableId: id, fieldId: c.id })) ??
        []);
    for (const ref of refs) {
      const resolved = resolveRef(project, ref);
      if (resolved) out.push({ ...resolved, ref, primary: id === target.primarySourceId });
    }
  }
  return out;
}

export function useReachableFields(target: TargetTable | null): ReachableField[] {
  const project = useProjectStore((s) => s.project);
  return useMemo(() => reachableFields(project, target), [project, target]);
}

export function fieldLabel(project: Project, ref: FieldRef): string {
  const r = resolveRef(project, ref);
  return r ? `${r.tableName}.${r.name}` : '?';
}
