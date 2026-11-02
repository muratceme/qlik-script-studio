/**
 * Property test: random projects must never crash the generator, must round-trip
 * through the JSON schema, and must produce byte-identical scripts on repeated
 * runs. Applying any proposed fix must keep the project valid as well.
 */
import { describe, expect, it } from 'vitest';
import { analyzeModel, buildScript, validateModel } from '@/generator';
import { parseProject } from '@/model/schema';
import { applyFix } from '@/store/fixes';
import type {
  Aggregation,
  ConditionGroup,
  ConditionOp,
  DatePart,
  Expr,
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
import {
  AGGREGATIONS,
  CONDITION_OPS,
  DATE_PARTS,
  LINK_TYPES,
  SCHEMA_VERSION,
  SOURCE_KINDS,
} from '@/model/types';

class Rng {
  constructor(private seed: number) {}
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }
  int(max: number): number {
    return Math.floor(this.next() * max);
  }
  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]!;
  }
  bool(p = 0.5): boolean {
    return this.next() < p;
  }
}

const NAMES = [
  'OrderID',
  'Customer ID',
  'Satış Tutarı',
  'Amount',
  'Date',
  'Order Date',
  'Group',
  'from',
  'Qty',
  'x',
  'Key',
  'Region',
  '2024',
  'a-b',
  "O'Brien",
  'Load',
  'Year',
  'Total Sales',
  'ID',
];

let counter = 0;
const id = (p: string) => `${p}${++counter}`;

function randomField(r: Rng, used: Set<string>): Field {
  let name = r.pick(NAMES);
  while (used.has(name.toLowerCase())) name = `${name}_${r.int(100)}`;
  used.add(name.toLowerCase());
  return {
    id: id('f'),
    name,
    alias: r.bool(0.15) ? `${name} Alias` : null,
    role: r.pick(['dimension', 'measure', 'key', 'date', 'ignore'] as const),
    dataType: r.pick(['text', 'number', 'date', 'money'] as const),
    dateFormat: r.bool(0.2) ? 'DD.MM.YYYY' : null,
    isUnique: r.bool(0.3),
    suggestedRole: null,
  };
}

function randomSource(r: Rng, index: number): SourceTable {
  const kind: SourceKind = r.pick(SOURCE_KINDS);
  const used = new Set<string>();
  const fields = Array.from({ length: 1 + r.int(5) }, () => randomField(r, used));
  return {
    id: id('s'),
    name: `${r.pick(['Sales', 'Customers', 'Products', 'Orders', 'Dim Region', 'Table'])}_${index}`,
    kind,
    connectionId: kind === 'sql' ? 'db' : r.bool(0.8) ? 'c1' : null,
    path: `file${index}.${kind === 'excel' ? (r.bool() ? 'xlsx' : 'xls') : kind}`,
    excel: kind === 'excel' ? { sheet: r.pick(['Sheet1', 'Data Sheet']), headerRow: 1 + r.int(3) } : null,
    csv:
      kind === 'csv'
        ? {
            delimiter: r.pick([',', ';', '\t', '|'] as const),
            encoding: r.pick(['utf8', 'ansi', 'unicode'] as const),
            hasHeader: r.bool(0.8),
            msq: r.bool(),
          }
        : null,
    sql: kind === 'sql' ? { query: `SELECT * FROM t${index}` } : null,
    inline: kind === 'inline' ? { rows: [fields.map((f) => f.name), fields.map((_, i) => `v${i}`)] } : null,
    fields,
    keepInModel: r.bool(0.4),
    qualify: r.bool(0.1),
    sampleRows: null,
  };
}

function fieldRefs(table: SourceTable): FieldRef[] {
  return table.fields.map((f) => ({ tableId: table.id, fieldId: f.id }));
}

function randomExpr(r: Rng, refs: FieldRef[], linkIds: string[], depth = 0): Expr {
  const leaf = (): Expr =>
    r.bool(0.7) && refs.length
      ? { kind: 'field', ref: r.pick(refs) }
      : { kind: 'literal', value: r.bool() ? r.int(1000) : r.pick(["O'Brien", 'EU', '']) };
  if (depth > 2) return leaf();
  const kind = r.pick([
    'field',
    'literal',
    'concat',
    'arith',
    'percent',
    'if',
    'datePart',
    'applyMap',
    'autoNumber',
    'raw',
  ] as const);
  switch (kind) {
    case 'field':
    case 'literal':
      return leaf();
    case 'concat':
      return {
        kind,
        parts: Array.from({ length: 1 + r.int(3) }, () => randomExpr(r, refs, linkIds, depth + 1)),
        separator: r.pick(['', ' ', '|', "'"]),
      };
    case 'arith':
      return {
        kind,
        op: r.pick(['+', '-', '*', '/'] as const),
        left: randomExpr(r, refs, linkIds, depth + 1),
        right: randomExpr(r, refs, linkIds, depth + 1),
        safeDivide: r.bool(),
      };
    case 'percent':
      return {
        kind,
        part: randomExpr(r, refs, linkIds, depth + 1),
        whole: randomExpr(r, refs, linkIds, depth + 1),
      };
    case 'if':
      return {
        kind,
        condition: randomGroup(r, refs, linkIds, depth + 1),
        then: randomExpr(r, refs, linkIds, depth + 1),
        else: r.bool() ? randomExpr(r, refs, linkIds, depth + 1) : null,
      };
    case 'datePart':
      return { kind, part: r.pick(DATE_PARTS) as DatePart, of: randomExpr(r, refs, linkIds, depth + 1) };
    case 'applyMap':
      return {
        kind,
        linkId: linkIds.length ? r.pick(linkIds) : 'missing',
        key: randomExpr(r, refs, linkIds, depth + 1),
      };
    case 'autoNumber':
      return { kind, of: randomExpr(r, refs, linkIds, depth + 1), counterName: r.bool() ? 'ctr' : null };
    case 'raw':
      return { kind, text: r.pick(['Upper([x])', ' Len(a) ', '']) };
  }
}

function randomGroup(r: Rng, refs: FieldRef[], linkIds: string[], depth = 0): ConditionGroup {
  const items: ConditionGroup['items'] = [];
  const n = r.int(4);
  for (let i = 0; i < n; i++) {
    if (depth < 2 && r.bool(0.25)) items.push(randomGroup(r, refs, linkIds, depth + 1));
    else {
      const op = r.pick(CONDITION_OPS) as ConditionOp;
      const values =
        op === 'between'
          ? [r.int(10), r.int(100)]
          : op === 'in' || op === 'notIn'
            ? ['a', 'b', 3]
            : [r.bool() ? 'x' : r.int(50)];
      items.push({
        id: id('c'),
        kind: 'condition',
        left: randomExpr(r, refs, linkIds, depth + 1),
        op,
        values,
      });
    }
  }
  return { id: id('g'), kind: 'group', logic: r.bool() ? 'and' : 'or', items };
}

const MERGE = new Set(['leftJoin', 'rightJoin', 'innerJoin', 'outerJoin', 'concatenate']);

function randomTarget(
  r: Rng,
  index: number,
  sources: SourceTable[],
  links: Link[],
  targets: TargetTable[],
  wellFormed: boolean,
): TargetTable {
  const primaryPool: (SourceTable | TargetTable)[] = [...sources, ...targets];
  const primary = r.bool(0.95) || wellFormed ? r.pick(primaryPool) : null;
  const refs: FieldRef[] = [];
  if (wellFormed && primary) {
    const reachable = new Set([
      primary.id,
      ...links.filter((l) => l.leftTableId === primary.id && MERGE.has(l.type)).map((l) => l.rightTableId),
    ]);
    for (const s of sources)
      if (reachable.has(s.id))
        refs.push(
          ...s.fields.filter((f) => f.role !== 'ignore').map((f) => ({ tableId: s.id, fieldId: f.id })),
        );
    for (const t of targets)
      if (reachable.has(t.id)) refs.push(...t.columns.map((c) => ({ tableId: t.id, fieldId: c.id })));
  } else {
    for (const s of sources) if (r.bool(0.6) || s.id === primary?.id) refs.push(...fieldRefs(s));
    for (const t of targets)
      if (t.id === primary?.id) refs.push(...t.columns.map((c) => ({ tableId: t.id, fieldId: c.id })));
  }
  const linkIds = links.filter((l) => l.type === 'applyMap').map((l) => l.id);
  const columns: TargetColumn[] = [];
  const n = wellFormed ? 1 + r.int(6) : r.int(6);
  const usedRefs = new Set<string>();
  for (let i = 0; i < n; i++) {
    const pick = r.int(3);
    if (pick === 0 && refs.length) {
      const ref = r.pick(refs);
      const key = `${ref.tableId}:${ref.fieldId}`;
      if (wellFormed && usedRefs.has(key)) continue;
      usedRefs.add(key);
      columns.push({
        id: id('col'),
        kind: 'field',
        ref,
        alias: wellFormed ? null : r.bool(0.2) ? `Col ${i}` : null,
      });
    } else if (pick === 1 && refs.length)
      columns.push({
        id: id('col'),
        kind: 'measure',
        ref: r.pick(refs),
        aggregation: r.pick(AGGREGATIONS) as Aggregation,
        alias: `M${i}`,
      });
    else {
      let expr = randomExpr(r, refs, linkIds);
      if (wellFormed && expr.kind === 'raw' && !expr.text.trim()) expr = { kind: 'raw', text: 'Upper([x])' };
      columns.push({
        id: id('col'),
        kind: 'calculated',
        alias: `Calc ${i}`,
        expr: wellFormed ? sanitize(expr) : expr,
      });
    }
  }
  return {
    id: id('t'),
    name: `Target_${index}`,
    primarySourceId: primary?.id ?? null,
    columns,
    filter: r.bool(0.5) ? randomGroup(r, refs, linkIds) : null,
    distinct: r.bool(0.2),
    store: { enabled: r.bool(0.3), path: r.bool() ? '' : 'lib://QVD/x.qvd' },
    keepInModel: r.bool(0.8),
    qualify: r.bool(0.1),
  };
}

/** Replaces empty raw expressions and dangling applyMap links deep inside an expression. */
function sanitize(expr: Expr): Expr {
  switch (expr.kind) {
    case 'raw':
      return expr.text.trim() ? expr : { kind: 'raw', text: 'Upper([x])' };
    case 'concat':
      return { ...expr, parts: expr.parts.map(sanitize) };
    case 'arith':
      return { ...expr, left: sanitize(expr.left), right: sanitize(expr.right) };
    case 'percent':
      return { ...expr, part: sanitize(expr.part), whole: sanitize(expr.whole) };
    case 'if':
      return { ...expr, then: sanitize(expr.then), else: expr.else ? sanitize(expr.else) : null };
    case 'datePart':
    case 'autoNumber':
      return { ...expr, of: sanitize(expr.of) };
    case 'applyMap':
      return { ...expr, key: sanitize(expr.key) };
    default:
      return expr;
  }
}

function randomLink(r: Rng, tables: (SourceTable | TargetTable)[], wellFormed: boolean): Link {
  const left = r.pick(tables);
  const others = tables.filter((t) => t.id !== left.id);
  const right = (r.bool(0.95) || wellFormed) && others.length ? r.pick(others) : left;
  const type = r.pick(LINK_TYPES) as LinkType;
  const lf =
    'fields' in left
      ? left.fields.filter((f) => !wellFormed || f.role !== 'ignore').map((f) => f.id)
      : left.columns.map((c) => c.id);
  const rf =
    'fields' in right
      ? right.fields.filter((f) => !wellFormed || f.role !== 'ignore').map((f) => f.id)
      : right.columns.map((c) => c.id);
  const nPairs = wellFormed ? 1 + r.int(2) : r.int(3);
  const pairs = Array.from({ length: nPairs }, () => ({
    leftFieldId: lf.length ? r.pick(lf) : 'none',
    rightFieldId: rf.length ? r.pick(rf) : 'none',
  }));
  return {
    id: id('l'),
    type,
    leftTableId: left.id,
    rightTableId: right.id,
    pairs,
    compositeKey: r.bool(0.3)
      ? { mode: r.bool() ? 'concat' : 'autoNumber', name: r.pick(['%Key', 'Composite Key']), separator: '|' }
      : null,
    renameRightToLeft: r.bool(0.3),
    applyMap:
      type === 'applyMap' && rf.length
        ? {
            keyFieldId: r.pick(rf),
            valueFieldId: r.pick(rf),
            defaultValue: r.bool() ? 'Unknown' : null,
            mapName: `Map_${right.name}`,
            outputName: r.pick(NAMES),
          }
        : null,
  };
}

export function randomProject(seed: number, wellFormed = false): Project {
  const r = new Rng(seed);
  counter = 0;
  const sources = Array.from({ length: (wellFormed ? 2 : 1) + r.int(5) }, (_, i) => randomSource(r, i));
  if (wellFormed) {
    // Keep the model structurally sane: unique table names, at most one ignore per table.
    for (const s of sources)
      s.fields.forEach((f, i) => {
        if (f.role === 'ignore' && i > 0) f.role = 'dimension';
      });
  }
  const links: Link[] = [];
  const targets: TargetTable[] = [];
  const nLinks = r.int(5);
  for (let i = 0; i < nLinks; i++) links.push(randomLink(r, [...sources, ...targets], wellFormed));
  const nTargets = wellFormed ? 1 + r.int(3) : r.int(4);
  for (let i = 0; i < nTargets; i++) targets.push(randomTarget(r, i, sources, links, targets, wellFormed));
  if (r.bool(0.3)) links.push(randomLink(r, [...sources, ...targets], wellFormed));
  const dateRefs = sources.flatMap((s) =>
    s.fields.filter((f) => f.role === 'date').map((f) => ({ tableId: s.id, fieldId: f.id })),
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    id: `fuzz-${seed}`,
    name: `Fuzz ${seed}`,
    settings: {
      locale: r.bool() ? 'en' : 'tr',
      dialect: r.bool(0.8) ? 'sense' : 'view',
      useTabs: r.bool(),
      qvdStorePath: r.bool() ? 'lib://QVD/' : '',
      dropConsumedSources: r.bool(0.8),
    },
    connections: [
      { id: 'c1', name: 'lib://DataFiles', kind: 'folder' },
      { id: 'db', name: 'SQL_Server', kind: 'database' },
    ],
    sources,
    targets,
    links,
    calendar: r.bool(0.4)
      ? {
          enabled: wellFormed ? dateRefs.length > 0 : r.bool(0.8),
          tableName: r.pick(['Calendar', 'Master Calendar']),
          dateField: dateRefs.length ? r.pick(dateRefs) : null,
          parts: DATE_PARTS.filter(() => r.bool()),
        }
      : null,
    canvas: { positions: {} },
  };
}

const FORBIDDEN = ['undefined', 'NaN', '[object', 'null AS', ' ?,', '[?]', 'RESIDENT ?'];

describe('fuzz', () => {
  const seeds = Array.from({ length: 400 }, (_, i) => i + 1);
  it('never throws, round-trips through the schema, and is deterministic', () => {
    let generated = 0;
    for (const seed of seeds) {
      const project = randomProject(seed);
      const parsed = parseProject(JSON.parse(JSON.stringify(project)));
      expect(parsed.ok, `seed ${seed} schema: ${parsed.ok ? '' : parsed.issues.join('; ')}`).toBe(true);

      let result;
      try {
        result = buildScript(project);
      } catch (e) {
        throw new Error(`seed ${seed} threw: ${(e as Error).stack}`);
      }
      expect(() => analyzeModel(project), `seed ${seed} analyze`).not.toThrow();

      if (result.script !== null) {
        generated++;
        expect(result.errors).toEqual([]);
        const again = buildScript(randomProject(seed)).script;
        expect(again, `seed ${seed} determinism`).toBe(result.script);
        for (const bad of FORBIDDEN) {
          expect(result.script.includes(bad), `seed ${seed} contains "${bad}":\n${result.script}`).toBe(
            false,
          );
        }
        // Every statement block ends with a semicolon before the next blank line.
        for (const block of result.script.split('\n\n')) {
          const lines = block
            .trim()
            .split('\n')
            .filter((l) => !l.startsWith('//') && l.trim() !== '');
          const last = lines[lines.length - 1];
          if (!last || last.startsWith('///$tab') || last.startsWith('// ====')) continue;
          expect(
            last.endsWith(';') || last.endsWith(']') || last.startsWith('SET ') || last.startsWith('LET '),
            `seed ${seed} block does not end with ';':\n${block}`,
          ).toBe(true);
        }
      }

      // Applying any proposed fix must keep the project parseable and the generator stable.
      const diagnostics = [...result.errors, ...result.warnings];
      for (const d of diagnostics) {
        for (const fix of d.fixes) {
          const copy = structuredClone(project);
          expect(() => applyFix(copy, fix), `seed ${seed} fix ${fix.kind}`).not.toThrow();
          expect(
            parseProject(JSON.parse(JSON.stringify(copy))).ok,
            `seed ${seed} fix ${fix.kind} schema`,
          ).toBe(true);
          expect(() => buildScript(copy), `seed ${seed} after fix ${fix.kind}`).not.toThrow();
          expect(() => validateModel(copy)).not.toThrow();
        }
      }
    }
    // Sanity: a reasonable share of random models must be valid, or the test proves nothing.
    expect(generated).toBeGreaterThan(seeds.length * 0.1);
  });
});

import { checkScript } from './scriptChecker';
import { sampleProject } from '@/model/sample';

describe('script lifecycle checker', () => {
  it('accepts the sample project script', () => {
    expect(checkScript(buildScript(sampleProject()).script!)).toEqual([]);
  });

  it.each([false, true])('accepts every generated fuzz script (wellFormed=%s)', (wellFormed) => {
    const stats: Record<string, number> = {};
    let generated = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const project = randomProject(seed, wellFormed);
      const result = buildScript(project);
      for (const d of [...result.errors, ...result.warnings]) stats[d.code] = (stats[d.code] ?? 0) + 1;
      if (!result.script) continue;
      generated++;
      const problems = checkScript(result.script);
      expect(
        problems,
        `seed ${seed}:\n${problems.map((p) => `L${p.line}: ${p.message}`).join('\n')}\n---\n${result.script}`,
      ).toEqual([]);
    }
    console.log('wellFormed', wellFormed, 'generated', generated, JSON.stringify(stats));
    if (wellFormed) expect(generated).toBeGreaterThan(200);
  });
});
