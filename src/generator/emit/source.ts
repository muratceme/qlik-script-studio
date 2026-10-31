import type { SourceTable } from '@/model/types';
import type { Context } from '../context';
import { defaultScope } from '../expr';
import { extraColumns, needsNoConcatenate, suppressedFieldIds, unqualifiedKeyNames } from '../plan';
import { joinPath, qName, qPath, qStr, qTable } from '../quote';
import { formatColumns, type ScriptWriter } from '../writer';
import { ANSI_CODEPAGE } from './settings';

const KIND_LABEL: Record<SourceTable['kind'], string> = {
  qvd: 'QVD',
  excel: 'Excel',
  csv: 'CSV',
  sql: 'SQL',
  inline: 'Inline',
};

function resolvePath(ctx: Context, table: SourceTable): string {
  const connection = table.connectionId ? ctx.connections.get(table.connectionId) : undefined;
  if (!connection) return table.path;
  if (ctx.project.settings.dialect === 'view' && connection.name.includes('\\')) {
    const base = connection.name.endsWith('\\') ? connection.name : `${connection.name}\\`;
    return `${base}${table.path}`;
  }
  return joinPath(connection.name, table.path);
}

/** Expression for a field as it is read from the source, with optional date parsing. */
function fieldExpr(table: SourceTable, field: SourceTable['fields'][number], position: number): string {
  const raw = table.kind === 'csv' && table.csv && !table.csv.hasHeader ? `@${position + 1}` : qName(field.name);
  if (field.dateFormat && table.kind !== 'qvd') {
    return `Date(Date#(${raw}, ${qStr(field.dateFormat)}))`;
  }
  return raw;
}

function fileFormat(ctx: Context, table: SourceTable): string {
  switch (table.kind) {
    case 'qvd':
      return '(qvd)';
    case 'excel': {
      const opts = table.excel ?? { sheet: 'Sheet1', headerRow: 1 };
      const legacy = /\.xls$/i.test(table.path);
      const parts = [legacy ? 'biff' : 'ooxml', 'embedded labels'];
      if (opts.headerRow > 1) parts.push(`header is ${opts.headerRow - 1} lines`);
      parts.push(`table is ${qName(legacy ? `${opts.sheet}$` : opts.sheet)}`);
      return `(${parts.join(', ')})`;
    }
    case 'csv': {
      const opts = table.csv ?? { delimiter: ',', encoding: 'utf8', hasHeader: true, msq: true };
      const parts = ['txt'];
      if (opts.encoding === 'utf8') parts.push('utf8');
      else if (opts.encoding === 'unicode') parts.push('unicode');
      else parts.push(`codepage is ${ANSI_CODEPAGE[ctx.project.settings.locale]}`);
      parts.push(opts.hasHeader ? 'embedded labels' : 'no labels');
      parts.push(`delimiter is ${opts.delimiter === '\t' ? "'\\t'" : qStr(opts.delimiter)}`);
      if (opts.msq) parts.push('msq');
      return `(${parts.join(', ')})`;
    }
    default:
      return '';
  }
}

function inlineValue(value: string): string {
  if (/[,"\n]/.test(value) || value !== value.trim()) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Emits the LOAD for one source table. The statement includes extra columns
 * added by links (composite keys, ApplyMap results) and skips ignored fields.
 */
export function emitSource(ctx: Context, w: ScriptWriter, table: SourceTable): void {
  const scope = defaultScope(ctx);
  const suppressed = suppressedFieldIds(ctx, table.id);
  const columns: { expr: string; alias: string | null }[] = [];
  const loaded = table.fields.filter((f) => f.role !== 'ignore' && !suppressed.has(f.id));

  table.fields.forEach((field, position) => {
    if (field.role === 'ignore' || suppressed.has(field.id)) return;
    const expr = fieldExpr(table, field, position);
    const out = qName(ctx.outName({ tableId: table.id, fieldId: field.id }));
    columns.push({ expr, alias: expr === out ? null : out });
  });
  for (const extra of extraColumns(ctx, table.id, scope)) {
    columns.push({ expr: extra.expr, alias: extra.alias });
  }

  const explicitList = loaded.length > 0;
  // SQL always gets a preceding LOAD with the field list; INLINE only needs one
  // when a column is renamed, parsed or added.
  const needsPrecedingLoad =
    columns.length > 0 &&
    (table.kind === 'sql' || (table.kind === 'inline' && columns.some((c) => c.alias !== null)));

  w.comment(`${table.name} (${KIND_LABEL[table.kind]})`);
  if (table.qualify) {
    w.line('QUALIFY *;');
    const keys = unqualifiedKeyNames(ctx, table.id);
    if (keys.length > 0) w.line(`UNQUALIFY ${keys.map(qName).join(', ')};`);
  }
  if (table.kind === 'sql') {
    const connection = table.connectionId ? ctx.connections.get(table.connectionId) : undefined;
    if (connection) {
      w.line(`${ctx.project.settings.dialect === 'view' ? 'CONNECT TO' : 'LIB CONNECT TO'} ${qStr(connection.name)};`);
    }
  }
  w.line(`${qTable(table.name)}:`);
  if (needsNoConcatenate(ctx, table.id)) w.line('NoConcatenate');

  const emitColumnList = (): void => {
    if (!explicitList) {
      // No field list: load everything, plus any extra columns.
      if (columns.length === 0) {
        w.line('LOAD *');
      } else {
        w.line('LOAD');
        w.lines(formatColumns([{ expr: '*', alias: null }, ...columns]));
      }
      return;
    }
    w.line('LOAD');
    w.lines(formatColumns(columns));
  };

  switch (table.kind) {
    case 'qvd':
    case 'excel':
    case 'csv':
      emitColumnList();
      w.line(`FROM ${qPath(resolvePath(ctx, table))} ${fileFormat(ctx, table)};`);
      break;
    case 'sql': {
      if (needsPrecedingLoad) {
        emitColumnList();
        w.line(';');
      } else {
        w.line('LOAD *;');
      }
      const query = (table.sql?.query ?? '').trim().replace(/;$/, '');
      w.line(`SQL ${query};`);
      break;
    }
    case 'inline': {
      if (needsPrecedingLoad) {
        emitColumnList();
        w.line(';');
      }
      const rows = table.inline?.rows ?? [];
      w.line('LOAD * INLINE [');
      for (const row of rows) w.line(row.map(inlineValue).join(', '));
      w.line('];');
      break;
    }
  }
  if (table.qualify) w.line('UNQUALIFY *;');
  w.blank();
}

/** MAPPING LOAD tables fed by a source, emitted right after that source. */
export function emitMappingsFor(ctx: Context, w: ScriptWriter, sourceId: string): void {
  for (const link of ctx.project.links) {
    if (link.type !== 'applyMap' || !link.applyMap || link.rightTableId !== sourceId) continue;
    const key = ctx.outName({ tableId: sourceId, fieldId: link.applyMap.keyFieldId });
    const value = ctx.outName({ tableId: sourceId, fieldId: link.applyMap.valueFieldId });
    w.comment(`Mapping ${link.applyMap.mapName}: ${key} -> ${value}`);
    w.line(`${qTable(link.applyMap.mapName)}:`);
    w.line('MAPPING LOAD');
    w.lines(formatColumns([{ expr: qName(key), alias: null }, { expr: qName(value), alias: null }]));
    w.line(`RESIDENT ${qTable(ctx.tableName(sourceId))};`);
    w.blank();
  }
}
