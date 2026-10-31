import { describe, expect, it } from 'vitest';
import { generateScript } from '@/generator';
import { field, project, source } from './helpers';

const base = () => project({ sources: [source('a', 'Sales', 'qvd', [field('f1', 'ID')])] });

describe('settings', () => {
  it('emits the Turkish regional preset', () => {
    const p = base();
    p.settings.locale = 'tr';
    const script = generateScript(p);
    expect(script).toContain("SET ThousandSep='.';");
    expect(script).toContain("SET DecimalSep=',';");
    expect(script).toContain("SET DateFormat='DD.MM.YYYY';");
    expect(script).toContain("SET CollationLocale='tr-TR';");
    expect(script).toMatchSnapshot();
  });

  it('switches between $tab markers and comment banners', () => {
    const withTabs = generateScript(base());
    expect(withTabs).toContain('///$tab Main');
    expect(withTabs).toContain('///$tab Sources');
    const p = base();
    p.settings.useTabs = false;
    const without = generateScript(p);
    expect(without).not.toContain('///$tab');
    expect(without).toContain('// ========== Sources ==========');
  });

  it('omits empty sections', () => {
    const script = generateScript(base());
    expect(script).not.toContain('Transform');
    expect(script).not.toContain('Calendar');
    expect(script).not.toContain('Store');
    expect(script).not.toContain('Cleanup');
  });

  it('contains no timestamps', () => {
    expect(generateScript(base())).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
