/**
 * Quoting rules for names, strings and paths in Qlik script.
 *
 * - A name is emitted bare only when it is a plain identifier
 *   (`^[A-Za-z_][A-Za-z0-9_]*$`) and not a reserved keyword; otherwise it is
 *   wrapped in square brackets. `]` is not allowed inside a name.
 * - String literals use single quotes; a single quote inside is doubled.
 */

const KEYWORDS = new Set(
  [
    'add', 'alias', 'and', 'as', 'autogenerate', 'binary', 'buffer', 'bundle', 'by', 'call', 'case',
    'concatenate', 'connect', 'crosstable', 'declare', 'derive', 'direct', 'directory', 'disconnect',
    'distinct', 'do', 'drop', 'else', 'elseif', 'end', 'endif', 'endsub', 'execute', 'exit', 'field',
    'fields', 'first', 'for', 'force', 'from', 'from_field', 'generic', 'group', 'hierarchy',
    'hierarchybelongsto', 'if', 'image_size', 'include', 'info', 'inline', 'inner', 'inputfield',
    'intervalmatch', 'into', 'join', 'keep', 'left', 'let', 'like', 'load', 'loop', 'map', 'mapping',
    'merge', 'next', 'noconcatenate', 'not', 'null', 'nullasnull', 'nullasvalue', 'only', 'or', 'order',
    'outer', 'qualify', 'rem', 'rename', 'replace', 'resident', 'right', 'sample', 'script', 'search',
    'section', 'select', 'semantic', 'set', 'sleep', 'sql', 'sqlcolumns', 'sqltables', 'sqltypes',
    'star', 'step', 'store', 'sub', 'switch', 'table', 'tables', 'tag', 'then', 'to', 'trace',
    'unless', 'unmap', 'unqualify', 'untag', 'using', 'when', 'where', 'while', 'with', 'xor',
  ],
);

const PLAIN_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isPlainIdentifier(name: string): boolean {
  return PLAIN_IDENTIFIER.test(name) && !KEYWORDS.has(name.toLowerCase());
}

export function isValidName(name: string): boolean {
  return name.trim().length > 0 && !name.includes(']') && !name.includes('\n');
}

/** Field or table name, bracketed only when necessary. */
export function qName(name: string): string {
  return isPlainIdentifier(name) ? name : `[${name}]`;
}

/** Table label, always usable as `[Table]:` and in `RESIDENT [Table]`. */
export function qTable(name: string): string {
  return qName(name);
}

/** String literal with single quotes. */
export function qStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Numeric literal. Uses a dot as decimal separator regardless of locale. */
export function qNum(value: number): string {
  return Number.isFinite(value) ? String(value) : '0';
}

/** File path inside FROM / STORE: always bracketed. */
export function qPath(path: string): string {
  return `[${path}]`;
}

/** Joins a connection (`lib://DataFiles`) and a relative file path. */
export function joinPath(connection: string | null, path: string): string {
  if (!connection) return path;
  const base = connection.endsWith('/') ? connection : `${connection}/`;
  const rel = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${rel}`;
}

/** Pads a column expression so `AS` aliases line up in the generated LOAD. */
export function padTo(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}
