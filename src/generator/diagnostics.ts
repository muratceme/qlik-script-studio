import type { CompositeKeyMode, FieldPair, FieldRole, LinkType } from '@/model/types';

/** Errors block script generation. */
export type ErrorCode =
  | 'EMPTY_PROJECT'
  | 'DUPLICATE_TABLE_NAME'
  | 'DUPLICATE_FIELD_NAME'
  | 'INVALID_NAME'
  | 'EMPTY_NAME'
  | 'SOURCE_PATH_MISSING'
  | 'SOURCE_CONNECTION_MISSING'
  | 'EXCEL_SHEET_MISSING'
  | 'SQL_QUERY_MISSING'
  | 'INLINE_EMPTY'
  | 'TARGET_NO_COLUMNS'
  | 'TARGET_PRIMARY_MISSING'
  | 'FIELD_NOT_FOUND'
  | 'FIELD_NOT_REACHABLE'
  | 'LINK_NO_PAIRS'
  | 'LINK_SELF'
  | 'LINK_TABLE_MISSING'
  | 'APPLYMAP_FIELDS_MISSING'
  | 'CALENDAR_DATE_MISSING'
  | 'CYCLIC_DEPENDENCY'
  | 'FIELD_IGNORED'
  | 'RAW_EXPRESSION_EMPTY';

/** Warnings are shown next to a script that is still generated. */
export type WarningCode =
  | 'SYNTHETIC_KEY'
  | 'CIRCULAR_REFERENCE'
  | 'KEY_TYPE_MISMATCH'
  | 'JOIN_FANOUT_RISK'
  | 'JOIN_UNINTENDED_COMMON_FIELD'
  | 'IMPLICIT_CONCATENATE'
  | 'DROPPED_TABLE_REFERENCED';

export type DiagnosticCode = ErrorCode | WarningCode;

export type Fix =
  | { kind: 'renameField'; tableId: string; fieldId: string; newName: string }
  | { kind: 'qualifyTable'; tableId: string }
  | { kind: 'compositeKey'; linkId: string; mode: CompositeKeyMode }
  | { kind: 'createLink'; type: LinkType; leftTableId: string; rightTableId: string; pairs: FieldPair[] }
  | { kind: 'setIgnore'; tableId: string; fieldId: string }
  | { kind: 'setRole'; tableId: string; fieldId: string; role: FieldRole }
  | { kind: 'keepTable'; tableId: string };

export interface Diagnostic {
  severity: 'error' | 'warning';
  code: DiagnosticCode;
  /** Values interpolated into the translated message. */
  params: Record<string, string>;
  refs: { tableIds?: string[]; fieldIds?: string[]; linkIds?: string[]; targetIds?: string[] };
  fixes: Fix[];
}

export function error(
  code: ErrorCode,
  params: Record<string, string> = {},
  refs: Diagnostic['refs'] = {},
  fixes: Fix[] = [],
): Diagnostic {
  return { severity: 'error', code, params, refs, fixes };
}

export function warning(
  code: WarningCode,
  params: Record<string, string> = {},
  refs: Diagnostic['refs'] = {},
  fixes: Fix[] = [],
): Diagnostic {
  return { severity: 'warning', code, params, refs, fixes };
}
