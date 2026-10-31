/**
 * Keeps skills/qlik-load-script-builder/SKILL.md in sync with the generator:
 * the example in the skill must be exactly what the generator produces, and
 * every diagnostic code and emitted keyword must be documented.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildScript, type DiagnosticCode } from '@/generator';
import { parseProject } from '@/model/schema';
import { REGIONAL_PRESETS } from '@/generator/emit/settings';
import { CALENDAR_FIELD_NAMES } from '@/generator/emit/calendar';

const skill = readFileSync(resolve(__dirname, '../../../skills/qlik-load-script-builder/SKILL.md'), 'utf8');

function fenced(language: string, afterHeading: string): string {
  const start = skill.indexOf(afterHeading);
  expect(start, `heading ${afterHeading}`).toBeGreaterThan(-1);
  const open = skill.indexOf('```' + language + '\n', start);
  const close = skill.indexOf('\n```', open + 4);
  return skill.slice(open + language.length + 4, close);
}

describe('SKILL.md', () => {
  it('has the required frontmatter', () => {
    expect(skill.startsWith('---\nname: qlik-load-script-builder\ndescription: ')).toBe(true);
  });

  it('example output is exactly what the generator produces for the example input', () => {
    const parsed = parseProject(JSON.parse(fenced('json', '### Input (project JSON)')));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = buildScript(parsed.project);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.script!.trimEnd()).toBe(fenced('qlik', '### Output (generated script)').trimEnd());
  });

  it('documents every diagnostic code', () => {
    const codes: DiagnosticCode[] = [
      'EMPTY_PROJECT',
      'DUPLICATE_TABLE_NAME',
      'DUPLICATE_FIELD_NAME',
      'INVALID_NAME',
      'EMPTY_NAME',
      'SOURCE_PATH_MISSING',
      'SOURCE_CONNECTION_MISSING',
      'EXCEL_SHEET_MISSING',
      'SQL_QUERY_MISSING',
      'INLINE_EMPTY',
      'TARGET_NO_COLUMNS',
      'TARGET_PRIMARY_MISSING',
      'FIELD_NOT_FOUND',
      'FIELD_NOT_REACHABLE',
      'FIELD_IGNORED',
      'LINK_NO_PAIRS',
      'LINK_SELF',
      'LINK_TABLE_MISSING',
      'APPLYMAP_FIELDS_MISSING',
      'CALENDAR_DATE_MISSING',
      'CYCLIC_DEPENDENCY',
      'RAW_EXPRESSION_EMPTY',
      'SYNTHETIC_KEY',
      'CIRCULAR_REFERENCE',
      'KEY_TYPE_MISMATCH',
      'JOIN_FANOUT_RISK',
      'JOIN_UNINTENDED_COMMON_FIELD',
      'IMPLICIT_CONCATENATE',
      'DROPPED_TABLE_REFERENCED',
    ];
    for (const code of codes) expect(skill, code).toContain(code);
  });

  it('documents the regional presets and calendar field names', () => {
    for (const locale of ['en', 'tr'] as const) {
      for (const [name, value] of REGIONAL_PRESETS[locale]) {
        if (/Names$/.test(name)) continue;
        expect(skill, `${locale} ${name}`).toContain(`SET ${name}=${value};`);
      }
    }
    for (const name of Object.values(CALENDAR_FIELD_NAMES)) expect(skill).toContain(name);
  });

  it('documents every statement form the generator emits', () => {
    for (const text of [
      'NoConcatenate',
      'LEFT JOIN',
      'RIGHT JOIN',
      'INNER JOIN',
      'OUTER JOIN',
      'LEFT KEEP',
      'CONCATENATE',
      'MAPPING LOAD',
      'ApplyMap(',
      'AutoNumber(',
      'LOAD * INLINE',
      'LIB CONNECT TO',
      'CONNECT TO',
      'SQL SELECT',
      '(qvd)',
      'ooxml',
      'biff',
      'embedded labels',
      'no labels',
      'codepage is',
      'delimiter is',
      'msq',
      'GROUP BY',
      'LOAD DISTINCT',
      'STORE',
      'DROP TABLE',
      'RENAME TABLE',
      'QUALIFY *',
      'UNQUALIFY',
      'AUTOGENERATE',
      'Peek(',
      'Date(Date#(',
      'Match(',
      'WildMatch(',
      'Index(',
      'Len(Trim(',
      '///$tab',
    ]) {
      expect(skill, text).toContain(text);
    }
  });
});
