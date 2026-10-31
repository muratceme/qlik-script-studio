import type { DataType, FieldRole } from '@/model/types';
import { suggestRole } from '@/lib/suggestions';
import { useProjectStore } from './projectStore';

const update = (recipe: Parameters<ReturnType<typeof useProjectStore.getState>['update']>[0]) =>
  useProjectStore.getState().update(recipe);

/** Computes suggestions for every field; returns how many were produced. */
export function suggestRoles(): number {
  let count = 0;
  update((p) => {
    for (const s of p.sources) {
      for (const f of s.fields) {
        f.suggestedRole = suggestRole(f);
        if (f.suggestedRole) count++;
      }
    }
  });
  return count;
}

export function clearSuggestions(): void {
  update((p) => {
    for (const s of p.sources) for (const f of s.fields) f.suggestedRole = null;
  });
}

export function applySuggestion(fieldId: string): void {
  update((p) => {
    for (const s of p.sources) {
      const f = s.fields.find((x) => x.id === fieldId);
      if (f && f.suggestedRole) {
        f.role = f.suggestedRole;
        f.suggestedRole = null;
        if (f.role === 'date' && f.dataType === 'text') f.dataType = 'date';
      }
    }
  });
}

export function applyAllSuggestions(): void {
  update((p) => {
    for (const s of p.sources) {
      for (const f of s.fields) {
        if (!f.suggestedRole) continue;
        f.role = f.suggestedRole;
        f.suggestedRole = null;
        if (f.role === 'date' && f.dataType === 'text') f.dataType = 'date';
      }
    }
  });
}

export function bulkSetRole(fieldIds: Set<string>, role: FieldRole): void {
  update((p) => {
    for (const s of p.sources) {
      for (const f of s.fields) {
        if (!fieldIds.has(f.id)) continue;
        f.role = role;
        f.suggestedRole = f.suggestedRole === role ? null : f.suggestedRole;
      }
    }
  });
}

export function bulkSetType(fieldIds: Set<string>, dataType: DataType): void {
  update((p) => {
    for (const s of p.sources) for (const f of s.fields) if (fieldIds.has(f.id)) f.dataType = dataType;
  });
}
