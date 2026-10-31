import { describe, expect, it } from 'vitest';
import en from './en.json';
import tr from './tr.json';
import type { DiagnosticCode } from '@/generator';

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('translations', () => {
  it('have the same keys in every language', () => {
    expect(flatten(tr).sort()).toEqual(flatten(en).sort());
  });

  it('cover every diagnostic code', () => {
    const codes: DiagnosticCode[] = [
      'EMPTY_PROJECT', 'DUPLICATE_TABLE_NAME', 'DUPLICATE_FIELD_NAME', 'INVALID_NAME', 'EMPTY_NAME',
      'SOURCE_PATH_MISSING', 'SOURCE_CONNECTION_MISSING', 'EXCEL_SHEET_MISSING', 'SQL_QUERY_MISSING',
      'INLINE_EMPTY', 'TARGET_NO_COLUMNS', 'TARGET_PRIMARY_MISSING', 'FIELD_NOT_FOUND', 'FIELD_NOT_REACHABLE',
      'FIELD_IGNORED', 'LINK_NO_PAIRS', 'LINK_SELF', 'LINK_TABLE_MISSING', 'APPLYMAP_FIELDS_MISSING',
      'CALENDAR_DATE_MISSING', 'CYCLIC_DEPENDENCY', 'RAW_EXPRESSION_EMPTY', 'SYNTHETIC_KEY', 'CIRCULAR_REFERENCE',
      'KEY_TYPE_MISMATCH', 'JOIN_FANOUT_RISK', 'JOIN_UNINTENDED_COMMON_FIELD', 'IMPLICIT_CONCATENATE',
      'DROPPED_TABLE_REFERENCED',
    ];
    for (const code of codes) {
      expect(en.diagnostics, code).toHaveProperty(code);
    }
  });
});
