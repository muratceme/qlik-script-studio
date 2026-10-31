/**
 * Reads only the header row and the first few rows of a CSV or Excel file in
 * the browser. Nothing is uploaded anywhere.
 */
import Papa from 'papaparse';
import type { CsvDelimiter } from '@/model/types';

export interface DetectedTable {
  fields: string[];
  rows: string[][];
  delimiter: CsvDelimiter | null;
  sheets: string[];
  sheet: string | null;
}

export const PREVIEW_ROWS = 20;

export function detectDelimiter(line: string): CsvDelimiter {
  const candidates: CsvDelimiter[] = ['\t', ';', '|', ','];
  let best: CsvDelimiter = ',';
  let bestCount = -1;
  for (const d of candidates) {
    const count = line.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/** Splits a pasted header line into field names. */
export function splitHeaderLine(line: string): { fields: string[]; delimiter: CsvDelimiter } {
  const firstLine = line.split(/\r?\n/)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const parsed = Papa.parse<string[]>(firstLine, { delimiter });
  const fields = (parsed.data[0] ?? []).map((f) => f.trim()).filter((f) => f.length > 0);
  return { fields, delimiter };
}

function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw, i) => {
    const base = raw.trim() || `Field${i + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

export async function detectFromCsv(file: File): Promise<DetectedTable> {
  const text = await file.slice(0, 256 * 1024).text();
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const parsed = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: true, preview: PREVIEW_ROWS + 1 });
  const [header = [], ...rows] = parsed.data;
  return {
    fields: uniqueNames(header),
    rows: rows.map((r) => r.map((v) => (v ?? '').toString())),
    delimiter,
    sheets: [],
    sheet: null,
  };
}

export async function detectFromExcel(file: File, sheetName?: string): Promise<DetectedTable> {
  // Loaded on demand so the Excel parser is not part of the initial bundle.
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', sheetRows: PREVIEW_ROWS + 1, cellDates: false });
  const sheets = workbook.SheetNames;
  const sheet = sheetName && sheets.includes(sheetName) ? sheetName : (sheets[0] ?? null);
  if (!sheet) return { fields: [], rows: [], delimiter: null, sheets, sheet: null };
  const ws = workbook.Sheets[sheet]!;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' });
  const [header = [], ...rows] = matrix;
  return {
    fields: uniqueNames(header.map((h) => String(h ?? ''))),
    rows: rows.map((r) => r.map((v) => String(v ?? ''))),
    delimiter: null,
    sheets,
    sheet,
  };
}

export function isExcelFile(file: File): boolean {
  return /\.(xlsx|xlsm|xls)$/i.test(file.name);
}

export async function detectFromFile(file: File, sheetName?: string): Promise<DetectedTable> {
  return isExcelFile(file) ? detectFromExcel(file, sheetName) : detectFromCsv(file);
}

/** Returns the values of one column across the preview rows. */
export function columnValues(rows: string[][], index: number): string[] {
  return rows.map((r) => r[index] ?? '');
}
