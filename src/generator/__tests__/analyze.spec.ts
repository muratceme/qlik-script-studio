import { describe, expect, it } from 'vitest';
import { analyzeModel, validateModel } from '@/generator';
import { findCycle } from '@/generator/analyze';
import { col, field, link, project, source, starSources, target } from './helpers';

describe('synthetic key detection', () => {
  it('warns when two surviving tables share two field names and proposes fixes', () => {
    const sources = starSources();
    sources[0]!.keepInModel = true;
    // Sales and Customers both have CustomerID; add Region to Sales too.
    sources[0]!.fields.push(field('s-r', 'Region'));
    const p = project({ sources });
    const warnings = analyzeModel(p);
    const synth = warnings.filter((w) => w.code === 'SYNTHETIC_KEY');
    expect(synth).toHaveLength(2); // Sales-Customers and Customers-Products (Region) ... and Sales-Products? only Region+ProductID
    const sc = synth.find((w) => w.params.left === 'Sales' && w.params.right === 'Customers')!;
    expect(sc.params.fields).toBe('CustomerID, Region');
    expect(sc.fixes).toEqual(
      expect.arrayContaining([
        { kind: 'renameField', tableId: 'c', fieldId: 'c-r', newName: 'Region_Customers' },
        { kind: 'qualifyTable', tableId: 'c' },
      ]),
    );
  });

  it('proposes a composite key when a link with two pairs exists', () => {
    const a = source('a', 'Budget', 'qvd', [field('a1', 'Year', { role: 'key' }), field('a2', 'Region', { role: 'key' })]);
    const b = source('b', 'Actuals', 'qvd', [field('b1', 'Year', { role: 'key' }), field('b2', 'Region', { role: 'key' })]);
    const p = project({ sources: [a, b], links: [link('l', 'association', 'a', 'b', [['a1', 'b1'], ['a2', 'b2']])] });
    const synth = analyzeModel(p).find((w) => w.code === 'SYNTHETIC_KEY')!;
    expect(synth.fixes).toContainEqual({ kind: 'compositeKey', linkId: 'l', mode: 'autoNumber' });
  });

  it('is silent once a composite key replaces the shared fields', () => {
    const a = source('a', 'Budget', 'qvd', [field('a1', 'Year', { role: 'key' }), field('a2', 'Region', { role: 'key' })]);
    const b = source('b', 'Actuals', 'qvd', [field('b1', 'Year', { role: 'key' }), field('b2', 'Region', { role: 'key' })]);
    const p = project({ sources: [a, b], links: [link('l', 'association', 'a', 'b', [['a1', 'b1'], ['a2', 'b2']], { compositeKey: { mode: 'autoNumber', name: '%K', separator: '|' } })] });
    expect(analyzeModel(p).map((w) => w.code)).not.toContain('SYNTHETIC_KEY');
  });

  it('ignores dropped tables and counts fields brought in by joins', () => {
    const sources = starSources();
    sources[2]!.fields.push(field('p-c', 'CustomerID', { role: 'key' }));
    const p = project({
      sources,
      links: [link('l', 'leftJoin', 's', 'c', [['s-c', 'c-c']])],
      targets: [target('t', 'Fact', 's', [col('a', 's', 's-o'), col('b', 's', 's-c'), col('c', 's', 's-p'), col('d', 'c', 'c-r')])],
    });
    // Fact has CustomerID, ProductID, Region; Products has ProductID, Region, CustomerID -> synthetic key.
    const synth = analyzeModel(p).filter((w) => w.code === 'SYNTHETIC_KEY');
    expect(synth).toHaveLength(1);
    expect(synth[0]!.params).toMatchObject({ left: 'Products', right: 'Fact' });
  });
});

describe('circular reference detection', () => {
  it('finds a cycle of three tables', () => {
    const adjacency = new Map<string, Map<string, string>>([
      ['a', new Map([['b', 'x'], ['c', 'z']])],
      ['b', new Map([['a', 'x'], ['c', 'y']])],
      ['c', new Map([['b', 'y'], ['a', 'z']])],
    ]);
    expect(findCycle(['a', 'b', 'c'], adjacency)).toHaveLength(3);
    const tree = new Map<string, Map<string, string>>([
      ['a', new Map([['b', 'x']])],
      ['b', new Map([['a', 'x'], ['c', 'y']])],
      ['c', new Map([['b', 'y']])],
    ]);
    expect(findCycle(['a', 'b', 'c'], tree)).toBeNull();
  });

  it('warns about a circular reference in the model and proposes a rename', () => {
    const sources = starSources();
    sources[0]!.keepInModel = true;
    // Sales-Customers (CustomerID), Sales-Products (ProductID), Customers-Products (Region) => loop.
    const p = project({ sources });
    const warnings = analyzeModel(p);
    const circ = warnings.find((w) => w.code === 'CIRCULAR_REFERENCE')!;
    expect(circ).toBeDefined();
    expect(circ.refs.tableIds).toHaveLength(3);
    expect(circ.fixes.some((f) => f.kind === 'renameField' && f.newName.startsWith('Region_'))).toBe(true);
  });

  it('is silent for a star schema', () => {
    const sources = starSources();
    sources[0]!.keepInModel = true;
    sources[2]!.fields = sources[2]!.fields.filter((f) => f.id !== 'p-r');
    expect(analyzeModel(project({ sources })).map((w) => w.code)).toEqual([]);
  });
});

describe('other warnings', () => {
  it('flags key type mismatches', () => {
    const sources = starSources();
    sources[1]!.fields[0]!.dataType = 'text';
    const p = project({ sources, links: [link('l', 'association', 's', 'c', [['s-c', 'c-c']])] });
    const w = analyzeModel(p).find((x) => x.code === 'KEY_TYPE_MISMATCH')!;
    expect(w.params).toMatchObject({ leftType: 'number', rightType: 'text' });
  });

  it('treats money and number as compatible', () => {
    const sources = starSources();
    sources[1]!.fields[0]!.dataType = 'money';
    const p = project({ sources, links: [link('l', 'association', 's', 'c', [['s-c', 'c-c']])] });
    expect(analyzeModel(p).map((x) => x.code)).not.toContain('KEY_TYPE_MISMATCH');
  });

  it('flags join fan-out when the looked-up key is neither unique nor a key', () => {
    const sources = starSources();
    sources[1]!.fields[0]!.role = 'dimension';
    sources[1]!.fields[0]!.isUnique = false;
    const p = project({ sources, links: [link('l', 'leftJoin', 's', 'c', [['s-c', 'c-c']])] });
    const w = analyzeModel(p).find((x) => x.code === 'JOIN_FANOUT_RISK')!;
    expect(w.params.table).toBe('Customers');
    expect(w.fixes).toEqual([{ kind: 'setRole', tableId: 'c', fieldId: 'c-c', role: 'key' }]);
    // Right join looks up the left side instead.
    const p2 = project({ sources: starSources(), links: [link('l', 'rightJoin', 's', 'c', [['s-c', 'c-c']])] });
    expect(analyzeModel(p2).map((x) => x.code)).not.toContain('JOIN_FANOUT_RISK');
  });

  it('flags common fields that silently join', () => {
    const sources = starSources();
    sources[0]!.fields.push(field('s-r', 'Region'));
    const p = project({ sources, links: [link('l', 'leftJoin', 's', 'c', [['s-c', 'c-c']])] });
    const w = analyzeModel(p).find((x) => x.code === 'JOIN_UNINTENDED_COMMON_FIELD')!;
    expect(w.params.fields).toBe('Region');
    expect(w.fixes).toEqual([{ kind: 'renameField', tableId: 'c', fieldId: 'c-r', newName: 'Region_Customers' }]);
  });

  it('flags implicit concatenation of identical tables', () => {
    const a = source('a', 'Sales2023', 'qvd', [field('a1', 'OrderID'), field('a2', 'Amount')]);
    const b = source('b', 'Sales2024', 'qvd', [field('b1', 'OrderID'), field('b2', 'Amount')]);
    const w = analyzeModel(project({ sources: [a, b] })).find((x) => x.code === 'IMPLICIT_CONCATENATE')!;
    expect(w.fixes.map((f) => f.kind === 'createLink' && f.type)).toEqual(['noConcatenate', 'concatenate']);
    expect(analyzeModel(project({ sources: [a, b], links: [link('l', 'noConcatenate', 'a', 'b', [])] })).map((x) => x.code)).not.toContain('IMPLICIT_CONCATENATE');
  });
});

describe('name validation', () => {
  it('rejects empty, bracketed and duplicate names', () => {
    const p = project({
      sources: [
        source('a', 'Sales', 'qvd', [field('a1', ''), field('a2', 'Bad]Name'), field('a3', 'X'), field('a4', 'x')]),
        source('b', 'sales', 'qvd', [field('b1', 'ID')]),
      ],
    });
    expect(validateModel(p).map((e) => e.code).sort()).toEqual(['DUPLICATE_FIELD_NAME', 'DUPLICATE_TABLE_NAME', 'EMPTY_NAME', 'INVALID_NAME'].sort());
  });

  it('rejects an empty project', () => {
    expect(validateModel(project()).map((e) => e.code)).toEqual(['EMPTY_PROJECT']);
  });
});
