/**
 * Zod schema mirroring `types.ts`. Used to validate imported JSON and
 * persisted projects before they reach the store.
 */
import { z } from 'zod';
import type { Expr, ConditionGroup, Condition, Project } from './types';
import {
  AGGREGATIONS,
  CONDITION_OPS,
  DATA_TYPES,
  DATE_PARTS,
  FIELD_ROLES,
  LINK_TYPES,
  SCHEMA_VERSION,
  SOURCE_KINDS,
} from './types';

const fieldRef = z.object({ tableId: z.string(), fieldId: z.string() });

const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.object({
    id: z.string(),
    kind: z.literal('condition'),
    left: exprSchema,
    op: z.enum(CONDITION_OPS),
    values: z.array(z.union([z.string(), z.number()])),
  }),
);

const conditionGroupSchema: z.ZodType<ConditionGroup> = z.lazy(() =>
  z.object({
    id: z.string(),
    kind: z.literal('group'),
    logic: z.enum(['and', 'or']),
    items: z.array(z.union([conditionSchema, conditionGroupSchema])),
  }),
);

const exprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('field'), ref: fieldRef }),
    z.object({ kind: z.literal('literal'), value: z.union([z.string(), z.number()]) }),
    z.object({ kind: z.literal('concat'), parts: z.array(exprSchema), separator: z.string() }),
    z.object({
      kind: z.literal('arith'),
      op: z.enum(['+', '-', '*', '/']),
      left: exprSchema,
      right: exprSchema,
      safeDivide: z.boolean(),
    }),
    z.object({ kind: z.literal('percent'), part: exprSchema, whole: exprSchema }),
    z.object({
      kind: z.literal('if'),
      condition: conditionGroupSchema,
      then: exprSchema,
      else: exprSchema.nullable(),
    }),
    z.object({ kind: z.literal('datePart'), part: z.enum(DATE_PARTS), of: exprSchema }),
    z.object({ kind: z.literal('applyMap'), linkId: z.string(), key: exprSchema }),
    z.object({ kind: z.literal('autoNumber'), of: exprSchema, counterName: z.string().nullable() }),
    z.object({ kind: z.literal('raw'), text: z.string() }),
  ]),
);

const fieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  alias: z.string().nullable(),
  role: z.enum(FIELD_ROLES),
  dataType: z.enum(DATA_TYPES),
  dateFormat: z.string().nullable(),
  isUnique: z.boolean(),
  suggestedRole: z.enum(FIELD_ROLES).nullable(),
});

const sourceTableSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(SOURCE_KINDS),
  connectionId: z.string().nullable(),
  path: z.string(),
  excel: z.object({ sheet: z.string(), headerRow: z.number().int().min(1) }).nullable(),
  csv: z
    .object({
      delimiter: z.enum([',', ';', '\t', '|']),
      encoding: z.enum(['utf8', 'ansi', 'unicode']),
      hasHeader: z.boolean(),
      msq: z.boolean(),
    })
    .nullable(),
  sql: z.object({ query: z.string() }).nullable(),
  inline: z.object({ rows: z.array(z.array(z.string())) }).nullable(),
  fields: z.array(fieldSchema),
  keepInModel: z.boolean(),
  qualify: z.boolean(),
  sampleRows: z.array(z.array(z.string())).nullable(),
});

const targetColumnSchema = z.discriminatedUnion('kind', [
  z.object({ id: z.string(), kind: z.literal('field'), ref: fieldRef, alias: z.string().nullable() }),
  z.object({
    id: z.string(),
    kind: z.literal('measure'),
    ref: fieldRef,
    aggregation: z.enum(AGGREGATIONS),
    alias: z.string(),
  }),
  z.object({ id: z.string(), kind: z.literal('calculated'), alias: z.string(), expr: exprSchema }),
]);

const targetTableSchema = z.object({
  id: z.string(),
  name: z.string(),
  primarySourceId: z.string().nullable(),
  columns: z.array(targetColumnSchema),
  filter: conditionGroupSchema.nullable(),
  distinct: z.boolean(),
  store: z.object({ enabled: z.boolean(), path: z.string() }),
  keepInModel: z.boolean(),
  qualify: z.boolean(),
});

const linkSchema = z.object({
  id: z.string(),
  type: z.enum(LINK_TYPES),
  leftTableId: z.string(),
  rightTableId: z.string(),
  pairs: z.array(z.object({ leftFieldId: z.string(), rightFieldId: z.string() })),
  compositeKey: z
    .object({ mode: z.enum(['concat', 'autoNumber']), name: z.string(), separator: z.string() })
    .nullable(),
  renameRightToLeft: z.boolean(),
  applyMap: z
    .object({
      keyFieldId: z.string(),
      valueFieldId: z.string(),
      defaultValue: z.string().nullable(),
      mapName: z.string(),
      outputName: z.string(),
    })
    .nullable(),
});

export const projectSchema: z.ZodType<Project> = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  name: z.string(),
  settings: z.object({
    locale: z.enum(['en', 'tr']),
    dialect: z.enum(['sense', 'view']),
    useTabs: z.boolean(),
    qvdStorePath: z.string(),
    dropConsumedSources: z.boolean(),
  }),
  connections: z.array(z.object({ id: z.string(), name: z.string(), kind: z.enum(['folder', 'database']) })),
  sources: z.array(sourceTableSchema),
  targets: z.array(targetTableSchema),
  links: z.array(linkSchema),
  calendar: z
    .object({
      enabled: z.boolean(),
      tableName: z.string(),
      dateField: fieldRef.nullable(),
      parts: z.array(z.enum(DATE_PARTS)),
    })
    .nullable(),
  canvas: z.object({
    positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
  }),
});

export type ParseResult = { ok: true; project: Project } | { ok: false; issues: string[] };

/** Validates unknown JSON (already parsed) as a Project. */
export function parseProject(input: unknown): ParseResult {
  const result = projectSchema.safeParse(input);
  if (result.success) {
    return { ok: true, project: result.data };
  }
  return {
    ok: false,
    issues: result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
  };
}
