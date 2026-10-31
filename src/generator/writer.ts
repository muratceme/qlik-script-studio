/**
 * Collects script lines into named sections and renders them either as
 * `///$tab` sheets or as commented section blocks.
 */
export class ScriptWriter {
  private sections: { title: string; lines: string[] }[] = [];
  private current: { title: string; lines: string[] } | null = null;

  section(title: string): void {
    this.current = { title, lines: [] };
    this.sections.push(this.current);
  }

  line(text = ''): void {
    if (!this.current) this.section('Main');
    this.current!.lines.push(text);
  }

  lines(texts: string[]): void {
    for (const t of texts) this.line(t);
  }

  blank(): void {
    const lines = this.current?.lines;
    if (lines && lines.length > 0 && lines[lines.length - 1] !== '') this.line('');
  }

  comment(text: string): void {
    this.line(`// ${text}`);
  }

  /** True when the current section has no content yet. */
  isEmptySection(): boolean {
    return !this.current || this.current.lines.length === 0;
  }

  render(useTabs: boolean): string {
    const out: string[] = [];
    for (const section of this.sections) {
      if (section.lines.length === 0) continue;
      if (out.length > 0) out.push('');
      out.push(
        useTabs ? `///$tab ${section.title}` : `// ${'='.repeat(10)} ${section.title} ${'='.repeat(10)}`,
      );
      // Trim trailing blank lines inside a section.
      let end = section.lines.length;
      while (end > 0 && section.lines[end - 1] === '') end--;
      out.push(...section.lines.slice(0, end));
    }
    return out.join('\n') + '\n';
  }
}

/** Formats a LOAD column list with aligned `AS` aliases. */
export function formatColumns(columns: { expr: string; alias: string | null }[]): string[] {
  const width = Math.max(0, ...columns.filter((c) => c.alias !== null).map((c) => c.expr.length));
  return columns.map((c, i) => {
    const comma = i < columns.length - 1 ? ',' : '';
    if (c.alias === null) return `    ${c.expr}${comma}`;
    const pad = ' '.repeat(Math.max(1, width - c.expr.length + 1));
    return `    ${c.expr}${pad}AS ${c.alias}${comma}`;
  });
}
