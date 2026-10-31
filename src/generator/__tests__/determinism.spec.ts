import { describe, expect, it } from 'vitest';
import { generateScript } from '@/generator';
import { sampleProject } from '@/model/sample';

function shuffleKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(shuffleKeys) as T;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).reverse();
    return Object.fromEntries(entries.map(([k, v]) => [k, shuffleKeys(v)])) as T;
  }
  return value;
}

describe('determinism', () => {
  it('produces identical output for identical models', () => {
    const a = generateScript(sampleProject());
    const b = generateScript(sampleProject());
    expect(a).toBe(b);
  });

  it('does not depend on object key order', () => {
    expect(generateScript(shuffleKeys(sampleProject()))).toBe(generateScript(sampleProject()));
  });

  it('ignores canvas positions', () => {
    const p = sampleProject();
    p.canvas.positions = {};
    expect(generateScript(p)).toBe(generateScript(sampleProject()));
  });

  it('does not mutate its input', () => {
    const p = sampleProject();
    const before = JSON.stringify(p);
    generateScript(p);
    expect(JSON.stringify(p)).toBe(before);
  });
});
