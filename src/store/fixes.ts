/**
 * Applies one-click fixes proposed by the generator to a project draft.
 */
import type { Fix } from '@/generator';
import { newLink } from '@/model/defaults';
import type { Project } from '@/model/types';

export function applyFix(project: Project, fix: Fix): void {
  switch (fix.kind) {
    case 'renameField': {
      const source = project.sources.find((s) => s.id === fix.tableId);
      const field = source?.fields.find((f) => f.id === fix.fieldId);
      if (field) {
        field.alias = fix.newName;
        return;
      }
      const target = project.targets.find((t) => t.id === fix.tableId);
      const column = target?.columns.find((c) => c.id === fix.fieldId);
      if (column) column.alias = fix.newName;
      return;
    }
    case 'qualifyTable': {
      const table = project.sources.find((s) => s.id === fix.tableId) ?? project.targets.find((t) => t.id === fix.tableId);
      if (table) table.qualify = true;
      return;
    }
    case 'compositeKey': {
      const link = project.links.find((l) => l.id === fix.linkId);
      if (link) link.compositeKey = { mode: fix.mode, name: `%Key_${link.id.slice(0, 4)}`, separator: '|' };
      return;
    }
    case 'createLink': {
      const link = newLink(fix.type, fix.leftTableId, fix.rightTableId);
      link.pairs = fix.pairs;
      project.links.push(link);
      return;
    }
    case 'setIgnore':
    case 'setRole': {
      const source = project.sources.find((s) => s.id === fix.tableId);
      const field = source?.fields.find((f) => f.id === fix.fieldId);
      if (field) field.role = fix.kind === 'setIgnore' ? 'ignore' : fix.role;
      return;
    }
    case 'keepTable': {
      const table = project.sources.find((s) => s.id === fix.tableId) ?? project.targets.find((t) => t.id === fix.tableId);
      if (table) table.keepInModel = true;
      return;
    }
  }
}

/** Parameters for the translated fix label. */
export function describeFixParams(project: Project, fix: Fix): Record<string, string> {
  const tableName = (id: string) =>
    project.sources.find((s) => s.id === id)?.name ?? project.targets.find((t) => t.id === id)?.name ?? '?';
  switch (fix.kind) {
    case 'renameField':
      return { newName: fix.newName, table: tableName(fix.tableId) };
    case 'qualifyTable':
    case 'keepTable':
      return { table: tableName(fix.tableId) };
    case 'compositeKey':
      return { mode: fix.mode };
    case 'createLink':
      return { type: fix.type, left: tableName(fix.leftTableId), right: tableName(fix.rightTableId) };
    case 'setIgnore':
      return { table: tableName(fix.tableId) };
    case 'setRole':
      return { role: fix.role, table: tableName(fix.tableId) };
  }
}
