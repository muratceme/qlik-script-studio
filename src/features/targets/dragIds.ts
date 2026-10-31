import type { FieldRef } from '@/model/types';

export function dragId(ref: FieldRef): string {
  return `field|${ref.tableId}|${ref.fieldId}`;
}

export function parseDragId(id: string): FieldRef | null {
  const [kind, tableId, fieldId] = id.split('|');
  return kind === 'field' && tableId && fieldId ? { tableId, fieldId } : null;
}
