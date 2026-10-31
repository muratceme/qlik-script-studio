/**
 * The project model: the single source of truth that every screen edits and
 * that the generator turns into a Qlik load script.
 *
 * Rules:
 *  - Plain JSON only (no classes, no Dates, no functions) so it can be stored,
 *    exported and imported losslessly.
 *  - Ids are opaque strings; names are what end up in the script.
 *  - Everything under `canvas` is UI-only and is ignored by the generator.
 */

export const SCHEMA_VERSION = 1 as const;

/** Regional preset used for the SET variables at the top of the script. */
export type Locale = 'en' | 'tr';

/** Target product. Only affects path syntax and connection statements. */
export type Dialect = 'sense' | 'view';

export interface Project {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  settings: ProjectSettings;
  connections: Connection[];
  sources: SourceTable[];
  targets: TargetTable[];
  links: Link[];
  calendar: MasterCalendar | null;
  canvas: CanvasState;
}

export interface ProjectSettings {
  locale: Locale;
  dialect: Dialect;
  /** Emit `///$tab` section markers. */
  useTabs: boolean;
  /** Default folder for STORE statements, e.g. `lib://QVD/`. */
  qvdStorePath: string;
  /** DROP TABLE source tables that only feed targets / joins. */
  dropConsumedSources: boolean;
}

export type ConnectionKind = 'folder' | 'database';

export interface Connection {
  id: string;
  /** `lib://DataFiles` for folders, the data connection name for databases. */
  name: string;
  kind: ConnectionKind;
}

export type SourceKind = 'qvd' | 'excel' | 'csv' | 'sql' | 'inline';

export type CsvDelimiter = ',' | ';' | '\t' | '|';
export type CsvEncoding = 'utf8' | 'ansi' | 'unicode';

export interface ExcelOptions {
  sheet: string;
  /** 1-based header row. Rows above it are skipped with `header is N lines`. */
  headerRow: number;
}

export interface CsvOptions {
  delimiter: CsvDelimiter;
  encoding: CsvEncoding;
  hasHeader: boolean;
  /** Modern style quoting (`msq`). */
  msq: boolean;
}

export interface SqlOptions {
  /** Full SELECT statement. */
  query: string;
}

export interface InlineOptions {
  /** First row is the header row. */
  rows: string[][];
}

export interface SourceTable {
  id: string;
  name: string;
  kind: SourceKind;
  connectionId: string | null;
  /** File path relative to the connection, e.g. `Sales.qvd` or `2024/Sales.xlsx`. */
  path: string;
  excel: ExcelOptions | null;
  csv: CsvOptions | null;
  sql: SqlOptions | null;
  inline: InlineOptions | null;
  fields: Field[];
  /** When false the table may be dropped once targets and joins consumed it. */
  keepInModel: boolean;
  /** Wrap the load in QUALIFY * / UNQUALIFY keys (applied as a fix). */
  qualify: boolean;
  /** Preview rows from a sample file (UI only, header excluded). */
  sampleRows: string[][] | null;
}

export type FieldRole = 'dimension' | 'measure' | 'key' | 'date' | 'ignore';
export type DataType = 'text' | 'number' | 'date' | 'money';

export interface Field {
  id: string;
  /** Name as it appears in the source. */
  name: string;
  /** Output name (`AS [alias]`); null keeps the source name. */
  alias: string | null;
  role: FieldRole;
  dataType: DataType;
  /** For text dates: `Date(Date#([F], '<format>'))`. */
  dateFormat: string | null;
  /** Declared or detected unique values; drives fan-out warnings. */
  isUnique: boolean;
  /** Pending suggestion; nothing changes until the user accepts it. */
  suggestedRole: FieldRole | null;
}

export type Aggregation =
  'sum' | 'count' | 'countDistinct' | 'avg' | 'min' | 'max' | 'firstValue' | 'lastValue';

export interface FieldRef {
  tableId: string;
  fieldId: string;
}

export type TargetColumn =
  | {
      id: string;
      kind: 'field';
      ref: FieldRef;
      alias: string | null;
    }
  | {
      id: string;
      kind: 'measure';
      ref: FieldRef;
      aggregation: Aggregation;
      alias: string;
    }
  | {
      id: string;
      kind: 'calculated';
      alias: string;
      expr: Expr;
    };

export interface TargetTable {
  id: string;
  name: string;
  /** Table loaded RESIDENT. */
  primarySourceId: string | null;
  columns: TargetColumn[];
  filter: ConditionGroup | null;
  distinct: boolean;
  store: { enabled: boolean; path: string };
  keepInModel: boolean;
  qualify: boolean;
}

export type DatePart = 'year' | 'quarter' | 'month' | 'monthName' | 'week' | 'day' | 'weekday' | 'yearMonth';

export type ArithOp = '+' | '-' | '*' | '/';

export type Expr =
  | { kind: 'field'; ref: FieldRef }
  | { kind: 'literal'; value: string | number }
  | { kind: 'concat'; parts: Expr[]; separator: string }
  | { kind: 'arith'; op: ArithOp; left: Expr; right: Expr; safeDivide: boolean }
  | { kind: 'percent'; part: Expr; whole: Expr }
  | { kind: 'if'; condition: ConditionGroup; then: Expr; else: Expr | null }
  | { kind: 'datePart'; part: DatePart; of: Expr }
  | { kind: 'applyMap'; linkId: string; key: Expr }
  | { kind: 'autoNumber'; of: Expr; counterName: string | null }
  | { kind: 'raw'; text: string };

export type ConditionOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'startsWith'
  | 'isNull'
  | 'isNotNull'
  | 'between';

export interface Condition {
  id: string;
  kind: 'condition';
  left: Expr;
  op: ConditionOp;
  values: (string | number)[];
}

export interface ConditionGroup {
  id: string;
  kind: 'group';
  logic: 'and' | 'or';
  items: (Condition | ConditionGroup)[];
}

export type LinkType =
  | 'association'
  | 'leftJoin'
  | 'rightJoin'
  | 'innerJoin'
  | 'outerJoin'
  | 'leftKeep'
  | 'rightKeep'
  | 'innerKeep'
  | 'concatenate'
  | 'noConcatenate'
  | 'applyMap';

export interface FieldPair {
  leftFieldId: string;
  rightFieldId: string;
}

export type CompositeKeyMode = 'concat' | 'autoNumber';

export interface CompositeKey {
  mode: CompositeKeyMode;
  name: string;
  separator: string;
}

export interface ApplyMapOptions {
  /** Field on the right table that holds the lookup key. */
  keyFieldId: string;
  /** Field on the right table that holds the mapped value. */
  valueFieldId: string;
  defaultValue: string | null;
  /** Name of the MAPPING LOAD table. */
  mapName: string;
  /** Name of the new field added to the left table. */
  outputName: string;
}

export interface Link {
  id: string;
  type: LinkType;
  /** For JOIN / KEEP / CONCATENATE: the table merged *into*. */
  leftTableId: string;
  /** The table loaded RESIDENT and merged, or the mapping source for applyMap. */
  rightTableId: string;
  pairs: FieldPair[];
  compositeKey: CompositeKey | null;
  /** For associations: give the right field the left field's name. */
  renameRightToLeft: boolean;
  applyMap: ApplyMapOptions | null;
}

export interface MasterCalendar {
  enabled: boolean;
  tableName: string;
  dateField: FieldRef | null;
  parts: DatePart[];
}

export interface CanvasState {
  positions: Record<string, { x: number; y: number }>;
}

/** Any table the generator can reference (source or target). */
export type AnyTable = SourceTable | TargetTable;

export function isSourceTable(table: AnyTable): table is SourceTable {
  return 'kind' in table;
}

export const AGGREGATIONS: readonly Aggregation[] = [
  'sum',
  'count',
  'countDistinct',
  'avg',
  'min',
  'max',
  'firstValue',
  'lastValue',
];

export const FIELD_ROLES: readonly FieldRole[] = ['dimension', 'measure', 'key', 'date', 'ignore'];
export const DATA_TYPES: readonly DataType[] = ['text', 'number', 'date', 'money'];
export const SOURCE_KINDS: readonly SourceKind[] = ['qvd', 'excel', 'csv', 'sql', 'inline'];
export const LINK_TYPES: readonly LinkType[] = [
  'association',
  'leftJoin',
  'rightJoin',
  'innerJoin',
  'outerJoin',
  'leftKeep',
  'rightKeep',
  'innerKeep',
  'concatenate',
  'noConcatenate',
  'applyMap',
];
export const CONDITION_OPS: readonly ConditionOp[] = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'notIn',
  'contains',
  'startsWith',
  'isNull',
  'isNotNull',
  'between',
];
export const DATE_PARTS: readonly DatePart[] = [
  'year',
  'quarter',
  'month',
  'monthName',
  'week',
  'day',
  'weekday',
  'yearMonth',
];
