import type { DataType, FieldRef, FieldRole, Project } from '@/model/types';

export interface ResolvedRef {
  tableId: string;
  tableName: string;
  /** Display name after aliases. */
  name: string;
  role: FieldRole;
  dataType: DataType;
  isTarget: boolean;
}

/** Resolves a field reference to a source field or a target column, or null. */
export function resolveRef(project: Project, ref: FieldRef): ResolvedRef | null {
  const source = project.sources.find((s) => s.id === ref.tableId);
  if (source) {
    const field = source.fields.find((f) => f.id === ref.fieldId);
    if (!field) return null;
    return {
      tableId: source.id,
      tableName: source.name,
      name: field.alias ?? field.name,
      role: field.role,
      dataType: field.dataType,
      isTarget: false,
    };
  }
  const target = project.targets.find((t) => t.id === ref.tableId);
  const column = target?.columns.find((c) => c.id === ref.fieldId);
  if (!target || !column) return null;
  if (column.kind === 'calculated') {
    return {
      tableId: target.id,
      tableName: target.name,
      name: column.alias,
      role: 'dimension',
      dataType: 'text',
      isTarget: true,
    };
  }
  const inner = resolveRef(project, column.ref);
  return {
    tableId: target.id,
    tableName: target.name,
    name: column.kind === 'measure' ? column.alias : (column.alias ?? inner?.name ?? '?'),
    role: column.kind === 'measure' ? 'measure' : (inner?.role ?? 'dimension'),
    dataType: column.kind === 'measure' ? 'number' : (inner?.dataType ?? 'text'),
    isTarget: true,
  };
}
