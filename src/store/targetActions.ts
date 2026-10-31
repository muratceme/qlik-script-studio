import { newCalendar, newTargetTable } from '@/model/defaults';
import { createId } from '@/model/id';
import type { Aggregation, Expr, FieldRef, TargetColumn, TargetTable } from '@/model/types';
import { useProjectStore } from './projectStore';
import { useUiStore } from './uiStore';

const update = (recipe: Parameters<ReturnType<typeof useProjectStore.getState>['update']>[0]) =>
  useProjectStore.getState().update(recipe);

function uniqueName(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

export function addTargetTable(primarySourceId: string | null = null): string {
  const project = useProjectStore.getState().project;
  const primary = primarySourceId ?? project.sources[0]?.id ?? null;
  const base = primary ? `${project.sources.find((s) => s.id === primary)?.name ?? 'Table'}_Final` : 'Target';
  const taken = [...project.sources, ...project.targets].map((t) => t.name);
  const target = newTargetTable(uniqueName(base, taken), primary);
  update((p) => {
    p.targets.push(target);
  });
  useUiStore.getState().selectTarget(target.id);
  return target.id;
}

export function removeTargetTable(id: string): void {
  update((p) => {
    p.targets = p.targets.filter((t) => t.id !== id);
    p.links = p.links.filter((l) => l.leftTableId !== id && l.rightTableId !== id);
    for (const t of p.targets) if (t.primarySourceId === id) t.primarySourceId = null;
    if (p.calendar?.dateField?.tableId === id) p.calendar.dateField = null;
    delete p.canvas.positions[id];
  });
  const ui = useUiStore.getState();
  if (ui.selectedTargetId === id) ui.selectTarget(useProjectStore.getState().project.targets[0]?.id ?? null);
}

export function updateTarget(id: string, recipe: (target: TargetTable) => void): void {
  update((p) => {
    const target = p.targets.find((t) => t.id === id);
    if (target) recipe(target);
  });
}

/** Adds a source field as a column. Measures get an aggregation by default. */
export function addFieldColumn(targetId: string, ref: FieldRef): void {
  update((p) => {
    const target = p.targets.find((t) => t.id === targetId);
    if (!target) return;
    if (target.columns.some((c) => c.kind !== 'calculated' && c.ref.fieldId === ref.fieldId && c.ref.tableId === ref.tableId)) return;
    if (!target.primarySourceId) target.primarySourceId = ref.tableId;
    const source = p.sources.find((s) => s.id === ref.tableId);
    const field = source?.fields.find((f) => f.id === ref.fieldId);
    const fieldName = field ? (field.alias ?? field.name) : 'Field';
    if (field?.role === 'measure') {
      target.columns.push({ id: createId(), kind: 'measure', ref, aggregation: 'sum', alias: `Sum of ${fieldName}` });
    } else {
      target.columns.push({ id: createId(), kind: 'field', ref, alias: null });
    }
  });
}

/** Switches a field column between plain (group by) and aggregated. */
export function setColumnAggregation(targetId: string, columnId: string, aggregation: Aggregation | null): void {
  update((p) => {
    const target = p.targets.find((t) => t.id === targetId);
    if (!target) return;
    const index = target.columns.findIndex((c) => c.id === columnId);
    const column = target.columns[index];
    if (!column || column.kind === 'calculated') return;
    const source = p.sources.find((s) => s.id === column.ref.tableId);
    const field = source?.fields.find((f) => f.id === column.ref.fieldId);
    const fieldName = field ? (field.alias ?? field.name) : 'Field';
    if (aggregation === null) {
      target.columns[index] = { id: column.id, kind: 'field', ref: column.ref, alias: null };
    } else {
      const label = aggregation.charAt(0).toUpperCase() + aggregation.slice(1).replace(/([A-Z])/g, ' $1');
      const alias = column.kind === 'measure' && !column.alias.startsWith(`${label} of`) && !/ of /.test(column.alias) ? column.alias : `${label} of ${fieldName}`;
      target.columns[index] = { id: column.id, kind: 'measure', ref: column.ref, aggregation, alias };
    }
  });
}

export function addCalculatedColumn(targetId: string, alias: string, expr: Expr): string {
  const id = createId();
  update((p) => {
    const target = p.targets.find((t) => t.id === targetId);
    if (target) target.columns.push({ id, kind: 'calculated', alias, expr });
  });
  return id;
}

export function updateColumn(targetId: string, columnId: string, recipe: (column: TargetColumn) => void): void {
  update((p) => {
    const target = p.targets.find((t) => t.id === targetId);
    const column = target?.columns.find((c) => c.id === columnId);
    if (column) recipe(column);
  });
}

export function replaceColumn(targetId: string, columnId: string, column: TargetColumn): void {
  update((p) => {
    const target = p.targets.find((t) => t.id === targetId);
    if (!target) return;
    const index = target.columns.findIndex((c) => c.id === columnId);
    if (index >= 0) target.columns[index] = column;
  });
}

export function removeColumn(targetId: string, columnId: string): void {
  update((p) => {
    const target = p.targets.find((t) => t.id === targetId);
    if (target) target.columns = target.columns.filter((c) => c.id !== columnId);
  });
}

export function moveColumn(targetId: string, from: number, to: number): void {
  update((p) => {
    const target = p.targets.find((t) => t.id === targetId);
    if (!target || from === to || to < 0 || to >= target.columns.length) return;
    const [item] = target.columns.splice(from, 1);
    target.columns.splice(to, 0, item!);
  });
}

export function setCalendar(dateField: FieldRef | null, enabled: boolean): void {
  update((p) => {
    if (!p.calendar) p.calendar = newCalendar(dateField);
    p.calendar.dateField = dateField;
    p.calendar.enabled = enabled && dateField !== null;
  });
}

export function updateCalendar(recipe: (calendar: NonNullable<ReturnType<typeof newCalendar>>) => void): void {
  update((p) => {
    if (!p.calendar) p.calendar = newCalendar(null);
    recipe(p.calendar);
  });
}
