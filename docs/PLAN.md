# Qlik Script Studio – Implementation Plan

> Status: all four phases are implemented. This document is kept as the design
> reference; where the implementation deviates from the original plan the text
> below has been updated to match the code.

A browser-only (no backend) web app that lets Qlik Sense / QlikView users build a
load script **without writing code**. Published as open source (MIT) and deployed
to GitHub Pages. Also ships a Claude Skill that generates scripts with the same
rules.

> Repository language policy: everything committed to this repository (code,
> comments, docs, commit messages, tests, sample data) is **English**. The only
> Turkish content is the `tr.json` UI translation file, which is a feature of
> the app (TR/EN interface), not documentation.

---

## 1. Architecture

```
            ┌──────────────────────────────┐
            │  UI (React, Zustand store)   │   edits a single typed JSON
            └──────────────┬───────────────┘
                           │  Project (model/types.ts)
                           ▼
   ┌───────────────────────────────────────────────┐
   │ src/generator  (pure, deterministic, no React) │
   │  validateModel(project)  -> Diagnostic[]       │
   │  analyzeModel(project)   -> Warning[]          │
   │  generateScript(project, options) -> string    │
   └───────────────────────────────────────────────┘
```

Core rules:

- **One model.** Every screen reads/writes the same `Project` object.
- **Pure generator.** `generateScript(model)` has no side effects, no
  `Date.now()`, no randomness, no DOM. Same input ⇒ byte-identical output.
- **Generator has no UI language.** Diagnostics carry a `code` and `params`;
  the UI translates them (TR/EN). The generator never contains Turkish or
  English prose except for the English comments it emits into the script.
- **Canvas layout is UI-only.** Node positions live in `project.canvas` and
  are ignored by the generator.

---

## 2. Tech stack

| Concern                                       | Choice                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Build / framework                             | Vite 6, React 19, TypeScript (`strict`, `noUncheckedIndexedAccess`)                                                  |
| Styling                                       | Tailwind CSS 4, CSS variables for light/dark theme                                                                   |
| Relationship canvas                           | `@xyflow/react` (React Flow)                                                                                         |
| Drag & drop (target designer, field ordering) | `@dnd-kit/core`, `@dnd-kit/sortable`                                                                                 |
| Sample file parsing                           | `papaparse` (CSV, preview rows only), `xlsx` (SheetJS, header + first N rows only)                                   |
| Script preview                                | `@codemirror/view`, `@codemirror/state`, `@codemirror/language` with a small custom `StreamLanguage` for Qlik script |
| State                                         | `zustand` + `persist` (localStorage) + `zundo` (undo/redo)                                                           |
| Schema / validation of imported JSON          | `zod`                                                                                                                |
| i18n                                          | `i18next` + `react-i18next`, `en.json` and `tr.json`                                                                 |
| Icons                                         | `lucide-react`                                                                                                       |
| Tests                                         | `vitest` (+ `@testing-library/react` for a few UI smoke tests)                                                       |
| Lint / format                                 | ESLint (typescript-eslint, react-hooks), Prettier                                                                    |
| CI / deploy                                   | GitHub Actions: test + build on every push/PR, deploy to GitHub Pages from `main`                                    |

---

## 3. Folder structure

```
qlik-script-studio/
├── .github/workflows/ci.yml           # lint, typecheck, test, build, deploy Pages
├── docs/PLAN.md                       # this document
├── skills/qlik-load-script-builder/
│   └── SKILL.md                       # Claude Skill (schema + rules + example)
├── public/                            # favicon, sample files for "Load sample"
├── src/
│   ├── main.tsx
│   ├── app/                           # App shell: tabs, header, theme, layout
│   │   ├── App.tsx
│   │   ├── AppHeader.tsx              # project name, undo/redo, import/export, theme, language
│   │   ├── TabModelBuilder.tsx        # wizard (steps 1–3) + script pane
│   │   └── TabRelations.tsx           # React Flow canvas + script pane
│   ├── components/ui/                 # Button, Input, Select, Dialog, Tabs, Tooltip,
│   │                                  # Badge, EmptyState, Stepper, Toast …
│   ├── features/
│   │   ├── sources/                   # Step 1: source tables and fields
│   │   ├── roles/                     # Step 2: field roles, bulk edit, suggestions
│   │   ├── targets/                   # Step 3: target designer (dnd, aggregations,
│   │   │                              #   filters, calculated fields, calendar, store, preview)
│   │   ├── relations/                 # Tab 2: canvas nodes/edges, link editor, warnings
│   │   ├── script/                    # CodeMirror preview, copy, download .qvs, tab toggle
│   │   └── project/                   # import/export JSON, sample project, settings dialog
│   ├── generator/                     # PURE – no React imports allowed (lint rule)
│   │   ├── index.ts                   # generateScript, validateModel, analyzeModel
│   │   ├── validate.ts                # structural errors (block script generation)
│   │   ├── analyze.ts                 # synthetic keys, circular refs, type mismatch, fan-out
│   │   ├── order.ts                   # dependency graph + topological ordering
│   │   ├── quote.ts                   # [bracket] quoting, string literal escaping
│   │   ├── expr.ts                    # Expr / Condition AST -> Qlik expression text
│   │   ├── emit/
│   │   │   ├── settings.ts            # SET variables (TR / EN regional presets)
│   │   │   ├── connections.ts         # LIB CONNECT TO
│   │   │   ├── mapping.ts             # MAPPING LOAD tables
│   │   │   ├── source.ts              # one LOAD per source type (qvd/xlsx/csv/sql/inline)
│   │   │   ├── target.ts              # RESIDENT loads, GROUP BY, WHERE, calculated fields
│   │   │   ├── link.ts                # JOIN / KEEP / CONCATENATE statements
│   │   │   ├── calendar.ts            # Master Calendar block
│   │   │   ├── store.ts               # STORE … INTO … (qvd)
│   │   │   └── cleanup.ts             # DROP TABLE for consumed temp tables
│   │   └── __tests__/                 # vitest specs + __snapshots__
│   ├── model/
│   │   ├── types.ts                   # the Project model (single source of truth)
│   │   ├── schema.ts                  # zod schema mirroring types.ts (import validation)
│   │   ├── defaults.ts                # factories: newProject(), newSourceTable() …
│   │   ├── migrate.ts                 # version migrations for persisted projects
│   │   └── sample.ts                  # sample project: Sales, Customers, Products, Calendar
│   ├── store/
│   │   ├── projectStore.ts            # zustand + persist + zundo (temporal)
│   │   ├── uiStore.ts                 # theme, language, active tab/step, selection
│   │   └── selectors.ts
│   ├── lib/
│   │   ├── fileFields.ts              # detect fields from CSV/XLSX (header + first rows)
│   │   ├── suggestions.ts             # role suggestions (ID/Key/Code → key, Date → date …)
│   │   ├── download.ts                # Blob download helpers (.qvs, .json)
│   │   └── id.ts                      # nanoid wrapper
│   └── i18n/
│       ├── index.ts
│       ├── en.json
│       └── tr.json
├── index.html
├── vite.config.ts                     # base = "/<repo-name>/" when built in CI
├── vitest.config.ts
├── tailwind.config.ts, postcss.config.js
├── tsconfig.json, tsconfig.app.json, tsconfig.node.json
├── eslint.config.js, .prettierrc
├── .gitignore
├── LICENSE                            # MIT
├── README.md
└── package.json
```

---

## 4. Data model (`src/model/types.ts`)

```ts
export type Locale = 'en' | 'tr'; // regional SET variables preset
export type Dialect = 'sense' | 'view'; // lib:// paths vs. plain file paths

export interface Project {
  schemaVersion: 1;
  id: string;
  name: string;
  settings: ProjectSettings;
  connections: Connection[];
  sources: SourceTable[];
  targets: TargetTable[];
  links: Link[];
  calendar?: MasterCalendar;
  canvas: CanvasState; // UI only
}

export interface ProjectSettings {
  locale: Locale; // TR or EN regional variables
  dialect: Dialect;
  useTabs: boolean; // emit ///$tab sections
  qvdStorePath?: string; // default folder for STORE, e.g. lib://QVD/
  dropConsumedSources: boolean; // DROP TABLE sources that only feed targets
}

export interface Connection {
  id: string;
  name: string; // "lib://DataFiles" or an ODBC connection name
  kind: 'folder' | 'database';
}

export type SourceKind = 'qvd' | 'excel' | 'csv' | 'sql' | 'inline';

export interface SourceTable {
  id: string;
  name: string;
  kind: SourceKind;
  connectionId?: string; // folder connection for files, db for sql
  path?: string; // file name/path relative to connection (qvd/excel/csv)
  excel?: { sheet: string; range?: string; headerRow?: number };
  csv?: {
    delimiter: ',' | ';' | '\t' | '|';
    encoding: 'utf8' | 'ansi' | 'unicode';
    hasHeader: boolean;
    quote?: 'msq' | 'none';
  };
  sql?: { query: string }; // raw SELECT; or table name -> SELECT *
  inline?: { rows: string[][] }; // first row = headers
  fields: Field[];
  keepInModel: boolean; // false ⇒ may be dropped after use
  sampleRows?: string[][]; // UI preview only (first N rows)
}

export type FieldRole = 'dimension' | 'measure' | 'key' | 'date' | 'ignore';
export type DataType = 'text' | 'number' | 'date' | 'money';

export interface Field {
  id: string;
  name: string; // name in the source
  alias?: string; // AS [alias]
  role: FieldRole;
  dataType: DataType;
  dateFormat?: string; // for text dates: Date#(x,'DD.MM.YYYY')
  isUnique?: boolean; // known/declared unique (used for fan-out check)
  suggestedRole?: FieldRole; // pending suggestion, not applied until accepted
}

export interface TargetTable {
  id: string;
  name: string;
  primarySourceId: string; // RESIDENT source
  columns: TargetColumn[]; // output columns in order
  filter?: ConditionGroup; // WHERE
  distinct?: boolean;
  store?: { enabled: boolean; path?: string }; // STORE … INTO … (qvd)
  keepInModel: boolean; // false ⇒ temp table, dropped at the end
}

export type Aggregation =
  'sum' | 'count' | 'countDistinct' | 'avg' | 'min' | 'max' | 'firstValue' | 'lastValue';

export type TargetColumn =
  | { id: string; kind: 'field'; sourceTableId: string; fieldId: string; alias?: string }
  | {
      id: string;
      kind: 'measure';
      sourceTableId: string;
      fieldId: string;
      aggregation: Aggregation;
      alias: string;
    }
  | { id: string; kind: 'calculated'; alias: string; expr: Expr; groupBy?: boolean };

// GROUP BY is derived: if any 'measure' column exists, every non-measure column is grouped.

export type Expr =
  | { kind: 'field'; sourceTableId: string; fieldId: string }
  | { kind: 'literal'; value: string | number }
  | { kind: 'concat'; parts: Expr[]; separator?: string }
  | { kind: 'arith'; op: '+' | '-' | '*' | '/'; left: Expr; right: Expr }
  | { kind: 'percent'; part: Expr; whole: Expr }
  | { kind: 'if'; condition: ConditionGroup; then: Expr; else?: Expr }
  | {
      kind: 'datePart';
      part: 'year' | 'quarter' | 'month' | 'monthName' | 'week' | 'day' | 'weekday';
      of: Expr;
    }
  | { kind: 'applyMap'; linkId: string; key: Expr } // uses an ApplyMap link
  | { kind: 'autoNumber'; of: Expr; counterName?: string }
  | { kind: 'raw'; text: string }; // escape hatch, shown as "advanced"

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
  | 'association' // common field name; optional rename
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

export interface Link {
  id: string;
  type: LinkType;
  leftTableId: string; // target of JOIN/KEEP/CONCATENATE ("into")
  rightTableId: string; // table loaded RESIDENT and merged
  pairs: FieldPair[]; // 1..n matching field pairs
  compositeKey?: { mode: 'concat' | 'autoNumber'; name: string; separator?: string };
  rename?: { fieldId: string; newName: string }[]; // association: align names
  applyMap?: { keyFieldId: string; valueFieldId: string; defaultValue?: string; mapName: string };
}

export interface MasterCalendar {
  enabled: boolean;
  tableName: string; // "Calendar"
  dateFieldRef: { tableId: string; fieldId: string };
  fieldPrefix?: string;
  parts: ('year' | 'quarter' | 'month' | 'monthName' | 'week' | 'day' | 'weekday' | 'yearMonth')[];
}

export interface CanvasState {
  positions: Record<string, { x: number; y: number }>;
}
```

Diagnostics returned by the generator:

```ts
export interface Diagnostic {
  severity: 'error' | 'warning';
  code: DiagnosticCode; // e.g. 'SYNTHETIC_KEY', 'CIRCULAR_REFERENCE', 'TARGET_NO_COLUMNS'
  params: Record<string, string>; // names used in the translated message
  refs: { tableIds?: string[]; fieldIds?: string[]; linkIds?: string[] };
  fixes: Fix[]; // one-click fixes applied by the UI
}
export type Fix =
  | { kind: 'renameField'; tableId: string; fieldId: string; newName: string }
  | { kind: 'qualifyTable'; tableId: string }
  | { kind: 'compositeKey'; linkId: string; mode: 'concat' | 'autoNumber' }
  | { kind: 'createLink'; type: LinkType; leftTableId: string; rightTableId: string; pairs: FieldPair[] }
  | { kind: 'setIgnore'; tableId: string; fieldId: string };
```

---

## 5. Screens

### Tab 1 – Model Builder (3-step wizard, stepper at top, live script on the right)

**Step 1 – Source tables**

- Table list (left) + editor (right). Add / duplicate / delete table.
- Fields: name, kind (QVD, Excel, CSV, SQL, Inline), connection (`lib://…`),
  path, Excel sheet, CSV delimiter / encoding / header row, SQL query, inline grid.
- Fields section, three entry modes:
  1. Manual add (inline editable rows, sortable with dnd-kit).
  2. "Paste header row" dialog: paste `a,b,c` / `a;b;c` / tab-separated, auto-detect delimiter.
  3. "Detect from sample file": drop a CSV/XLSX; we read header + first 20 rows in
     the browser, infer data types, store `sampleRows` for previews.
- Empty state with "Load sample project" and "Add first table".

**Step 2 – Field roles**

- Spreadsheet-like table of all fields of all sources (grouped by table).
- Columns: table, field, role, data type, alias, date format (for date), unique flag.
- Multi-select (checkbox + shift-click) → bulk "Set role" / "Set type" action bar.
- "Suggest roles" button: computes suggestions (`*ID`, `*Key`, `*Code`, `*_id` → key;
  `Date`/`Tarih` → date; numeric sample values + `Amount|Qty|Total|Price|Tutar|Adet|Miktar` → measure).
  Suggestions appear as highlighted chips; nothing applies until the user clicks
  "Apply all" or accepts individually.

**Step 3 – Target design ("final shape")**

- Left: source tables as collapsible cards with draggable field rows.
- Right: target table cards. Drop a field → adds a column. Drop a measure field →
  column gets an aggregation select (Sum, Count, Count Distinct, Avg, Min, Max,
  First value, Last value). Any measure present ⇒ GROUP BY chip row appears automatically.
- Filter builder: AND/OR groups, rows of field + operator + value(s), nested groups.
- Calculated field builder (dialog): pick operation first (Concatenate, Divide,
  Multiply, Add, Subtract, Percent, If/Then/Else, Date part), then pick fields /
  values. Shows the resulting Qlik expression read-only. "Advanced: raw expression" toggle.
- Per-target options: name, keep in model, DISTINCT, STORE to QVD (path).
- Master Calendar card: pick a date field, choose parts, one click to enable.
- Preview panel per target: column names, role badges, and first 5 rows computed
  from `sampleRows` when available (simple in-browser evaluation for field/alias
  columns; aggregates shown as "Σ Sum(...)" placeholders).

### Tab 2 – Relations & Joins

- React Flow canvas: one node per final table (sources kept + targets), each
  field is a row with a handle. Positions persisted in `project.canvas`.
- Drag a field handle onto a field of another table → "New link" popover:
  type (association, joins, keeps, concatenate, ApplyMap), direction (which
  table is joined _into_), field pairs (add more), composite-key option when ≥2 pairs.
- ApplyMap link: choose mapping table (any source with ≥2 fields), key field,
  value field, default value; produces a `MAPPING LOAD` and an `ApplyMap()` column.
- Edge styling by type; problematic edges red with a warning badge.
- Right/bottom "Issues" panel listing diagnostics from `analyzeModel` with
  one-click fixes:
  - Synthetic key (≥2 common field names between two final tables) → rename / Qualify / composite key.
  - Circular reference (cycle in table–field graph) → rename / Qualify.
  - Key type mismatch (text vs number across a link) → cast suggestion / rename.
  - Row fan-out risk (join on a field not unique on the joined side) → warn, suggest Keep or aggregate.
  - Association without a link on identical field names (implicit) → shown as dashed edges.

### Script pane (both tabs)

- CodeMirror 6 read-only, Qlik highlighting (keywords, functions, strings,
  comments, `[fields]`, `$(variables)`, `///$tab`).
- Toolbar: Copy, Download `.qvs`, "One tab per section" toggle, locale (TR/EN
  regional preset), dialect (Sense/View).
- If `validateModel` returns errors the pane shows the error list (translated)
  instead of a script; warnings are shown above a still-generated script.

### Global

- Header: project name (editable), Undo/Redo (Ctrl+Z / Ctrl+Shift+Z), Import JSON,
  Export JSON, New project, Load sample, theme toggle, language toggle (TR/EN).
- Autosave to localStorage on every change (debounced), with schema migration on load.
- Keyboard: all actions reachable by Tab/Enter/Space; dnd-kit keyboard sensor;
  React Flow nodes focusable; visible focus rings; WCAG AA contrast in both themes.

---

## 6. Script generation rules (single source of truth – mirrored in SKILL.md)

### 6.1 Output layout and ordering

```
///$tab Main            SET variables (regional preset)
///$tab Sources         one LOAD per source table (LIB CONNECT TO directly before SQL loads);
                        a MAPPING LOAD right after the source that feeds it, and sources that
                        feed mappings are ordered before the tables that use ApplyMap()
///$tab Transform       targets and merge links in dependency (topological) order
///$tab Calendar        Master Calendar (if enabled)
///$tab Store           STORE statements
///$tab Cleanup         DROP TABLE for consumed temp tables
```

With `useTabs=false` the same sections are separated by `// ===== Section =====` comments.
Every statement block is preceded by a one-line English comment describing it.
No timestamps, no random values, no user locale text ⇒ deterministic output.

### 6.2 Regional presets

| locale | ThousandSep | DecimalSep | MoneyFormat              | DateFormat   | TimestampFormat             | FirstWeekDay | CollationLocale |
| ------ | ----------- | ---------- | ------------------------ | ------------ | --------------------------- | ------------ | --------------- |
| `en`   | `,`         | `.`        | `$#,##0.00;-$#,##0.00`   | `M/D/YYYY`   | `M/D/YYYY h:mm:ss[.fff] TT` | 6            | `en-US`         |
| `tr`   | `.`         | `,`        | `#.##0,00 ₺;-#.##0,00 ₺` | `DD.MM.YYYY` | `DD.MM.YYYY hh:mm:ss[.fff]` | 0            | `tr-TR`         |

Also emits `MonthNames`, `DayNames`, `LongMonthNames`, `LongDayNames` for the locale.

### 6.3 Names and quoting

- A name is emitted bare only if it matches `^[A-Za-z_][A-Za-z0-9_]*$` and is not a
  Qlik keyword; otherwise it is wrapped in `[…]`. `]` inside a name is not allowed
  (validation error `INVALID_NAME`).
- Table labels always use the same rule: `[Order Lines]:`.
- String literals use single quotes; `'` inside is doubled.
- File paths are quoted as `[lib://Connection/path/file.ext]` (Sense) or
  `[C:\path\file.ext]` (View) with the same bracket rule.

### 6.4 Source loads

```
// --- Sales (QVD) ---
[Sales]:
LOAD
    [OrderID],
    [CustomerID],
    [Amount]            AS [Sales Amount]
FROM [lib://DataFiles/Sales.qvd] (qvd);
```

- Fields with role `ignore` are omitted. If a table has no fields: `LOAD *`.
- Excel: `(ooxml, embedded labels, table is [Sheet1])` (+ `header is N lines` when headerRow>1; `(biff …)` for `.xls`).
- CSV: `(txt, utf8, embedded labels, delimiter is ';', msq)`; `codepage is 1254` for `ansi`
  (locale-aware: 1254 for tr, 1252 for en), `unicode` for UTF-16; `explicit labels` when `hasHeader=false`.
- SQL: `LIB CONNECT TO 'Conn';` once per connection in the Connections section, then
  `[T]: LOAD <field list>; SQL SELECT … ;` (preceding LOAD lists fields with aliases).
- Inline: `LOAD * INLINE [\n a, b\n 1, 2\n];` with values quoted when they contain `,`/`[`/`]`.
- Date fields with `dateFormat` set and a text source (csv/excel/inline/sql):
  `Date(Date#([F], 'DD.MM.YYYY')) AS [F]`. Number/money fields from CSV with
  `dataType` number: `Num#([F], '#.##0,00', ',', '.')` only when the user picks a
  parse format (optional, off by default).

### 6.5 Targets (Transform section)

```
// --- SalesByCustomer (from Sales) ---
[SalesByCustomer]:
NoConcatenate
LOAD
    [CustomerID],
    Year([OrderDate])                   AS [Year],
    Sum([Sales Amount])                 AS [Total Sales],
    Count(DISTINCT [OrderID])           AS [Order Count]
RESIDENT [Sales]
WHERE [Status] = 'Closed' AND ([Region] = 'EU' OR [Region] = 'TR')
GROUP BY [CustomerID], Year([OrderDate]);
```

- Every target is a `NoConcatenate LOAD … RESIDENT [primary]` (prevents implicit
  concatenation when field sets match).
- `GROUP BY` contains every non-aggregated output expression (fields and
  calculated columns, as expressions – not aliases), in column order.
- Columns referencing a _different_ source table than the primary require a join
  link (see 6.6) between that table and the primary; otherwise `FIELD_NOT_REACHABLE`
  error with a `createLink` fix.
- WHERE renders groups with parentheses, `AND`/`OR` upper-case, `in` → `Match([F], 'a','b') > 0`,
  `contains` → `Index([F], 'x') > 0`, `startsWith` → `Left([F], n) = 'x'`,
  `isNull` → `Len(Trim([F])) = 0`, `between` → `[F] >= a AND [F] <= b`.
- Calculated columns: `concat` → `[A] & ' ' & [B]`, `percent` → `[A] / [B] * 100`,
  `if` → `If(cond, then, else)`, `datePart` → `Year()/Quarter()/Month()/MonthName()/Week()/Day()/WeekDay()`,
  `applyMap` → `ApplyMap('Map_Name', [Key], 'default')`, `autoNumber` → `AutoNumber(expr, 'counter')`.
  Division always emits `/`; UI offers an optional "safe divide" that wraps in `If(whole <> 0, …)`.
- `distinct` ⇒ `LOAD DISTINCT`.
- A target that has `keepInModel=false` gets a `_tmp` suffix comment hint and is dropped in Cleanup.

### 6.6 Links

Emitted in topological order after both tables exist. Statement forms:

| type            | emitted                                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leftJoin` etc. | `LEFT JOIN ([Left])\nLOAD <pairs + right fields> RESIDENT [Right];`                                                                                                                |
| `leftKeep` etc. | `[Right_keep]: NoConcatenate LEFT KEEP ([Left]) LOAD … RESIDENT [Right]; DROP TABLE [Right]; RENAME TABLE [Right_keep] TO [Right];` (a plain resident load would auto-concatenate) |
| `concatenate`   | `CONCATENATE ([Left])\nLOAD * RESIDENT [Right];` then `DROP TABLE [Right];`                                                                                                        |
| `noConcatenate` | marks Right as `NoConcatenate` when loaded; no merge                                                                                                                               |
| `association`   | nothing; `renameRightToLeft` is applied as an alias inside the right table's LOAD                                                                                                  |
| `applyMap`      | `[Map_<name>]:\nMAPPING LOAD [key], [value] RESIDENT [Right];` in Mapping section (or directly from the file when Right is a source) + `ApplyMap()` columns                        |

- Join key pairs with different names on both sides: the right side is aliased
  to the left name inside the join LOAD.
- `compositeKey` with ≥2 pairs: `[A] & '|' & [B] AS [%CompositeKey]` (concat) or
  `AutoNumber([A] & '|' & [B], 'key') AS [%CompositeKey]` on both tables; the
  original key fields on the right side are dropped from the right load to avoid
  synthetic keys.
- Joining into a table and the joined table (Right) has `keepInModel=false` ⇒ `DROP TABLE [Right]` in Cleanup.
- `QUALIFY *; UNQUALIFY [Key];` is emitted around a table's load only when the
  `qualifyTable` fix was applied (stored as `qualify: true` on the table).

### 6.7 Master Calendar

Standard pattern, deterministic:

```
// --- Master Calendar on Sales.OrderDate ---
[TempDateRange]:
LOAD Min([OrderDate]) AS MinDate, Max([OrderDate]) AS MaxDate RESIDENT [Sales];
LET vMinDate = Peek('MinDate', 0, 'TempDateRange');
LET vMaxDate = Peek('MaxDate', 0, 'TempDateRange');
DROP TABLE [TempDateRange];

[Calendar]:
LOAD
    [OrderDate],
    Year([OrderDate])        AS [Year],
    'Q' & Ceil(Month([OrderDate]) / 3) AS [Quarter],
    Month([OrderDate])       AS [Month],
    …
;
LOAD Date($(vMinDate) + IterNo() - 1) AS [OrderDate]
AUTOGENERATE 1 WHILE $(vMinDate) + IterNo() - 1 <= $(vMaxDate);
```

### 6.8 Store and cleanup

- `STORE [T] INTO [lib://QVD/T.qvd] (qvd);` – path from the target, else
  `settings.qvdStorePath + name + '.qvd'`.
- Cleanup drops, in order: concatenated right tables (already dropped inline),
  sources with `keepInModel=false` that were consumed by at least one target/join,
  targets with `keepInModel=false`. Never drops a table nothing consumed.

### 6.9 Validation (errors block generation)

`EMPTY_PROJECT`, `DUPLICATE_TABLE_NAME`, `DUPLICATE_FIELD_NAME`, `INVALID_NAME`,
`SOURCE_PATH_MISSING`, `EXCEL_SHEET_MISSING`, `SQL_QUERY_MISSING`, `INLINE_EMPTY`,
`TARGET_NO_COLUMNS`, `TARGET_PRIMARY_MISSING`, `FIELD_NOT_REACHABLE`,
`LINK_NO_PAIRS`, `LINK_SELF`, `APPLYMAP_FIELDS_MISSING`, `CALENDAR_DATE_MISSING`,
`CYCLIC_DEPENDENCY` (targets/links that depend on each other).

### 6.10 Analysis (warnings, script still generated)

`SYNTHETIC_KEY`, `CIRCULAR_REFERENCE`, `KEY_TYPE_MISMATCH`, `JOIN_FANOUT_RISK`,
`IMPLICIT_CONCATENATE` (two surviving tables with identical field sets),
`UNUSED_MAPPING`, `DROPPED_TABLE_REFERENCED`.

---

## 7. Testing strategy

- `src/generator/__tests__/sources.spec.ts` – one snapshot per source kind + options (CSV delimiters/encodings, Excel header rows, SQL, inline quoting, `LOAD *`).
- `targets.spec.ts` – group by derivation, filters (every operator, nested groups), every calculated-field kind, DISTINCT, STORE.
- `links.spec.ts` – every join/keep/concatenate type, direction, renamed keys, composite keys (concat & AutoNumber), ApplyMap with default.
- `calendar.spec.ts`, `settings.spec.ts` (TR/EN presets, tabs on/off), `quote.spec.ts` (spaces, Turkish characters, brackets, keywords).
- `analyze.spec.ts` – synthetic key detection, circular reference detection, type mismatch, fan-out, each with the expected `fixes`.
- `validate.spec.ts` – every error code.
- `determinism.spec.ts` – `generateScript(m) === generateScript(structuredClone(m))`, repeated calls identical, key order in JSON irrelevant.
- `sample.spec.ts` – the bundled sample project validates with zero errors and its script snapshot.
- A few UI smoke tests (render app, load sample, switch language) with Testing Library.

---

## 8. Phases (each ends with a deployable, working build pushed to the branch)

**Phase 0 – Scaffold & pipeline**
Vite + React + TS strict, Tailwind, ESLint/Prettier, Vitest, `.gitignore`,
LICENSE (MIT), README skeleton, GitHub Actions (test + build + Pages deploy),
`vite.config.ts` base from repo name. App shell with two tabs, theme toggle,
i18n wiring (EN/TR), empty states. _Deliverable: empty but deployed app._

**Phase 1 – Model, store, generator core, Step 1**
`model/types.ts`, zod schema, defaults, migrations, sample project.
Zustand store with localStorage persistence, undo/redo, JSON import/export.
Generator: settings, connections, source loads for all five kinds, quoting,
STORE, tabs toggle, validation codes for sources. Snapshot tests.
UI: Step 1 (tables, fields: manual / paste header / detect from CSV-XLSX),
script pane with CodeMirror + Qlik highlighting, copy/download.
_Deliverable: build a multi-source load script end to end._

**Phase 2 – Roles and target designer**
Step 2 grid with bulk edit and suggestions (opt-in). Step 3 designer: dnd-kit
field drop, aggregations with automatic GROUP BY, filter builder, calculated
field builder, master calendar, per-target STORE, target preview with sample rows.
Generator: targets, expressions, conditions, calendar, cleanup. Tests.
_Deliverable: full wizard without the relations canvas._

**Phase 3 – Relations canvas and analysis**
React Flow canvas, link creation by dragging field handles, link editor with all
types, composite keys, ApplyMap. `analyzeModel`: synthetic keys, circular
references, type mismatch, fan-out, with one-click fixes. Generator: joins, keeps,
concatenate, ApplyMap, topological ordering, drops. Red-edge highlighting. Tests.
_Deliverable: feature-complete app._

**Phase 4 – Polish, docs, skill**
Accessibility pass (keyboard, focus, contrast), empty states, stepper progress,
translated error panel, performance for large models. Final README (English)
with screenshot placeholders, features, local setup, limitations, and skill
installation. `skills/qlik-load-script-builder/SKILL.md` generated from the same
rule list as section 6 (a test asserts SKILL.md mentions every emitted keyword /
diagnostic code so it cannot drift from the generator). Release tag `v0.1.0`.

---

## 9. Decisions to confirm

1. **Default UI language.** The spec says Turkish by default. Proposal: detect the
   browser language on first visit (`tr*` → Turkish, anything else → English), and
   remember the user's choice. Nothing else in the repository is Turkish.
2. **README** is English only (the earlier "Turkish summary" is dropped per the
   "everything English on GitHub" instruction).
3. **Dialect.** Qlik Sense (`lib://`) is primary; a "QlikView" dialect switch only
   changes path style (plain paths, no `LIB CONNECT`, `CONNECT TO` instead).
4. **GitHub Pages** must be set to "Source: GitHub Actions" in the repository
   settings once; the workflow handles the rest. Deploys happen on pushes to `main`.
5. **Raw expression escape hatch** is included but labelled "advanced"; everything
   in the spec is achievable without it.
