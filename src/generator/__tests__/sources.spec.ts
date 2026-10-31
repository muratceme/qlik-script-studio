import { describe, expect, it } from 'vitest';
import { generateScript, validateModel } from '@/generator';
import { dbConnection, field, project, source } from './helpers';

// Field ids are unique per project, so each table gets its own prefix.
const fields = (prefix = 'f') => [
  field(`${prefix}1`, 'ID', { role: 'key', dataType: 'number' }),
  field(`${prefix}2`, 'Order Date', { role: 'date', dataType: 'date', dateFormat: 'DD.MM.YYYY' }),
  field(`${prefix}3`, 'Amount', { role: 'measure', dataType: 'money', alias: 'Sales Amount' }),
  field(`${prefix}4`, 'Note', { role: 'ignore' }),
];

describe('source loads', () => {
  it('QVD: plain field list, ignored fields skipped, no date parsing', () => {
    const p = project({
      sources: [source('a', 'Sales', 'qvd', fields())],
      settings: { ...project().settings, useTabs: false },
    });
    expect(generateScript(p)).toMatchSnapshot();
  });

  it('Excel: ooxml with sheet and header offset; biff for .xls', () => {
    const xlsx = source('a', 'Customers', 'excel', fields(), {
      excel: { sheet: 'Data Sheet', headerRow: 3 },
    });
    const xls = source('b', 'Legacy', 'excel', fields('g'), {
      path: 'old.xls',
      excel: { sheet: 'Sheet1', headerRow: 1 },
    });
    expect(generateScript(project({ sources: [xlsx, xls] }))).toMatchSnapshot();
  });

  it('CSV: delimiters, encodings and headerless files', () => {
    const semicolon = source('a', 'Products', 'csv', fields(), {
      csv: { delimiter: ';', encoding: 'utf8', hasHeader: true, msq: true },
    });
    const tab = source('b', 'Prices', 'csv', fields('g'), {
      csv: { delimiter: '\t', encoding: 'unicode', hasHeader: true, msq: false },
    });
    const ansi = source('c', 'Regions', 'csv', fields('h'), {
      csv: { delimiter: '|', encoding: 'ansi', hasHeader: false, msq: true },
    });
    expect(generateScript(project({ sources: [semicolon, tab, ansi] }))).toMatchSnapshot();
  });

  it('CSV ansi code page follows the regional preset', () => {
    const p = project({
      sources: [
        source('a', 'Regions', 'csv', fields(), {
          csv: { delimiter: ',', encoding: 'ansi', hasHeader: true, msq: true },
        }),
      ],
      settings: { ...project().settings, locale: 'tr' },
    });
    expect(generateScript(p)).toContain('codepage is 1254');
  });

  it('SQL: LIB CONNECT TO, preceding LOAD with aliases, SQL SELECT', () => {
    const p = project({
      connections: [dbConnection],
      sources: [
        source('a', 'Orders', 'sql', fields(), {
          connectionId: 'db1',
          sql: { query: 'SELECT ID, OrderDate, Amount FROM dbo.Orders;' },
        }),
      ],
    });
    expect(generateScript(p)).toMatchSnapshot();
  });

  it('SQL without fields loads *', () => {
    const p = project({
      connections: [dbConnection],
      sources: [source('a', 'Orders', 'sql', [], { connectionId: 'db1' })],
    });
    expect(generateScript(p)).toContain('LOAD *;\nSQL SELECT * FROM Orders;');
  });

  it('QlikView dialect uses CONNECT TO and backslash paths', () => {
    const p = project({
      connections: [dbConnection, { id: 'c1', name: 'C:\\Data', kind: 'folder' }],
      sources: [
        source('a', 'Orders', 'sql', [], { connectionId: 'db1' }),
        source('b', 'Sales', 'qvd', [field('x', 'ID')]),
      ],
      settings: { ...project().settings, dialect: 'view' },
    });
    const script = generateScript(p);
    expect(script).toContain("CONNECT TO 'SQL_Server';");
    expect(script).toContain('FROM [C:\\Data\\Sales.qvd] (qvd);');
  });

  it('Inline: plain INLINE, quoted values, preceding LOAD only when renaming', () => {
    const plain = source('a', 'Regions', 'inline', [field('r1', 'Code'), field('r2', 'Name')], {
      inline: {
        rows: [
          ['Code', 'Name'],
          ['TR', 'Türkiye'],
          ['US', 'United States, of America'],
        ],
      },
    });
    const renamed = source('b', 'Flags', 'inline', [field('g1', 'Flag', { alias: 'IsActive' })], {
      inline: { rows: [['Flag'], ['1']] },
    });
    expect(generateScript(project({ sources: [plain, renamed] }))).toMatchSnapshot();
  });

  it('loads * when a table has no fields', () => {
    const p = project({ sources: [source('a', 'Everything', 'qvd', [])] });
    expect(generateScript(p)).toContain('Everything:\nLOAD *\nFROM [lib://DataFiles/Everything.qvd] (qvd);');
  });

  it('keeps unconsumed sources even when keepInModel is false', () => {
    const p = project({ sources: [source('a', 'Sales', 'qvd', fields())] });
    expect(generateScript(p)).not.toContain('DROP TABLE');
  });

  it('reports missing paths, sheets, queries and inline data', () => {
    const p = project({
      connections: [dbConnection],
      sources: [
        source('a', 'A', 'qvd', [], { path: '' }),
        source('b', 'B', 'excel', [], { excel: { sheet: '', headerRow: 1 } }),
        source('c', 'C', 'sql', [], { connectionId: null, sql: { query: '' } }),
        source('d', 'D', 'inline', [], { inline: { rows: [] } }),
      ],
    });
    expect(
      validateModel(p)
        .map((d) => d.code)
        .sort(),
    ).toEqual(
      [
        'EXCEL_SHEET_MISSING',
        'INLINE_EMPTY',
        'SOURCE_CONNECTION_MISSING',
        'SOURCE_PATH_MISSING',
        'SQL_QUERY_MISSING',
      ].sort(),
    );
  });
});
