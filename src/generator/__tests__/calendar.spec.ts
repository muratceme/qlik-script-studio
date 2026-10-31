import { describe, expect, it } from 'vitest';
import { analyzeModel, generateScript, validateModel } from '@/generator';
import { col, project, ref, starSources, target } from './helpers';

describe('master calendar', () => {
  it('generates the calendar from a source date field with all parts', () => {
    const p = project({
      sources: starSources(),
      calendar: { enabled: true, tableName: 'Calendar', dateField: ref('s', 's-d'), parts: ['year', 'quarter', 'month', 'monthName', 'week', 'day', 'weekday', 'yearMonth'] },
    });
    expect(generateScript(p)).toMatchSnapshot();
  });

  it('uses a target column and a subset of parts', () => {
    const p = project({
      sources: starSources(),
      targets: [target('t', 'Fact', 's', [col('d', 's', 's-d', 'Order Date'), col('a', 's', 's-a')])],
      calendar: { enabled: true, tableName: 'Master Calendar', dateField: ref('t', 'd'), parts: ['year', 'month'] },
    });
    const script = generateScript(p);
    expect(script).toContain('[Master Calendar]:');
    expect(script).toContain('RESIDENT Fact;');
    expect(script).toContain('Year([Order Date])');
    expect(script).not.toContain('Week(');
  });

  it('is silent when disabled and errors when the date field is missing', () => {
    const off = project({ sources: starSources(), calendar: { enabled: false, tableName: 'Calendar', dateField: null, parts: ['year'] } });
    expect(generateScript(off)).not.toContain('Calendar');
    const broken = project({ sources: starSources(), calendar: { enabled: true, tableName: 'Calendar', dateField: null, parts: ['year'] } });
    expect(validateModel(broken).map((e) => e.code)).toEqual(['CALENDAR_DATE_MISSING']);
  });

  it('warns when the calendar is attached to a table that gets dropped', () => {
    const p = project({
      sources: starSources(),
      targets: [target('t', 'Fact', 's', [col('a', 's', 's-a')])],
      calendar: { enabled: true, tableName: 'Calendar', dateField: ref('s', 's-d'), parts: ['year'] },
    });
    const warnings = analyzeModel(p);
    expect(warnings.map((w) => w.code)).toContain('DROPPED_TABLE_REFERENCED');
    expect(warnings.find((w) => w.code === 'DROPPED_TABLE_REFERENCED')!.fixes).toEqual([{ kind: 'keepTable', tableId: 's' }]);
  });
});
