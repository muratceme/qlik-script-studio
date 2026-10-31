import { describe, expect, it } from 'vitest';
import { generateScript, validateModel } from '@/generator';
import { col, field, link, project, ref, source, starSources, target } from './helpers';

describe('links', () => {
  it.each(['leftJoin', 'rightJoin', 'innerJoin', 'outerJoin'] as const)('%s renders the right table RESIDENT into the left', (type) => {
    const p = project({
      sources: starSources(),
      links: [link('l', type, 's', 'c', [['s-c', 'c-c']])],
      targets: [target('t', 'Fact', 's', [col('a', 's', 's-o'), col('b', 'c', 'c-n')])],
    });
    const script = generateScript(p);
    expect(script).toContain(`${type.replace('Join', '').toUpperCase()} JOIN (Sales)\nLOAD\n    CustomerID,\n    [Customer Name],\n    Region\nRESIDENT Customers;`);
    expect(script.indexOf('JOIN (Sales)')).toBeLessThan(script.indexOf('Fact:'));
    expect(script).toContain('DROP TABLE Customers;');
  });

  it('renames keys with different names and emits full snapshot', () => {
    const sources = starSources();
    sources[1]!.fields[0]!.name = 'CustID';
    const p = project({
      sources,
      links: [
        link('l1', 'leftJoin', 's', 'c', [['s-c', 'c-c']]),
        link('l2', 'innerJoin', 's', 'p', [['s-p', 'p-p']]),
      ],
      targets: [target('t', 'Fact', 's', [col('a', 's', 's-o'), col('b', 'c', 'c-n'), col('c', 'p', 'p-n')])],
    });
    const script = generateScript(p);
    expect(script).toContain('CustID AS CustomerID');
    expect(script).toMatchSnapshot();
  });

  it.each(['leftKeep', 'rightKeep', 'innerKeep'] as const)('%s uses a temporary table and rename', (type) => {
    const p = project({ sources: starSources(), links: [link('l', type, 's', 'c', [['s-c', 'c-c']])] });
    const script = generateScript(p);
    expect(script).toContain(`Customers_keep:\nNoConcatenate\n${type.replace('Keep', '').toUpperCase()} KEEP (Sales)\nLOAD\n    CustomerID,\n    [Customer Name],\n    Region\nRESIDENT Customers;\nDROP TABLE Customers;\nRENAME TABLE Customers_keep TO Customers;`);
    // Keep does not consume either table.
    expect(script).not.toContain('///$tab Cleanup');
  });

  it('concatenate appends rows and drops the right table', () => {
    const a = source('a', 'Sales2023', 'qvd', [field('a1', 'OrderID'), field('a2', 'Amount')]);
    const b = source('b', 'Sales2024', 'qvd', [field('b1', 'OrderID'), field('b2', 'Amount')]);
    const p = project({ sources: [a, b], links: [link('l', 'concatenate', 'a', 'b', [])] });
    const script = generateScript(p);
    expect(script).toContain('CONCATENATE (Sales2023)\nLOAD\n    OrderID,\n    Amount\nRESIDENT Sales2024;');
    expect(script).toContain('DROP TABLE Sales2024;');
    expect(script).toMatchSnapshot();
  });

  it('noConcatenate prefixes both loads and nothing is merged', () => {
    const a = source('a', 'Sales2023', 'qvd', [field('a1', 'OrderID'), field('a2', 'Amount')]);
    const b = source('b', 'Sales2024', 'qvd', [field('b1', 'OrderID'), field('b2', 'Amount')]);
    const p = project({ sources: [a, b], links: [link('l', 'noConcatenate', 'a', 'b', [])] });
    const script = generateScript(p);
    expect(script).toContain('Sales2023:\nNoConcatenate\nLOAD');
    expect(script).toContain('Sales2024:\nNoConcatenate\nLOAD');
    expect(script).not.toContain('CONCATENATE');
  });

  it('association with rename aliases the right field to the left name', () => {
    const sources = starSources();
    sources[1]!.fields[0]!.name = 'CustID';
    const p = project({ sources, links: [link('l', 'association', 's', 'c', [['s-c', 'c-c']], { renameRightToLeft: true })] });
    const script = generateScript(p);
    expect(script).toContain('CustID AS CustomerID');
    expect(script).not.toContain('JOIN');
  });

  it('composite keys: concat and AutoNumber on both sides of a join', () => {
    const a = source('a', 'Budget', 'qvd', [field('a1', 'Year', { role: 'key' }), field('a2', 'Region', { role: 'key' }), field('a3', 'Budget', { role: 'measure', dataType: 'money' })]);
    const b = source('b', 'Actuals', 'qvd', [field('b1', 'Year', { role: 'key' }), field('b2', 'Region', { role: 'key' }), field('b3', 'Actual', { role: 'measure', dataType: 'money' })]);
    const concat = project({ sources: [a, b], links: [link('l', 'leftJoin', 'a', 'b', [['a1', 'b1'], ['a2', 'b2']], { compositeKey: { mode: 'concat', name: '%YearRegion', separator: '|' } })] });
    const auto = project({ sources: [a, b], links: [link('l', 'association', 'a', 'b', [['a1', 'b1'], ['a2', 'b2']], { compositeKey: { mode: 'autoNumber', name: '%YearRegion', separator: '|' } })] });
    const s1 = generateScript(concat);
    expect(s1).toContain("Year & '|' & Region AS [%YearRegion]");
    expect(s1).toMatch(/Actuals:\nLOAD\n {4}Year,\n {4}Region,\n {4}Actual\n/);
    expect(s1).toContain("LEFT JOIN (Budget)\nLOAD\n    Year & '|' & Region AS [%YearRegion],\n    Actual\nRESIDENT Actuals;");
    const s2 = generateScript(auto);
    expect(s2).toContain("AutoNumber(Year & '|' & Region, '%YearRegion') AS [%YearRegion]");
    // Right side of an association drops the original key fields.
    expect(s2).toMatch(/Actuals:\nLOAD\n {4}Actual,\n {4}AutoNumber/);
    expect(s1).toMatchSnapshot();
    expect(s2).toMatchSnapshot();
  });

  it('ApplyMap: mapping table after its source, mapped field in the left load, default value', () => {
    const regions = source('r', 'Regions', 'inline', [field('r1', 'RegionCode', { role: 'key' }), field('r2', 'RegionName')], {
      inline: { rows: [['RegionCode', 'RegionName'], ['TR', 'Türkiye']] },
    });
    const sources = [...starSources(), regions];
    const p = project({
      sources,
      links: [link('m', 'applyMap', 'c', 'r', [['c-r', 'r1']], { applyMap: { keyFieldId: 'r1', valueFieldId: 'r2', defaultValue: 'Unknown', mapName: 'Map_Region', outputName: 'Region Name' } })],
    });
    const script = generateScript(p);
    expect(script.indexOf('Regions:')).toBeLessThan(script.indexOf('Map_Region:'));
    expect(script.indexOf('Map_Region:')).toBeLessThan(script.indexOf('Customers:'));
    expect(script).toContain("ApplyMap('Map_Region', Region, 'Unknown') AS [Region Name]");
    expect(script).toContain('DROP TABLE Regions;');
    expect(script).toMatchSnapshot();
  });

  it('ApplyMap without default and as a calculated target column', () => {
    const regions = source('r', 'Regions', 'qvd', [field('r1', 'RegionCode', { role: 'key' }), field('r2', 'RegionName')]);
    const p = project({
      sources: [...starSources(), regions],
      links: [link('m', 'applyMap', 't', 'r', [['x', 'r1']], { applyMap: { keyFieldId: 'r1', valueFieldId: 'r2', defaultValue: null, mapName: 'Map_Region', outputName: 'RegionName' } })],
      targets: [
        target('t', 'Fact', 'c', [
          col('x', 'c', 'c-r'),
          { id: 'y', kind: 'calculated', alias: 'Looked Up', expr: { kind: 'applyMap', linkId: 'm', key: { kind: 'field', ref: ref('c', 'c-r') } } },
        ]),
      ],
    });
    const script = generateScript(p);
    expect(script).toContain("ApplyMap('Map_Region', Region) AS [Looked Up]");
    expect(script).toContain("ApplyMap('Map_Region', Region) AS RegionName");
  });

  it('orders targets and links: join a target into a source before another target reads it', () => {
    const p = project({
      sources: starSources(),
      targets: [
        target('t1', 'CustAgg', 'c', [col('a', 'c', 'c-c'), col('b', 'c', 'c-r')], { keepInModel: false }),
        target('t2', 'Fact', 's', [col('c', 's', 's-o'), { id: 'd', kind: 'field', ref: ref('t1', 'b'), alias: null }]),
      ],
      links: [link('l', 'leftJoin', 's', 't1', [['s-c', 'a']])],
    });
    const script = generateScript(p);
    const i1 = script.indexOf('CustAgg:');
    const i2 = script.indexOf('LEFT JOIN (Sales)');
    const i3 = script.indexOf('Fact:');
    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i3);
    expect(script).toContain('DROP TABLE CustAgg;');
  });

  it('qualifies a table when requested', () => {
    const sources = starSources();
    sources[1]!.qualify = true;
    const p = project({ sources });
    const script = generateScript(p);
    expect(script).toContain('QUALIFY *;\nUNQUALIFY CustomerID;\nCustomers:');
    expect(script).toContain('(qvd);\nUNQUALIFY *;');
  });

  it('validates links', () => {
    const p = project({
      sources: starSources(),
      links: [
        link('l1', 'leftJoin', 's', 'c', []),
        link('l2', 'innerJoin', 's', 's', [['s-c', 's-c']]),
        link('l3', 'leftJoin', 's', 'nope', [['s-c', 'c-c']]),
        link('l4', 'applyMap', 's', 'c', [['s-c', 'c-c']], { applyMap: null }),
        link('l5', 'leftJoin', 's', 'c', [['s-c', 'zzz']]),
      ],
    });
    expect(validateModel(p).map((e) => e.code).sort()).toEqual(['APPLYMAP_FIELDS_MISSING', 'FIELD_NOT_FOUND', 'LINK_NO_PAIRS', 'LINK_SELF', 'LINK_TABLE_MISSING'].sort());
  });

  it('detects cyclic dependencies between targets and links', () => {
    const p = project({
      sources: starSources(),
      targets: [target('t1', 'A', 's', [col('a', 's', 's-o')]), target('t2', 'B', 't1', [{ id: 'b', kind: 'field', ref: ref('t1', 'a'), alias: null }])],
      links: [link('l', 'leftJoin', 's', 't2', [['s-o', 'b']])],
    });
    expect(validateModel(p).map((e) => e.code)).toContain('CYCLIC_DEPENDENCY');
  });
});
