/**
 * Small builders for test models. Ids are deterministic strings so snapshots
 * stay stable.
 */
import type {
  Connection,
  Field,
  FieldRef,
  Link,
  LinkType,
  Project,
  SourceKind,
  SourceTable,
  TargetColumn,
  TargetTable,
} from '@/model/types';
import { SCHEMA_VERSION } from '@/model/types';

export function project(partial: Partial<Project> = {}): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'p1',
    name: 'Test',
    settings: { locale: 'en', dialect: 'sense', useTabs: true, qvdStorePath: 'lib://QVD/', dropConsumedSources: true },
    connections: [{ id: 'c1', name: 'lib://DataFiles', kind: 'folder' }],
    sources: [],
    targets: [],
    links: [],
    calendar: null,
    canvas: { positions: {} },
    ...partial,
  };
}

export function field(id: string, name: string, partial: Partial<Field> = {}): Field {
  return { id, name, alias: null, role: 'dimension', dataType: 'text', dateFormat: null, isUnique: false, suggestedRole: null, ...partial };
}

export function source(id: string, name: string, kind: SourceKind, fields: Field[], partial: Partial<SourceTable> = {}): SourceTable {
  const base: SourceTable = {
    id,
    name,
    kind,
    connectionId: kind === 'sql' ? null : 'c1',
    path: kind === 'qvd' ? `${name}.qvd` : kind === 'excel' ? `${name}.xlsx` : kind === 'csv' ? `${name}.csv` : '',
    excel: kind === 'excel' ? { sheet: 'Sheet1', headerRow: 1 } : null,
    csv: kind === 'csv' ? { delimiter: ',', encoding: 'utf8', hasHeader: true, msq: true } : null,
    sql: kind === 'sql' ? { query: `SELECT * FROM ${name}` } : null,
    inline: kind === 'inline' ? { rows: [fields.map((f) => f.name), fields.map((_, i) => `v${i}`)] } : null,
    fields,
    keepInModel: false,
    qualify: false,
    sampleRows: null,
  };
  return { ...base, ...partial };
}

export function target(id: string, name: string, primarySourceId: string, columns: TargetColumn[], partial: Partial<TargetTable> = {}): TargetTable {
  return {
    id,
    name,
    primarySourceId,
    columns,
    filter: null,
    distinct: false,
    store: { enabled: false, path: '' },
    keepInModel: true,
    qualify: false,
    ...partial,
  };
}

export function ref(tableId: string, fieldId: string): FieldRef {
  return { tableId, fieldId };
}

export function col(id: string, tableId: string, fieldId: string, alias: string | null = null): TargetColumn {
  return { id, kind: 'field', ref: ref(tableId, fieldId), alias };
}

export function link(id: string, type: LinkType, leftTableId: string, rightTableId: string, pairs: [string, string][], partial: Partial<Link> = {}): Link {
  return {
    id,
    type,
    leftTableId,
    rightTableId,
    pairs: pairs.map(([leftFieldId, rightFieldId]) => ({ leftFieldId, rightFieldId })),
    compositeKey: null,
    renameRightToLeft: false,
    applyMap: null,
    ...partial,
  };
}

export const dbConnection: Connection = { id: 'db1', name: 'SQL_Server', kind: 'database' };

/** Sales + Customers + Products, keys only, no targets. */
export function starSources(): SourceTable[] {
  return [
    source('s', 'Sales', 'qvd', [
      field('s-o', 'OrderID', { role: 'key', dataType: 'number', isUnique: true }),
      field('s-c', 'CustomerID', { role: 'key', dataType: 'number' }),
      field('s-p', 'ProductID', { role: 'key', dataType: 'number' }),
      field('s-d', 'OrderDate', { role: 'date', dataType: 'date' }),
      field('s-a', 'Amount', { role: 'measure', dataType: 'money' }),
    ]),
    source('c', 'Customers', 'qvd', [
      field('c-c', 'CustomerID', { role: 'key', dataType: 'number', isUnique: true }),
      field('c-n', 'Customer Name'),
      field('c-r', 'Region'),
    ]),
    source('p', 'Products', 'qvd', [
      field('p-p', 'ProductID', { role: 'key', dataType: 'number', isUnique: true }),
      field('p-n', 'Product Name'),
      field('p-r', 'Region'),
    ]),
  ];
}
