import { describe, expect, it } from 'vitest';
import { generateScript, validateModel } from '@/generator';
import type { ConditionGroup, Expr, TargetColumn } from '@/model/types';
import { col, link, project, ref, starSources, target } from './helpers';

const f = (tableId: string, fieldId: string): Expr => ({ kind: 'field', ref: ref(tableId, fieldId) });
const lit = (value: string | number): Expr => ({ kind: 'literal', value });

describe('targets', () => {
  it('resident load with automatic GROUP BY from non-aggregated columns', () => {
    const p = project({
      sources: starSources(),
      targets: [
        target('t', 'Sales_By_Customer', 's', [
          col('c1', 's', 's-c'),
          {
            id: 'c2',
            kind: 'calculated',
            alias: 'Year',
            expr: { kind: 'datePart', part: 'year', of: f('s', 's-d') },
          },
          { id: 'c3', kind: 'measure', ref: ref('s', 's-a'), aggregation: 'sum', alias: 'Total' },
          { id: 'c4', kind: 'measure', ref: ref('s', 's-o'), aggregation: 'countDistinct', alias: 'Orders' },
          { id: 'c5', kind: 'measure', ref: ref('s', 's-a'), aggregation: 'avg', alias: 'Avg Amount' },
          { id: 'c6', kind: 'measure', ref: ref('s', 's-a'), aggregation: 'min', alias: 'Min' },
          { id: 'c7', kind: 'measure', ref: ref('s', 's-a'), aggregation: 'max', alias: 'Max' },
          { id: 'c8', kind: 'measure', ref: ref('s', 's-d'), aggregation: 'firstValue', alias: 'First Date' },
          { id: 'c9', kind: 'measure', ref: ref('s', 's-d'), aggregation: 'lastValue', alias: 'Last Date' },
          { id: 'c10', kind: 'measure', ref: ref('s', 's-o'), aggregation: 'count', alias: 'Rows' },
        ]),
      ],
    });
    expect(generateScript(p)).toMatchSnapshot();
  });

  it('no GROUP BY without measures; DISTINCT and STORE', () => {
    const p = project({
      sources: starSources(),
      targets: [
        target('t', 'Customer_List', 's', [col('c1', 's', 's-c', 'Customer')], {
          distinct: true,
          store: { enabled: true, path: '' },
        }),
        target('t2', 'Custom_Path', 's', [col('c1', 's', 's-o')], {
          store: { enabled: true, path: 'lib://Archive/orders.qvd' },
        }),
      ],
    });
    const script = generateScript(p);
    expect(script).toContain('LOAD DISTINCT');
    expect(script).not.toContain('GROUP BY');
    expect(script).toContain('STORE Customer_List INTO [lib://QVD/Customer_List.qvd] (qvd);');
    expect(script).toContain('STORE Custom_Path INTO [lib://Archive/orders.qvd] (qvd);');
    expect(script).toMatchSnapshot();
  });

  it('renders every filter operator and nested AND/OR groups', () => {
    const filter: ConditionGroup = {
      id: 'g',
      kind: 'group',
      logic: 'and',
      items: [
        { id: '1', kind: 'condition', left: f('s', 's-a'), op: 'gt', values: [100] },
        { id: '2', kind: 'condition', left: f('s', 's-a'), op: 'gte', values: [100] },
        { id: '3', kind: 'condition', left: f('s', 's-a'), op: 'lt', values: [1000] },
        { id: '4', kind: 'condition', left: f('s', 's-a'), op: 'lte', values: [1000] },
        { id: '5', kind: 'condition', left: f('s', 's-c'), op: 'neq', values: [0] },
        {
          id: 'g2',
          kind: 'group',
          logic: 'or',
          items: [
            { id: '6', kind: 'condition', left: f('c', 'c-r'), op: 'eq', values: ['EU'] },
            { id: '7', kind: 'condition', left: f('c', 'c-r'), op: 'in', values: ['TR', 'US'] },
            { id: '8', kind: 'condition', left: f('c', 'c-r'), op: 'notIn', values: ['XX'] },
            { id: '9', kind: 'condition', left: f('c', 'c-n'), op: 'contains', values: ["O'Brien"] },
            { id: '10', kind: 'condition', left: f('c', 'c-n'), op: 'startsWith', values: ['A'] },
          ],
        },
        { id: '11', kind: 'condition', left: f('c', 'c-n'), op: 'isNotNull', values: [] },
        { id: '12', kind: 'condition', left: f('c', 'c-r'), op: 'isNull', values: [] },
        {
          id: '13',
          kind: 'condition',
          left: f('s', 's-d'),
          op: 'between',
          values: ['2024-01-01', '2024-12-31'],
        },
      ],
    };
    const p = project({
      sources: starSources(),
      links: [link('l', 'leftJoin', 's', 'c', [['s-c', 'c-c']])],
      targets: [target('t', 'Filtered', 's', [col('c1', 's', 's-o'), col('c2', 'c', 'c-n')], { filter })],
    });
    expect(generateScript(p)).toMatchSnapshot();
  });

  it('renders every calculated-field kind', () => {
    const columns: TargetColumn[] = [
      col('k', 's', 's-o'),
      {
        id: 'x1',
        kind: 'calculated',
        alias: 'Full',
        expr: { kind: 'concat', parts: [f('c', 'c-n'), f('c', 'c-r')], separator: ' - ' },
      },
      {
        id: 'x2',
        kind: 'calculated',
        alias: 'Plain Concat',
        expr: { kind: 'concat', parts: [f('c', 'c-n'), lit('!')], separator: '' },
      },
      {
        id: 'x3',
        kind: 'calculated',
        alias: 'Net',
        expr: { kind: 'arith', op: '*', left: f('s', 's-a'), right: lit(0.8), safeDivide: false },
      },
      {
        id: 'x4',
        kind: 'calculated',
        alias: 'Per Unit',
        expr: { kind: 'arith', op: '/', left: f('s', 's-a'), right: lit(2), safeDivide: true },
      },
      {
        id: 'x5',
        kind: 'calculated',
        alias: 'Plain Div',
        expr: { kind: 'arith', op: '/', left: f('s', 's-a'), right: lit(2), safeDivide: false },
      },
      {
        id: 'x6',
        kind: 'calculated',
        alias: 'Share',
        expr: { kind: 'percent', part: f('s', 's-a'), whole: lit(1000) },
      },
      {
        id: 'x7',
        kind: 'calculated',
        alias: 'Big',
        expr: {
          kind: 'if',
          condition: {
            id: 'g',
            kind: 'group',
            logic: 'and',
            items: [{ id: '1', kind: 'condition', left: f('s', 's-a'), op: 'gt', values: [500] }],
          },
          then: lit('Large'),
          else: lit('Small'),
        },
      },
      {
        id: 'x8',
        kind: 'calculated',
        alias: 'Flag',
        expr: {
          kind: 'if',
          condition: { id: 'g', kind: 'group', logic: 'or', items: [] },
          then: lit(1),
          else: null,
        },
      },
      {
        id: 'x9',
        kind: 'calculated',
        alias: 'Y',
        expr: { kind: 'datePart', part: 'year', of: f('s', 's-d') },
      },
      {
        id: 'x10',
        kind: 'calculated',
        alias: 'Q',
        expr: { kind: 'datePart', part: 'quarter', of: f('s', 's-d') },
      },
      {
        id: 'x11',
        kind: 'calculated',
        alias: 'M',
        expr: { kind: 'datePart', part: 'month', of: f('s', 's-d') },
      },
      {
        id: 'x12',
        kind: 'calculated',
        alias: 'MN',
        expr: { kind: 'datePart', part: 'monthName', of: f('s', 's-d') },
      },
      {
        id: 'x13',
        kind: 'calculated',
        alias: 'W',
        expr: { kind: 'datePart', part: 'week', of: f('s', 's-d') },
      },
      {
        id: 'x14',
        kind: 'calculated',
        alias: 'D',
        expr: { kind: 'datePart', part: 'day', of: f('s', 's-d') },
      },
      {
        id: 'x15',
        kind: 'calculated',
        alias: 'WD',
        expr: { kind: 'datePart', part: 'weekday', of: f('s', 's-d') },
      },
      {
        id: 'x16',
        kind: 'calculated',
        alias: 'YM',
        expr: { kind: 'datePart', part: 'yearMonth', of: f('s', 's-d') },
      },
      {
        id: 'x17',
        kind: 'calculated',
        alias: 'RowKey',
        expr: { kind: 'autoNumber', of: f('s', 's-o'), counterName: 'orders' },
      },
      {
        id: 'x18',
        kind: 'calculated',
        alias: 'RowKey2',
        expr: { kind: 'autoNumber', of: f('s', 's-o'), counterName: null },
      },
      {
        id: 'x19',
        kind: 'calculated',
        alias: 'Upper',
        expr: { kind: 'raw', text: ' Upper([Customer Name]) ' },
      },
    ];
    const p = project({
      sources: starSources(),
      links: [link('l', 'leftJoin', 's', 'c', [['s-c', 'c-c']])],
      targets: [target('t', 'Calc', 's', columns)],
    });
    expect(generateScript(p)).toMatchSnapshot();
  });

  it('includes calculated columns in GROUP BY as expressions', () => {
    const p = project({
      sources: starSources(),
      targets: [
        target('t', 'ByYear', 's', [
          {
            id: 'x',
            kind: 'calculated',
            alias: 'Year',
            expr: { kind: 'datePart', part: 'year', of: f('s', 's-d') },
          },
          { id: 'm', kind: 'measure', ref: ref('s', 's-a'), aggregation: 'sum', alias: 'Total' },
        ]),
      ],
    });
    expect(generateScript(p)).toContain('GROUP BY Year(OrderDate);');
  });

  it('can build a target from another target', () => {
    const p = project({
      sources: starSources(),
      targets: [
        target('t1', 'Fact', 's', [col('a', 's', 's-c'), col('b', 's', 's-a')], { keepInModel: false }),
        target('t2', 'Agg', 't1', [
          { id: 'c', kind: 'field', ref: ref('t1', 'a'), alias: null },
          { id: 'm', kind: 'measure', ref: ref('t1', 'b'), aggregation: 'sum', alias: 'Total' },
        ]),
      ],
    });
    const script = generateScript(p);
    expect(script.indexOf('Fact:')).toBeLessThan(script.indexOf('Agg:'));
    expect(script).toContain('RESIDENT Fact\nGROUP BY CustomerID;');
    expect(script).toContain('DROP TABLE Fact;');
  });

  it('rejects fields from tables that are not joined into the primary table', () => {
    const p = project({
      sources: starSources(),
      targets: [target('t', 'Bad', 's', [col('c1', 's', 's-o'), col('c2', 'c', 'c-n')])],
    });
    const errors = validateModel(p);
    expect(errors.map((e) => e.code)).toEqual(['FIELD_NOT_REACHABLE']);
    expect(errors[0]!.fixes[0]).toMatchObject({
      kind: 'createLink',
      type: 'leftJoin',
      leftTableId: 's',
      rightTableId: 'c',
      pairs: [{ leftFieldId: 's-c', rightFieldId: 'c-c' }],
    });
  });

  it('rejects ignored fields, empty targets, missing primaries, duplicate columns and empty raw expressions', () => {
    const sources = starSources();
    sources[0]!.fields[4]!.role = 'ignore';
    const p = project({
      sources,
      targets: [
        target('t1', 'Empty', 's', []),
        target('t2', 'NoPrimary', 's', [col('c', 's', 's-o')], { primarySourceId: null }),
        target('t3', 'Dupes', 's', [col('c1', 's', 's-o', 'X'), col('c2', 's', 's-c', 'x')]),
        target('t4', 'Ignored', 's', [col('c1', 's', 's-a')]),
        target('t5', 'Raw', 's', [
          { id: 'r', kind: 'calculated', alias: 'R', expr: { kind: 'raw', text: '  ' } },
        ]),
        target('t6', 'Dangling', 's', [col('c1', 's', 'nope')]),
      ],
    });
    expect(
      validateModel(p)
        .map((e) => e.code)
        .sort(),
    ).toEqual(
      [
        'DUPLICATE_FIELD_NAME',
        'FIELD_IGNORED',
        'FIELD_NOT_FOUND',
        'RAW_EXPRESSION_EMPTY',
        'TARGET_NO_COLUMNS',
        'TARGET_PRIMARY_MISSING',
      ].sort(),
    );
  });
});
