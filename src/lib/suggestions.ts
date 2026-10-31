/**
 * Role suggestions. Pure functions; nothing is applied without the user's consent.
 */
import type { DataType, Field, FieldRole } from '@/model/types';

const KEY_PATTERNS = [/(^|[_\s])id$/i, /id$/i, /key$/i, /(^|[_\s])(code|kod|no)$/i, /^id[_\s]/i];
const DATE_PATTERNS = [/date/i, /tarih/i, /^dt[_\s]/i, /[_\s]dt$/i, /time$/i, /zaman/i, /_at$/i];
const MEASURE_PATTERNS = [
  /amount/i,
  /tutar/i,
  /qty/i,
  /quantity/i,
  /adet/i,
  /miktar/i,
  /total/i,
  /toplam/i,
  /price/i,
  /fiyat/i,
  /cost/i,
  /maliyet/i,
  /revenue/i,
  /sales/i,
  /satis/i,
  /satış/i,
  /sum/i,
  /count/i,
  /value/i,
  /deger/i,
  /değer/i,
  /weight/i,
  /discount/i,
  /indirim/i,
  /rate/i,
  /oran/i,
  /balance/i,
  /bakiye/i,
];

function matches(name: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(name));
}

/** Guesses a data type from sample values of a column. */
export function inferDataType(values: string[]): DataType {
  const samples = values.map((v) => v.trim()).filter((v) => v.length > 0);
  if (samples.length === 0) return 'text';
  const isNumber = (v: string) => /^-?\d{1,3}([.,]\d{3})*([.,]\d+)?$|^-?\d+([.,]\d+)?$/.test(v);
  const isDate = (v: string) =>
    /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) ||
    /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(v) ||
    /^\d{4}[./]\d{2}[./]\d{2}$/.test(v);
  if (samples.every(isDate)) return 'date';
  if (samples.every(isNumber)) {
    return samples.some((v) => /[.,]\d{2}$/.test(v)) ? 'money' : 'number';
  }
  return 'text';
}

/** Guesses the Qlik date format from sample values; null when unsure. */
export function inferDateFormat(values: string[]): string | null {
  const sample = values.map((v) => v.trim()).find((v) => v.length > 0);
  if (!sample) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(sample)) return 'YYYY-MM-DD';
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(sample)) return 'DD.MM.YYYY';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(sample)) return 'MM/DD/YYYY';
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(sample)) return 'DD-MM-YYYY';
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(sample)) return 'YYYY/MM/DD';
  return null;
}

/** True when every non-empty sample value is distinct. */
export function inferUnique(values: string[]): boolean {
  const nonEmpty = values.map((v) => v.trim()).filter((v) => v.length > 0);
  if (nonEmpty.length < 2) return false;
  return new Set(nonEmpty).size === nonEmpty.length;
}

/**
 * Suggests a role for a field from its name and data type. Returns null when
 * the current role is already the suggestion or nothing stands out.
 */
export function suggestRole(field: Pick<Field, 'name' | 'role' | 'dataType'>): FieldRole | null {
  let suggestion: FieldRole | null = null;
  if (matches(field.name, KEY_PATTERNS)) suggestion = 'key';
  else if (matches(field.name, DATE_PATTERNS) || field.dataType === 'date') suggestion = 'date';
  else if (
    (field.dataType === 'number' || field.dataType === 'money') &&
    matches(field.name, MEASURE_PATTERNS)
  )
    suggestion = 'measure';
  else if (field.dataType === 'money') suggestion = 'measure';
  if (suggestion === null || suggestion === field.role) return null;
  return suggestion;
}
