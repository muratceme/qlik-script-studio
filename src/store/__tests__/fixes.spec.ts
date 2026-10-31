import { describe, expect, it } from 'vitest';
import { applyFix } from '@/store/fixes';
import { sampleProject } from '@/model/sample';
import { analyzeModel, buildScript } from '@/generator';

describe('applyFix', () => {
  it('renames a source field through its alias', () => {
    const p = sampleProject();
    applyFix(p, {
      kind: 'renameField',
      tableId: 'src-customers',
      fieldId: 'f-cust-city',
      newName: 'City_Customers',
    });
    expect(p.sources[1]!.fields[2]!.alias).toBe('City_Customers');
  });

  it('qualifies, keeps and creates links', () => {
    const p = sampleProject();
    applyFix(p, { kind: 'qualifyTable', tableId: 'src-products' });
    applyFix(p, { kind: 'keepTable', tableId: 'src-sales' });
    applyFix(p, {
      kind: 'createLink',
      type: 'noConcatenate',
      leftTableId: 'src-sales',
      rightTableId: 'src-products',
      pairs: [],
    });
    expect(p.sources[2]!.qualify).toBe(true);
    expect(p.sources[0]!.keepInModel).toBe(true);
    expect(p.links.at(-1)).toMatchObject({ type: 'noConcatenate', leftTableId: 'src-sales' });
    expect(buildScript(p).errors).toEqual([]);
  });

  it('resolves a synthetic key warning with its own first fix', () => {
    const p = sampleProject();
    // Give Customers and Products two field names in common.
    p.sources[1]!.fields.push({
      id: 'f-cust-cat',
      name: 'Category',
      alias: null,
      role: 'dimension',
      dataType: 'text',
      dateFormat: null,
      isUnique: false,
      suggestedRole: null,
    });
    p.sources[2]!.fields.push({
      id: 'f-prod-city',
      name: 'City',
      alias: null,
      role: 'dimension',
      dataType: 'text',
      dateFormat: null,
      isUnique: false,
      suggestedRole: null,
    });
    const warning = analyzeModel(p).find((w) => w.code === 'SYNTHETIC_KEY');
    expect(warning).toBeDefined();
    applyFix(p, warning!.fixes[0]!);
    expect(analyzeModel(p).map((w) => w.code)).not.toContain('SYNTHETIC_KEY');
  });
});
