---
name: qlik-load-script-builder
description: Generates Qlik Sense / QlikView load scripts (LOAD, QVD, Excel, CSV, SQL, inline, join, keep, concatenate, ApplyMap, GROUP BY, WHERE, calculated fields, master calendar, STORE, synthetic key and circular reference fixes) from a user's table and field definitions, using the same deterministic rules as the Script Studio for Qlik app.
---

# Qlik load script builder

Use this skill when someone describes source tables, fields and the final tables
they want, and needs a **valid, readable Qlik load script**. Follow the rules
below exactly; they are the rules implemented in `src/generator` of
[Script Studio for Qlik](https://github.com/muratceme/qlik-script-studio), so a
script you write by hand and a script the app generates for the same model are
interchangeable.

Workflow:

1. Turn the user's description into a **project model** (JSON, schema below).
   Ask only for what the model needs: table names, source kind and path, field
   names and roles, joins, aggregations, filters, calendar, STORE.
2. Validate it against the **validation rules**. Report errors in plain
   language and fix them with the user before writing any script.
3. Emit the script section by section following the **generation rules**.
4. Run the **data-model analysis** and list warnings with their one-click fixes.
5. Check the output against the **syntax checklist**.

The model JSON can be pasted into the app (Import JSON) and the app can export
the same JSON, so always offer the JSON alongside the script.

## 1. Project model (JSON schema)

All ids are opaque strings, unique across the whole project. Names are what
end up in the script. `canvas` is UI-only and never affects the script.

```ts
interface Project {
  schemaVersion: 1;
  id: string;
  name: string;
  settings: {
    locale: 'en' | 'tr'; // regional SET variables preset
    dialect: 'sense' | 'view'; // lib:// paths + LIB CONNECT TO, or plain paths + CONNECT TO
    useTabs: boolean; // emit ///$tab section markers
    qvdStorePath: string; // default STORE folder, e.g. "lib://QVD/"
    dropConsumedSources: boolean; // DROP source tables that only feed targets / joins
  };
  connections: { id: string; name: string; kind: 'folder' | 'database' }[];
  sources: SourceTable[];
  targets: TargetTable[];
  links: Link[];
  calendar: MasterCalendar | null;
  canvas: { positions: Record<string, { x: number; y: number }> };
}

interface SourceTable {
  id: string;
  name: string;
  kind: 'qvd' | 'excel' | 'csv' | 'sql' | 'inline';
  connectionId: string | null; // folder connection for files, database for sql
  path: string; // relative to the connection: "Sales.qvd", "2024/Sales.xlsx"
  excel: { sheet: string; headerRow: number } | null; // headerRow is 1-based
  csv: {
    delimiter: ',' | ';' | '\t' | '|';
    encoding: 'utf8' | 'ansi' | 'unicode';
    hasHeader: boolean;
    msq: boolean;
  } | null;
  sql: { query: string } | null; // full SELECT statement
  inline: { rows: string[][] } | null; // rows[0] is the header row
  fields: Field[];
  keepInModel: boolean; // false => dropped once consumed (see cleanup rules)
  qualify: boolean; // wrap the load in QUALIFY * / UNQUALIFY keys
  sampleRows: string[][] | null; // UI preview only
}

interface Field {
  id: string;
  name: string; // name in the source
  alias: string | null; // output name (AS [alias])
  role: 'dimension' | 'measure' | 'key' | 'date' | 'ignore'; // ignore => not loaded
  dataType: 'text' | 'number' | 'date' | 'money';
  dateFormat: string | null; // text dates: Date(Date#([F], '<format>')) (not for qvd)
  isUnique: boolean; // declared unique; used by the fan-out warning
  suggestedRole: FieldRole | null; // pending suggestion, no effect on the script
}

interface TargetTable {
  id: string;
  name: string;
  primarySourceId: string | null; // table loaded RESIDENT (a source or another target)
  columns: TargetColumn[];
  filter: ConditionGroup | null; // WHERE
  distinct: boolean; // LOAD DISTINCT
  store: { enabled: boolean; path: string }; // STORE ... INTO ... (qvd); empty path => qvdStorePath + name + ".qvd"
  keepInModel: boolean; // false => DROP TABLE at the end
  qualify: boolean;
}

type TargetColumn =
  | { id: string; kind: 'field'; ref: FieldRef; alias: string | null }
  | { id: string; kind: 'measure'; ref: FieldRef; aggregation: Aggregation; alias: string }
  | { id: string; kind: 'calculated'; alias: string; expr: Expr };

type Aggregation = 'sum' | 'count' | 'countDistinct' | 'avg' | 'min' | 'max' | 'firstValue' | 'lastValue';
interface FieldRef {
  tableId: string;
  fieldId: string;
} // fieldId may be a target column id when tableId is a target

type Expr =
  | { kind: 'field'; ref: FieldRef }
  | { kind: 'literal'; value: string | number }
  | { kind: 'concat'; parts: Expr[]; separator: string }
  | { kind: 'arith'; op: '+' | '-' | '*' | '/'; left: Expr; right: Expr; safeDivide: boolean }
  | { kind: 'percent'; part: Expr; whole: Expr }
  | { kind: 'if'; condition: ConditionGroup; then: Expr; else: Expr | null }
  | { kind: 'datePart'; part: DatePart; of: Expr }
  | { kind: 'applyMap'; linkId: string; key: Expr } // linkId of an applyMap link
  | { kind: 'autoNumber'; of: Expr; counterName: string | null }
  | { kind: 'raw'; text: string }; // written as-is

type DatePart = 'year' | 'quarter' | 'month' | 'monthName' | 'week' | 'day' | 'weekday' | 'yearMonth';

interface Condition {
  id: string;
  kind: 'condition';
  left: Expr;
  op: ConditionOp;
  values: (string | number)[];
}
interface ConditionGroup {
  id: string;
  kind: 'group';
  logic: 'and' | 'or';
  items: (Condition | ConditionGroup)[];
}
type ConditionOp =
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

interface Link {
  id: string;
  type:
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
  leftTableId: string; // table merged INTO (JOIN/KEEP/CONCATENATE target); for applyMap: table that gets the new field
  rightTableId: string; // table loaded RESIDENT and merged; for applyMap: the mapping source
  pairs: { leftFieldId: string; rightFieldId: string }[]; // matching fields (1..n); for applyMap pairs[0].leftFieldId is the lookup key
  compositeKey: { mode: 'concat' | 'autoNumber'; name: string; separator: string } | null; // active when pairs >= 2
  renameRightToLeft: boolean; // association: alias the right field to the left field's name
  applyMap: {
    keyFieldId: string;
    valueFieldId: string;
    defaultValue: string | null;
    mapName: string;
    outputName: string;
  } | null;
}

interface MasterCalendar {
  enabled: boolean;
  tableName: string;
  dateField: FieldRef | null;
  parts: DatePart[];
}
```

## 2. Generation rules

### 2.1 Layout and ordering

Sections, in this order; empty sections are omitted:

| Section     | Content                                                                          |
| ----------- | -------------------------------------------------------------------------------- |
| `Main`      | header comments, regional `SET` variables                                        |
| `Sources`   | one load per source table; a `MAPPING LOAD` right after the source that feeds it |
| `Transform` | targets and merge links (join / keep / concatenate) in dependency order          |
| `Calendar`  | master calendar                                                                  |
| `Store`     | `STORE` statements                                                               |
| `Cleanup`   | `DROP TABLE` for consumed tables                                                 |

With `useTabs` each section starts with `///$tab <Name>`; otherwise with
`// ========== <Name> ==========`. Every statement block is preceded by a
one-line `//` comment. Never emit dates, times or random values: the same
model must always produce the same script.

Ordering within sections:

- Sources: model order, except that a table feeding a `MAPPING LOAD` comes
  before the tables whose loads use `ApplyMap()` on it.
- Transform: a stable topological order. A merge link runs after both of its
  tables exist. A target runs after its primary table and after every merge
  link **into** its primary table (except a link that merges the target itself
  into that table). Ties keep model order, targets before links. A cycle is the
  error `CYCLIC_DEPENDENCY`.

### 2.2 Regional presets (Main)

`locale: 'en'`:

```
SET ThousandSep=','; SET DecimalSep='.'; SET MoneyThousandSep=','; SET MoneyDecimalSep='.';
SET MoneyFormat='$#,##0.00;-$#,##0.00'; SET TimeFormat='h:mm:ss TT'; SET DateFormat='M/D/YYYY';
SET TimestampFormat='M/D/YYYY h:mm:ss[.fff] TT'; SET FirstWeekDay=6; SET BrokenWeeks=1; SET ReferenceDay=0;
SET FirstMonthOfYear=1; SET CollationLocale='en-US'; + MonthNames, LongMonthNames, DayNames, LongDayNames (English)
```

`locale: 'tr'`:

```
SET ThousandSep='.'; SET DecimalSep=','; SET MoneyThousandSep='.'; SET MoneyDecimalSep=',';
SET MoneyFormat='#.##0,00 ₺;-#.##0,00 ₺'; SET TimeFormat='hh:mm:ss'; SET DateFormat='DD.MM.YYYY';
SET TimestampFormat='DD.MM.YYYY hh:mm:ss[.fff]'; SET FirstWeekDay=0; SET BrokenWeeks=0; SET ReferenceDay=4;
SET FirstMonthOfYear=1; SET CollationLocale='tr-TR'; + Turkish month and day names
```

One `SET` per line.

### 2.3 Names, strings, paths

- A table or field name is written bare only when it matches
  `^[A-Za-z_][A-Za-z0-9_]*$` **and** is not a Qlik keyword (load, from,
  resident, where, group, by, as, and, or, not, join, keep, left, right, inner,
  outer, concatenate, mapping, drop, table, store, into, set, let, distinct,
  order, if, then, else, end, sql, select, qualify, unqualify, rename, field, to,
  first, sample, null, like, exists, ...). Otherwise wrap it in `[...]`.
  Names may not contain `]` or line breaks.
- String literals use single quotes; a quote inside is doubled: `'O''Brien'`.
- Numbers use `.` as decimal separator regardless of locale.
- File paths are always bracketed: `[lib://DataFiles/Sales.qvd]`. The path is
  `<connection name>/<path>` for Sense; for QlikView a connection containing
  `\` is joined with `\`.
- In `LOAD` column lists, align the `AS` keywords of the block in one column.

### 2.4 Source loads

Column list: every field whose role is not `ignore`, in model order, as
`<expr> AS <output name>` (omit `AS` when identical). Output name =
`alias ?? name`, or the left field's name when an association link with
`renameRightToLeft` targets this field. `dateFormat` on a non-QVD source gives
`Date(Date#([F], 'fmt')) AS [F]`. No fields at all => `LOAD *`.

Extra columns appended to a table's own load because of links:

- composite key (`pairs >= 2`, `compositeKey` set) on a table that is the
  **left** side of any link, or the **right** side of an association:
  `[A] & '|' & [B] AS [%Key]` (`concat`) or
  `AutoNumber([A] & '|' & [B], '%Key') AS [%Key]` (`autoNumber`). On the right
  side of an association the original pair fields are left out of the load.
- `applyMap` link with this table on the left:
  `ApplyMap('Map_Name', [KeyField], 'default') AS [OutputName]`
  (no third argument when `defaultValue` is null).

Prefix `NoConcatenate` when the table is on either side of a `noConcatenate`
link. Wrap in `QUALIFY *;` + `UNQUALIFY <key fields, composite keys, pair fields>;`
... `UNQUALIFY *;` when `qualify` is true.

Per kind:

```
// Sales (QVD)
Sales:
LOAD ... FROM [lib://DataFiles/Sales.qvd] (qvd);

// Customers (Excel)         .xlsx => ooxml, .xls => biff + sheet name with $
FROM [lib://DataFiles/Customers.xlsx] (ooxml, embedded labels, header is 2 lines, table is [Sheet Name]);
                             "header is N lines" only when headerRow > 1 (N = headerRow - 1)

// Products (CSV)            encoding utf8 | unicode | "codepage is 1252" (en) / 1254 (tr) for ansi
FROM [lib://DataFiles/Products.csv] (txt, utf8, embedded labels, delimiter is ';', msq);
                             hasHeader=false => "no labels" and columns are @1, @2 ... AS [Name]; tab => delimiter is '\t'

// Orders (SQL)              LIB CONNECT TO 'Conn'; (QlikView: CONNECT TO) directly before the load
LIB CONNECT TO 'SQL_Server';
Orders:
LOAD
    ID,
    Amount AS [Sales Amount];
SQL SELECT ID, Amount FROM dbo.Orders;        (no fields => LOAD *;)

// Regions (Inline)          preceding LOAD only when a column is renamed/parsed/added
Regions:
LOAD * INLINE [
Code, Name
TR, Türkiye
US, "United States, of America"              values containing , or " are double-quoted
];
```

Mapping tables, emitted right after the source they read:

```
// Mapping Map_Region: RegionCode -> RegionName
Map_Region:
MAPPING LOAD
    RegionCode,
    RegionName
RESIDENT Regions;
```

### 2.5 Targets

```
// Fact_Sales (from Sales)
Fact_Sales:
NoConcatenate
LOAD [DISTINCT]
    <columns>
RESIDENT Sales
[WHERE <filter>]
[GROUP BY <every non-aggregated column expression, in column order>];
```

- Always `NoConcatenate`; a resident load with the same field set would
  otherwise be appended to the primary table.
- Column text: `field` => `[name]` (`AS alias` when set); `measure` =>
  `Sum(x)`, `Count(x)`, `Count(DISTINCT x)`, `Avg(x)`, `Min(x)`, `Max(x)`,
  `FirstValue(x)`, `LastValue(x)` + `AS alias`; `calculated` => expression +
  `AS alias`. Extra columns from links (composite key, ApplyMap output) are
  appended and grouped.
- `GROUP BY` appears only when at least one `measure` column exists, and lists
  **expressions** (not aliases) of every non-measure column.
- Fields of a table other than the primary are addressable only when a join or
  concatenate link merges that table into the primary (error
  `FIELD_NOT_REACHABLE` otherwise). Pair fields of the merged table are
  referenced by the primary side's name.
- Filter rendering, with `AND`/`OR` in upper case, nested groups in parentheses
  and the outermost group bare:

| op                             | text                                                                    |
| ------------------------------ | ----------------------------------------------------------------------- |
| eq / neq / gt / gte / lt / lte | `[F] = v`, `<>`, `>`, `>=`, `<`, `<=`                                   |
| in / notIn                     | `Match([F], v1, v2) > 0` / `Match([F], v1) = 0`                         |
| contains                       | `Index([F], 'x') > 0`                                                   |
| startsWith                     | `WildMatch([F], 'x*') > 0`                                              |
| isNull / isNotNull             | `Len(Trim([F])) = 0` / `> 0`                                            |
| between                        | `[F] >= a AND [F] <= b` (parenthesised inside a group with other items) |

- Expression rendering:

| kind       | text                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| concat     | `A & 'sep' & B` (`A & B` when separator is empty)                                                                                      |
| arith      | `(A op B)`; division with `safeDivide` => `If(B <> 0, A / B)`                                                                          |
| percent    | `A / B * 100`                                                                                                                          |
| if         | `If(cond, then, else)` / `If(cond, then)`; empty condition => `1 = 1`                                                                  |
| datePart   | `Year(x)`, `'Q' & Ceil(Month(x) / 3)`, `Month(x)`, `MonthName(x)`, `Week(x)`, `Day(x)`, `WeekDay(x)`, `Date(MonthStart(x), 'YYYY-MM')` |
| applyMap   | `ApplyMap('Map', key, 'default')`                                                                                                      |
| autoNumber | `AutoNumber(x, 'counter')` / `AutoNumber(x)`                                                                                           |
| raw        | the text, trimmed                                                                                                                      |

### 2.6 Links (Transform)

Every merge statement loads the right table `RESIDENT` into the left one with
this column list: the composite key expression (when active, replacing the pair
fields), then each pair field as `[right] AS [left]` (omit `AS` when equal),
then all other non-ignored fields of the right table.

```
// Left join: Customers -> Sales on CustomerID = CustID
LEFT JOIN (Sales)                            prefixes: LEFT JOIN, RIGHT JOIN, INNER JOIN, OUTER JOIN
LOAD
    CustID AS CustomerID,
    [Customer Name]
RESIDENT Customers;

// Left keep: Customers -> Sales on CustomerID
Customers_keep:                               LEFT KEEP, RIGHT KEEP, INNER KEEP; KEEP would silently concatenate onto the original,
NoConcatenate                                 so load into a temp name, drop and rename
LEFT KEEP (Sales)
LOAD ... RESIDENT Customers;
DROP TABLE Customers;
RENAME TABLE Customers_keep TO Customers;

// Concatenate: Sales2024 -> Sales2023
CONCATENATE (Sales2023)
LOAD ... RESIDENT Sales2024;
```

`association` and `noConcatenate` emit nothing here (they only change the
loads), `applyMap` emits the mapping table and the mapped column (2.4).

### 2.7 Master calendar

```
// Master calendar for Sales.OrderDate
Calendar_Range:
LOAD
    Min(Floor(OrderDate)) AS MinDate,
    Max(Floor(OrderDate)) AS MaxDate
RESIDENT Sales;

LET vMinDate = Num(Peek('MinDate', 0, 'Calendar_Range'));
LET vMaxDate = Num(Peek('MaxDate', 0, 'Calendar_Range'));
DROP TABLE Calendar_Range;

Calendar:
LOAD
    OrderDate,
    Year(OrderDate) AS Year,                  one line per part, field names:
    ...                                       Year, Quarter, Month, MonthName, Week, Day, WeekDay, YearMonth
;
LOAD
    Date($(vMinDate) + IterNo() - 1) AS OrderDate
AUTOGENERATE 1
WHILE $(vMinDate) + IterNo() - 1 <= $(vMaxDate);

LET vMinDate = Null();
LET vMaxDate = Null();
```

### 2.8 Store and cleanup

- `STORE [Target] INTO [path] (qvd);` with `path = store.path` or
  `qvdStorePath + name + '.qvd'`.
- A source is **consumed** when it is the primary of a target or the right side
  of a join, concatenate or applyMap link. Keep and association do not consume.
- Cleanup drops, in model order: sources with `keepInModel=false` that are
  consumed (only if `dropConsumedSources`), then targets with
  `keepInModel=false`. Never drop a table nothing consumed.

## 3. Validation (errors, no script)

| Code                                                                                                     | Meaning                                                                                                |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| EMPTY_PROJECT                                                                                            | no source tables                                                                                       |
| DUPLICATE_TABLE_NAME                                                                                     | two tables (incl. mapping tables and the calendar) share a name, case-insensitive                      |
| DUPLICATE_FIELD_NAME                                                                                     | two output names in one table                                                                          |
| INVALID_NAME / EMPTY_NAME                                                                                | name contains `]` or a line break / is blank                                                           |
| SOURCE_PATH_MISSING / SOURCE_CONNECTION_MISSING / EXCEL_SHEET_MISSING / SQL_QUERY_MISSING / INLINE_EMPTY | incomplete source                                                                                      |
| TARGET_NO_COLUMNS / TARGET_PRIMARY_MISSING                                                               | incomplete target                                                                                      |
| FIELD_NOT_FOUND                                                                                          | a reference points to a field or column that does not exist                                            |
| FIELD_NOT_REACHABLE                                                                                      | target uses a field of a table not merged into its primary (fix: create a left join on the common key) |
| FIELD_IGNORED                                                                                            | target uses a field whose role is `ignore` (fix: set the role to dimension)                            |
| LINK_NO_PAIRS / LINK_SELF / LINK_TABLE_MISSING / APPLYMAP_FIELDS_MISSING                                 | incomplete link                                                                                        |
| CALENDAR_DATE_MISSING                                                                                    | calendar enabled without a date field                                                                  |
| CYCLIC_DEPENDENCY                                                                                        | targets and links depend on each other in a loop                                                       |
| RAW_EXPRESSION_EMPTY                                                                                     | a raw expression is blank                                                                              |

## 4. Data-model analysis (warnings with fixes)

Computed on the tables that **survive** cleanup, using their final field names
(own fields plus fields brought in by joins / concatenations).

| Code                         | Condition                                                                                                                          | Fixes offered                                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| SYNTHETIC_KEY                | two surviving tables share 2+ field names                                                                                          | rename each extra field to `<Field>_<Table>` (alias), QUALIFY the second table, composite key when a link with 2+ pairs exists |
| CIRCULAR_REFERENCE           | a cycle of 3+ tables connected by shared field names                                                                               | rename a shared non-key field, QUALIFY                                                                                         |
| KEY_TYPE_MISMATCH            | paired fields have different data types (money = number)                                                                           | —                                                                                                                              |
| JOIN_FANOUT_RISK             | the looked-up side of a join (right for left/inner/outer, left for right join) has a key that is neither `isUnique` nor role `key` | mark the field as key                                                                                                          |
| JOIN_UNINTENDED_COMMON_FIELD | besides the pairs, both join tables share other field names                                                                        | rename them on the right table                                                                                                 |
| IMPLICIT_CONCATENATE         | two surviving sources have identical field sets and no concatenate/noConcatenate link                                              | create a noConcatenate or concatenate link                                                                                     |
| DROPPED_TABLE_REFERENCED     | the calendar's date table is dropped at the end                                                                                    | keep the table                                                                                                                 |

## 5. Syntax checklist

- [ ] Every statement ends with `;`; a `LOAD ... RESIDENT X;` has no trailing comma.
- [ ] Names with spaces, special characters, leading digits or keywords are in `[...]`.
- [ ] Mapping tables are defined before the first `ApplyMap()` that uses them.
- [ ] `GROUP BY` lists every non-aggregated expression of the load.
- [ ] Joins, keeps and concatenations use `PREFIX (Target) LOAD ... RESIDENT Source;` and keys are aliased to the target's names.
- [ ] Keep uses a temporary table + `DROP` + `RENAME` so it does not auto-concatenate.
- [ ] Resident-built tables are `NoConcatenate` and consumed temporary tables are dropped at the end.
- [ ] Tables with identical field sets are either concatenated on purpose or loaded `NoConcatenate`.
- [ ] `STORE ... INTO [...] (qvd);` paths are bracketed.
- [ ] Regional `SET` variables match the chosen locale.
- [ ] No synthetic keys or circular references remain unexplained.

## 6. Example

### Input (project JSON)

```json
{
  "schemaVersion": 1,
  "id": "example",
  "name": "Sales example",
  "settings": {
    "locale": "en",
    "dialect": "sense",
    "useTabs": true,
    "qvdStorePath": "lib://QVD/",
    "dropConsumedSources": true
  },
  "connections": [
    {
      "id": "conn",
      "name": "lib://DataFiles",
      "kind": "folder"
    }
  ],
  "sources": [
    {
      "id": "sales",
      "name": "Sales",
      "kind": "qvd",
      "connectionId": "conn",
      "path": "Sales.qvd",
      "excel": null,
      "csv": null,
      "sql": null,
      "inline": null,
      "keepInModel": false,
      "qualify": false,
      "sampleRows": null,
      "fields": [
        {
          "id": "s1",
          "name": "OrderID",
          "alias": null,
          "role": "key",
          "dataType": "number",
          "dateFormat": null,
          "isUnique": true,
          "suggestedRole": null
        },
        {
          "id": "s2",
          "name": "OrderDate",
          "alias": null,
          "role": "date",
          "dataType": "date",
          "dateFormat": null,
          "isUnique": false,
          "suggestedRole": null
        },
        {
          "id": "s3",
          "name": "CustomerID",
          "alias": null,
          "role": "key",
          "dataType": "number",
          "dateFormat": null,
          "isUnique": false,
          "suggestedRole": null
        },
        {
          "id": "s4",
          "name": "Sales Amount",
          "alias": null,
          "role": "measure",
          "dataType": "money",
          "dateFormat": null,
          "isUnique": false,
          "suggestedRole": null
        },
        {
          "id": "s5",
          "name": "Status",
          "alias": null,
          "role": "dimension",
          "dataType": "text",
          "dateFormat": null,
          "isUnique": false,
          "suggestedRole": null
        }
      ]
    },
    {
      "id": "cust",
      "name": "Customers",
      "kind": "excel",
      "connectionId": "conn",
      "path": "Customers.xlsx",
      "excel": {
        "sheet": "Customers",
        "headerRow": 1
      },
      "csv": null,
      "sql": null,
      "inline": null,
      "keepInModel": false,
      "qualify": false,
      "sampleRows": null,
      "fields": [
        {
          "id": "c1",
          "name": "CustID",
          "alias": null,
          "role": "key",
          "dataType": "number",
          "dateFormat": null,
          "isUnique": true,
          "suggestedRole": null
        },
        {
          "id": "c2",
          "name": "Customer Name",
          "alias": null,
          "role": "dimension",
          "dataType": "text",
          "dateFormat": null,
          "isUnique": false,
          "suggestedRole": null
        },
        {
          "id": "c3",
          "name": "Country",
          "alias": null,
          "role": "dimension",
          "dataType": "text",
          "dateFormat": null,
          "isUnique": false,
          "suggestedRole": null
        }
      ]
    }
  ],
  "targets": [
    {
      "id": "fact",
      "name": "Fact_Sales",
      "primarySourceId": "sales",
      "distinct": false,
      "store": {
        "enabled": true,
        "path": ""
      },
      "keepInModel": true,
      "qualify": false,
      "filter": {
        "id": "f",
        "kind": "group",
        "logic": "and",
        "items": [
          {
            "id": "f1",
            "kind": "condition",
            "left": {
              "kind": "field",
              "ref": {
                "tableId": "sales",
                "fieldId": "s5"
              }
            },
            "op": "neq",
            "values": ["Cancelled"]
          }
        ]
      },
      "columns": [
        {
          "id": "k0",
          "kind": "field",
          "ref": {
            "tableId": "sales",
            "fieldId": "s2"
          },
          "alias": null
        },
        {
          "id": "k1",
          "kind": "field",
          "ref": {
            "tableId": "sales",
            "fieldId": "s3"
          },
          "alias": null
        },
        {
          "id": "k2",
          "kind": "field",
          "ref": {
            "tableId": "cust",
            "fieldId": "c3"
          },
          "alias": null
        },
        {
          "id": "m1",
          "kind": "measure",
          "ref": {
            "tableId": "sales",
            "fieldId": "s4"
          },
          "aggregation": "sum",
          "alias": "Total Sales"
        },
        {
          "id": "m2",
          "kind": "measure",
          "ref": {
            "tableId": "sales",
            "fieldId": "s1"
          },
          "aggregation": "countDistinct",
          "alias": "Order Count"
        }
      ]
    }
  ],
  "links": [
    {
      "id": "j1",
      "type": "leftJoin",
      "leftTableId": "sales",
      "rightTableId": "cust",
      "pairs": [
        {
          "leftFieldId": "s3",
          "rightFieldId": "c1"
        }
      ],
      "compositeKey": null,
      "renameRightToLeft": false,
      "applyMap": null
    }
  ],
  "calendar": {
    "enabled": true,
    "tableName": "Calendar",
    "dateField": {
      "tableId": "fact",
      "fieldId": "k0"
    },
    "parts": ["year", "quarter", "month"]
  },
  "canvas": {
    "positions": {}
  }
}
```

### Output (generated script)

```qlik
///$tab Main
// Generated by Script Studio for Qlik (https://github.com/muratceme/qlik-script-studio)
// Project: Sales example
// This script is generated from a visual model. Edit the model and regenerate instead of editing by hand.

// Regional settings (EN)
SET ThousandSep=',';
SET DecimalSep='.';
SET MoneyThousandSep=',';
SET MoneyDecimalSep='.';
SET MoneyFormat='$#,##0.00;-$#,##0.00';
SET TimeFormat='h:mm:ss TT';
SET DateFormat='M/D/YYYY';
SET TimestampFormat='M/D/YYYY h:mm:ss[.fff] TT';
SET FirstWeekDay=6;
SET BrokenWeeks=1;
SET ReferenceDay=0;
SET FirstMonthOfYear=1;
SET CollationLocale='en-US';
SET MonthNames='Jan;Feb;Mar;Apr;May;Jun;Jul;Aug;Sep;Oct;Nov;Dec';
SET LongMonthNames='January;February;March;April;May;June;July;August;September;October;November;December';
SET DayNames='Mon;Tue;Wed;Thu;Fri;Sat;Sun';
SET LongDayNames='Monday;Tuesday;Wednesday;Thursday;Friday;Saturday;Sunday';

///$tab Sources
// Sales (QVD)
Sales:
LOAD
    OrderID,
    OrderDate,
    CustomerID,
    [Sales Amount],
    Status
FROM [lib://DataFiles/Sales.qvd] (qvd);

// Customers (Excel)
Customers:
LOAD
    CustID,
    [Customer Name],
    Country
FROM [lib://DataFiles/Customers.xlsx] (ooxml, embedded labels, table is Customers);

///$tab Transform
// Left join: Customers -> Sales on CustomerID = CustID
LEFT JOIN (Sales)
LOAD
    CustID AS CustomerID,
    [Customer Name],
    Country
RESIDENT Customers;

// Fact_Sales (from Sales)
Fact_Sales:
NoConcatenate
LOAD
    OrderDate,
    CustomerID,
    Country,
    Sum([Sales Amount])     AS [Total Sales],
    Count(DISTINCT OrderID) AS [Order Count]
RESIDENT Sales
WHERE Status <> 'Cancelled'
GROUP BY OrderDate, CustomerID, Country;

///$tab Calendar
// Master calendar for Fact_Sales.OrderDate
Calendar_Range:
LOAD
    Min(Floor(OrderDate)) AS MinDate,
    Max(Floor(OrderDate)) AS MaxDate
RESIDENT Fact_Sales;

LET vMinDate = Num(Peek('MinDate', 0, 'Calendar_Range'));
LET vMaxDate = Num(Peek('MaxDate', 0, 'Calendar_Range'));
DROP TABLE Calendar_Range;

Calendar:
LOAD
    OrderDate,
    Year(OrderDate)                  AS Year,
    'Q' & Ceil(Month(OrderDate) / 3) AS Quarter,
    Month(OrderDate)                 AS Month
;
LOAD
    Date($(vMinDate) + IterNo() - 1) AS OrderDate
AUTOGENERATE 1
WHILE $(vMinDate) + IterNo() - 1 <= $(vMaxDate);

LET vMinDate = Null();
LET vMaxDate = Null();

///$tab Store
// Store Fact_Sales as QVD
STORE Fact_Sales INTO [lib://QVD/Fact_Sales.qvd] (qvd);

///$tab Cleanup
// Drop temporary tables that were only used to build the final model
DROP TABLE Sales;
DROP TABLE Customers;
```
