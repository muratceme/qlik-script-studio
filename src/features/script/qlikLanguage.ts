/**
 * A small CodeMirror StreamLanguage for Qlik load script: keywords, functions,
 * strings, comments, [bracketed names], $(variables) and ///$tab markers.
 */
import { StreamLanguage, HighlightStyle, syntaxHighlighting, type StringStream } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const KEYWORDS = new Set([
  'load',
  'from',
  'resident',
  'where',
  'group',
  'by',
  'as',
  'and',
  'or',
  'not',
  'inline',
  'join',
  'keep',
  'left',
  'right',
  'inner',
  'outer',
  'concatenate',
  'noconcatenate',
  'mapping',
  'drop',
  'table',
  'tables',
  'store',
  'into',
  'set',
  'let',
  'distinct',
  'order',
  'while',
  'autogenerate',
  'if',
  'then',
  'else',
  'elseif',
  'end',
  'endif',
  'sql',
  'select',
  'qualify',
  'unqualify',
  'rename',
  'field',
  'fields',
  'to',
  'lib',
  'connect',
  'disconnect',
  'first',
  'sample',
  'crosstable',
  'generic',
  'hierarchy',
  'intervalmatch',
  'semantic',
  'buffer',
  'bundle',
  'info',
  'null',
  'like',
  'exists',
  'for',
  'next',
  'do',
  'loop',
  'sub',
  'endsub',
  'call',
  'exit',
  'script',
  'trace',
  'binary',
  'directory',
  'section',
  'access',
  'application',
  'star',
  'is',
  'add',
  'replace',
  'only',
  'force',
  'case',
  'mixed',
  'upper',
  'lower',
  'capitalization',
  'unmap',
  'map',
  'using',
  'tag',
  'untag',
  'search',
  'include',
  'must_include',
  'when',
  'unless',
  'switch',
  'default',
  'with',
  'in',
  'alias',
  'comment',
  'declare',
  'derive',
  'nullasvalue',
  'nullasnull',
  'merge',
  'partial',
  'reload',
  'execute',
  'sleep',
  'step',
]);

const FORMAT_WORDS = new Set([
  'qvd',
  'txt',
  'ooxml',
  'biff',
  'utf8',
  'unicode',
  'ansi',
  'embedded',
  'labels',
  'explicit',
  'no',
  'delimiter',
  'msq',
  'codepage',
  'header',
  'lines',
  'is',
  'table',
  'filters',
  'qvx',
  'json',
  'xml',
  'parquet',
  'url',
]);

interface State {
  inBlockComment: boolean;
}

export const qlikLanguage = StreamLanguage.define<State>({
  name: 'qlik',
  startState: () => ({ inBlockComment: false }),
  token(stream: StringStream, state: State): string | null {
    if (state.inBlockComment) {
      if (stream.match(/^.*?\*\//)) state.inBlockComment = false;
      else stream.skipToEnd();
      return 'comment';
    }
    if (stream.sol() && stream.match(/^\/\/\/\$tab\b.*/)) return 'meta';
    if (stream.match(/^\/\/.*/) || stream.match(/^REM\b.*/i)) return 'comment';
    if (stream.match(/^\/\*/)) {
      state.inBlockComment = true;
      return 'comment';
    }
    if (stream.match(/^'(?:[^']|'')*'/)) return 'string';
    if (stream.match(/^"(?:[^"]|"")*"/)) return 'string';
    if (stream.match(/^\[[^\]\n]*\]/)) return 'variableName';
    if (stream.match(/^\$\([^)]*\)/)) return 'variableName.special';
    if (stream.match(/^\d+(\.\d+)?/)) return 'number';
    if (stream.match(/^[A-Za-z_@][A-Za-z0-9_@#.]*/)) {
      const word = stream.current().toLowerCase();
      if (KEYWORDS.has(word)) return 'keyword';
      if (FORMAT_WORDS.has(word)) return 'typeName';
      if (stream.peek() === '(') return 'function';
      return null;
    }
    if (stream.match(/^[(),;:*&=<>+\-/]/)) return 'operator';
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: '//', block: { open: '/*', close: '*/' } } },
});

export const qlikHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--accent)', fontWeight: '600' },
  { tag: t.comment, color: 'var(--fg-subtle)', fontStyle: 'italic' },
  { tag: t.string, color: 'var(--role-measure)' },
  { tag: t.number, color: 'var(--role-key)' },
  { tag: t.variableName, color: 'var(--role-dimension)' },
  { tag: t.special(t.variableName), color: 'var(--role-key)', fontWeight: '600' },
  { tag: t.typeName, color: 'var(--role-date)' },
  { tag: t.function(t.variableName), color: 'var(--fg)' },
  { tag: t.meta, color: 'var(--warning)', fontWeight: '700' },
  { tag: t.operator, color: 'var(--fg-muted)' },
]);

export const qlikExtensions = () => [qlikLanguage, syntaxHighlighting(qlikHighlightStyle)];
