import { createId } from './id';
import type {
  Condition,
  ConditionGroup,
  Connection,
  ConnectionKind,
  Expr,
  Field,
  FieldRef,
  Link,
  LinkType,
  MasterCalendar,
  Project,
  ProjectSettings,
  SourceKind,
  SourceTable,
  TargetTable,
} from './types';
import { SCHEMA_VERSION } from './types';

export function defaultSettings(): ProjectSettings {
  return {
    locale: 'en',
    dialect: 'sense',
    useTabs: true,
    qvdStorePath: 'lib://QVD/',
    dropConsumedSources: true,
  };
}

export function newProject(name = 'New project'): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: createId(),
    name,
    settings: defaultSettings(),
    connections: [],
    sources: [],
    targets: [],
    links: [],
    calendar: null,
    canvas: { positions: {} },
  };
}

export function newConnection(name: string, kind: ConnectionKind = 'folder'): Connection {
  return { id: createId(), name, kind };
}

export function newSourceTable(name: string, kind: SourceKind = 'qvd'): SourceTable {
  const table: SourceTable = {
    id: createId(),
    name,
    kind,
    connectionId: null,
    path: '',
    excel: null,
    csv: null,
    sql: null,
    inline: null,
    fields: [],
    keepInModel: true,
    qualify: false,
    sampleRows: null,
  };
  return applyKindDefaults(table, kind);
}

/** Resets the kind-specific option blocks so exactly the right one is populated. */
export function applyKindDefaults(table: SourceTable, kind: SourceKind): SourceTable {
  return {
    ...table,
    kind,
    excel: kind === 'excel' ? (table.excel ?? { sheet: 'Sheet1', headerRow: 1 }) : null,
    csv:
      kind === 'csv' ? (table.csv ?? { delimiter: ',', encoding: 'utf8', hasHeader: true, msq: true }) : null,
    sql: kind === 'sql' ? (table.sql ?? { query: '' }) : null,
    inline: kind === 'inline' ? (table.inline ?? { rows: [] }) : null,
  };
}

export function newField(name: string, partial: Partial<Omit<Field, 'id' | 'name'>> = {}): Field {
  return {
    id: createId(),
    name,
    alias: null,
    role: 'dimension',
    dataType: 'text',
    dateFormat: null,
    isUnique: false,
    suggestedRole: null,
    ...partial,
  };
}

export function newTargetTable(name: string, primarySourceId: string | null = null): TargetTable {
  return {
    id: createId(),
    name,
    primarySourceId,
    columns: [],
    filter: null,
    distinct: false,
    store: { enabled: false, path: '' },
    keepInModel: true,
    qualify: false,
  };
}

export function newConditionGroup(logic: 'and' | 'or' = 'and'): ConditionGroup {
  return { id: createId(), kind: 'group', logic, items: [] };
}

export function newCondition(left: Expr): Condition {
  return { id: createId(), kind: 'condition', left, op: 'eq', values: [''] };
}

export function fieldExpr(ref: FieldRef): Expr {
  return { kind: 'field', ref };
}

export function newLink(type: LinkType, leftTableId: string, rightTableId: string): Link {
  return {
    id: createId(),
    type,
    leftTableId,
    rightTableId,
    pairs: [],
    compositeKey: null,
    renameRightToLeft: false,
    applyMap: null,
  };
}

export function newCalendar(dateField: FieldRef | null = null): MasterCalendar {
  return {
    enabled: dateField !== null,
    tableName: 'Calendar',
    dateField,
    parts: ['year', 'quarter', 'month', 'monthName', 'week', 'day', 'weekday', 'yearMonth'],
  };
}
