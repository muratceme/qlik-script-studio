import { describe, expect, it } from 'vitest';
import { generateScript } from '@/generator';
import { isPlainIdentifier, joinPath, qName, qStr } from '@/generator/quote';
import { field, project, source } from './helpers';

describe('quoting', () => {
  it('brackets names with spaces, special characters, digits first, and keywords', () => {
    expect(qName('OrderID')).toBe('OrderID');
    expect(qName('Order ID')).toBe('[Order ID]');
    expect(qName('Satış Tutarı')).toBe('[Satış Tutarı]');
    expect(qName('2024_Sales')).toBe('[2024_Sales]');
    expect(qName('Amount-Net')).toBe('[Amount-Net]');
    expect(qName('Group')).toBe('[Group]');
    expect(qName('from')).toBe('[from]');
    expect(qName('%Key')).toBe('[%Key]');
  });

  it('escapes single quotes in strings', () => {
    expect(qStr("O'Brien")).toBe("'O''Brien'");
  });

  it('identifies plain identifiers', () => {
    expect(isPlainIdentifier('_x1')).toBe(true);
    expect(isPlainIdentifier('a.b')).toBe(false);
  });

  it('joins connection and path', () => {
    expect(joinPath('lib://DataFiles', 'Sales.qvd')).toBe('lib://DataFiles/Sales.qvd');
    expect(joinPath('lib://DataFiles/', '/sub/Sales.qvd')).toBe('lib://DataFiles/sub/Sales.qvd');
    expect(joinPath(null, 'lib://X/Sales.qvd')).toBe('lib://X/Sales.qvd');
  });

  it('brackets table and field names with special characters in a full script', () => {
    const p = project({
      sources: [
        source('a', 'Satış Verisi', 'qvd', [
          field('f1', 'Sipariş No', { role: 'key' }),
          field('f2', 'Tutar (TL)', { role: 'measure', dataType: 'money', alias: 'Net Tutar' }),
          field('f3', 'Group'),
        ]),
      ],
    });
    expect(generateScript(p)).toMatchSnapshot();
  });
});
