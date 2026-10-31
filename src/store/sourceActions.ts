import { applyKindDefaults, newConnection, newField, newSourceTable } from '@/model/defaults';
import type { ConnectionKind, Field, SourceKind, SourceTable } from '@/model/types';
import { inferDataType, inferDateFormat, inferUnique } from '@/lib/suggestions';
import { columnValues } from '@/lib/fileFields';
import { useProjectStore } from './projectStore';
import { useUiStore } from './uiStore';

const update = (recipe: Parameters<ReturnType<typeof useProjectStore.getState>['update']>[0]) =>
  useProjectStore.getState().update(recipe);

function uniqueTableName(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

export function addSourceTable(kind: SourceKind = 'qvd'): string {
  const project = useProjectStore.getState().project;
  const taken = [...project.sources, ...project.targets].map((t) => t.name);
  const table = newSourceTable(uniqueTableName('Table', taken), kind);
  table.connectionId =
    project.connections.find((c) => c.kind === (kind === 'sql' ? 'database' : 'folder'))?.id ?? null;
  update((p) => {
    p.sources.push(table);
  });
  useUiStore.getState().selectSource(table.id);
  return table.id;
}

export function duplicateSourceTable(id: string): void {
  const project = useProjectStore.getState().project;
  const source = project.sources.find((s) => s.id === id);
  if (!source) return;
  const copy = newSourceTable(
    uniqueTableName(
      source.name,
      project.sources.map((s) => s.name),
    ),
    source.kind,
  );
  const cloned: SourceTable = {
    ...structuredClone(source),
    id: copy.id,
    name: copy.name,
    fields: source.fields.map((f) => ({ ...f, id: newField(f.name).id })),
  };
  update((p) => {
    const index = p.sources.findIndex((s) => s.id === id);
    p.sources.splice(index + 1, 0, cloned);
  });
  useUiStore.getState().selectSource(cloned.id);
}

export function removeSourceTable(id: string): void {
  update((p) => {
    p.sources = p.sources.filter((s) => s.id !== id);
    p.links = p.links.filter((l) => l.leftTableId !== id && l.rightTableId !== id);
    for (const t of p.targets) {
      if (t.primarySourceId === id) t.primarySourceId = null;
      t.columns = t.columns.filter((c) => c.kind === 'calculated' || c.ref.tableId !== id);
    }
    if (p.calendar?.dateField?.tableId === id) p.calendar.dateField = null;
    delete p.canvas.positions[id];
  });
  const ui = useUiStore.getState();
  if (ui.selectedSourceId === id) ui.selectSource(useProjectStore.getState().project.sources[0]?.id ?? null);
}

export function updateSourceTable(id: string, recipe: (table: SourceTable) => void): void {
  update((p) => {
    const table = p.sources.find((s) => s.id === id);
    if (table) recipe(table);
  });
}

export function setSourceKind(id: string, kind: SourceKind): void {
  update((p) => {
    const index = p.sources.findIndex((s) => s.id === id);
    const table = p.sources[index];
    if (!table) return;
    const next = applyKindDefaults(table, kind);
    const wantsKind: ConnectionKind = kind === 'sql' ? 'database' : 'folder';
    const current = next.connectionId ? p.connections.find((c) => c.id === next.connectionId) : undefined;
    if (!current || current.kind !== wantsKind) {
      next.connectionId = p.connections.find((c) => c.kind === wantsKind)?.id ?? null;
    }
    if (kind === 'inline' && next.inline && next.inline.rows.length === 0 && next.fields.length > 0) {
      next.inline.rows = [next.fields.map((f) => f.name)];
    }
    p.sources[index] = next;
  });
}

export function addConnection(name: string, kind: ConnectionKind): string {
  const connection = newConnection(name, kind);
  update((p) => {
    p.connections.push(connection);
  });
  return connection.id;
}

export function removeConnection(id: string): void {
  update((p) => {
    p.connections = p.connections.filter((c) => c.id !== id);
    for (const s of p.sources) if (s.connectionId === id) s.connectionId = null;
  });
}

export function addField(tableId: string, name = ''): string {
  const field = newField(name);
  update((p) => {
    const table = p.sources.find((s) => s.id === tableId);
    if (!table) return;
    table.fields.push(field);
    if (table.kind === 'inline' && table.inline) {
      if (table.inline.rows.length === 0) table.inline.rows.push([]);
      table.inline.rows[0]!.push(name);
    }
  });
  return field.id;
}

export function updateField(tableId: string, fieldId: string, recipe: (field: Field) => void): void {
  update((p) => {
    const table = p.sources.find((s) => s.id === tableId);
    const field = table?.fields.find((f) => f.id === fieldId);
    if (!table || !field) return;
    const oldName = field.name;
    recipe(field);
    if (table.kind === 'inline' && table.inline && field.name !== oldName) {
      const header = table.inline.rows[0];
      const idx = header?.indexOf(oldName) ?? -1;
      if (header && idx >= 0) header[idx] = field.name;
    }
  });
}

export function removeField(tableId: string, fieldId: string): void {
  update((p) => {
    const table = p.sources.find((s) => s.id === tableId);
    if (!table) return;
    const index = table.fields.findIndex((f) => f.id === fieldId);
    if (index < 0) return;
    table.fields.splice(index, 1);
    if (table.sampleRows) table.sampleRows = table.sampleRows.map((r) => r.filter((_, i) => i !== index));
    if (table.kind === 'inline' && table.inline)
      table.inline.rows = table.inline.rows.map((r) => r.filter((_, i) => i !== index));
    for (const t of p.targets)
      t.columns = t.columns.filter((c) => c.kind === 'calculated' || c.ref.fieldId !== fieldId);
    for (const l of p.links)
      l.pairs = l.pairs.filter((pair) => pair.leftFieldId !== fieldId && pair.rightFieldId !== fieldId);
    if (p.calendar?.dateField?.fieldId === fieldId) p.calendar.dateField = null;
  });
}

export function moveField(tableId: string, from: number, to: number): void {
  update((p) => {
    const table = p.sources.find((s) => s.id === tableId);
    if (
      !table ||
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= table.fields.length ||
      to >= table.fields.length
    )
      return;
    const move = <T>(arr: T[]) => {
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item as T);
    };
    move(table.fields);
    if (table.sampleRows) table.sampleRows.forEach(move);
    if (table.inline) table.inline.rows.forEach(move);
  });
}

/**
 * Replaces or extends the field list from detected names and preview rows.
 * Data types, date formats and uniqueness are inferred from the rows.
 */
export function setFieldsFromDetection(
  tableId: string,
  names: string[],
  rows: string[][],
  mode: 'replace' | 'append',
): void {
  update((p) => {
    const table = p.sources.find((s) => s.id === tableId);
    if (!table) return;
    const existing = new Set(mode === 'append' ? table.fields.map((f) => f.name) : []);
    const created: Field[] = names
      .filter((n) => !existing.has(n))
      .map((name) => {
        const index = names.indexOf(name);
        const values = columnValues(rows, index);
        const dataType = inferDataType(values);
        return newField(name, {
          dataType,
          role: dataType === 'date' ? 'date' : 'dimension',
          dateFormat: dataType === 'date' && table.kind !== 'qvd' ? inferDateFormat(values) : null,
          isUnique: inferUnique(values),
        });
      });
    if (mode === 'replace') {
      table.fields = created;
      table.sampleRows = rows.length > 0 ? rows.slice(0, 10) : null;
      if (table.kind === 'inline' && table.inline) table.inline.rows = [names, ...rows];
    } else {
      table.fields.push(...created);
      if (table.kind === 'inline' && table.inline) {
        if (table.inline.rows.length === 0) table.inline.rows.push([]);
        table.inline.rows[0]!.push(...created.map((f) => f.name));
      }
    }
  });
}
