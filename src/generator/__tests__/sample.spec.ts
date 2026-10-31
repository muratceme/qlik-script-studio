import { describe, expect, it } from 'vitest';
import { sampleProject } from '@/model/sample';
import { buildScript, generateScript } from '@/generator';
import { parseProject } from '@/model/schema';

describe('sample project', () => {
  it('validates and matches the snapshot', () => {
    const result = buildScript(sampleProject());
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((w) => w.code)).toEqual([]);
    expect(result.script).toMatchSnapshot();
  });

  it('round-trips through the JSON schema', () => {
    const parsed = parseProject(JSON.parse(JSON.stringify(sampleProject())));
    expect(parsed.ok).toBe(true);
  });

  it('is deterministic', () => {
    const a = generateScript(sampleProject());
    const b = generateScript(structuredClone(sampleProject()));
    expect(a).toBe(b);
  });
});
