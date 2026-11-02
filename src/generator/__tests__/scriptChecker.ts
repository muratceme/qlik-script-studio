/**
 * A tiny "Qlik table lifecycle" checker for generated scripts. It does not
 * parse Qlik fully; it tracks which tables and mapping tables exist while
 * reading the script top to bottom and reports references to tables that do
 * not exist at that point, plus a few structural rules.
 */
export interface ScriptProblem {
  line: number;
  message: string;
}

const unbracket = (s: string) => (s.startsWith('[') && s.endsWith(']') ? s.slice(1, -1) : s);

export function checkScript(script: string): ScriptProblem[] {
  const problems: ScriptProblem[] = [];
  const tables = new Set<string>();
  const mappings = new Set<string>();
  const lines = script.split('\n');
  let pendingLabel: string | null = null;
  let pendingMapping = false;
  let pendingPrefixTable: string | null = null; // JOIN/KEEP/CONCATENATE target
  let inInline = false;
  let inLoad = false;
  // A LOAD directly after a ';'-terminated LOAD is a preceding-load chain (same statement).
  let chainOpen = false;

  const name = (raw: string) => unbracket(raw.trim().replace(/;$/, ''));

  lines.forEach((raw, i) => {
    const line = raw.trim();
    const n = i + 1;
    if (inInline) {
      if (line === '];') inInline = false;
      return;
    }
    if (!line || line.startsWith('//')) {
      if (!line) chainOpen = false;
      return;
    }

    let m: RegExpMatchArray | null;
    const continues = chainOpen && /^LOAD\b/.test(line);
    chainOpen = false;
    if ((m = line.match(/^(\[[^\]]+\]|[A-Za-z_][\w]*):$/))) {
      pendingLabel = name(m[1]!);
      return;
    }
    if (/^MAPPING LOAD\b/.test(line)) {
      pendingMapping = true;
      inLoad = true;
      return;
    }
    if ((m = line.match(/^(LEFT|RIGHT|INNER|OUTER)?\s*(JOIN|KEEP|CONCATENATE)\s*\((\[[^\]]+\]|[\w]+)\)/))) {
      const target = name(m[3]!);
      if (!tables.has(target)) problems.push({ line: n, message: `${m[2]} into missing table ${target}` });
      pendingPrefixTable = target;
      return;
    }
    if (/^LOAD \* INLINE \[/.test(line)) {
      inInline = true;
      if (pendingLabel) tables.add(pendingLabel);
      pendingLabel = null;
      return;
    }
    if (/^LOAD\b/.test(line)) {
      inLoad = true;
      if (continues) pendingLabel = pendingLabel ?? '__chain__';
      return;
    }
    if ((m = line.match(/^RESIDENT (\[[^\]]+\]|[\w]+)/))) {
      const src = name(m[1]!);
      if (!tables.has(src)) problems.push({ line: n, message: `RESIDENT from missing table ${src}` });
    }
    if ((m = line.match(/^FROM (\[[^\]]+\])/))) {
      // file load
    }
    if ((m = line.match(/^DROP TABLE (\[[^\]]+\]|[\w]+);$/))) {
      const t = name(m[1]!);
      if (!tables.has(t)) problems.push({ line: n, message: `DROP of missing table ${t}` });
      tables.delete(t);
      return;
    }
    if ((m = line.match(/^RENAME TABLE (\[[^\]]+\]|[\w]+) TO (\[[^\]]+\]|[\w]+);$/))) {
      const from = name(m[1]!);
      const to = name(m[2]!);
      if (!tables.has(from)) problems.push({ line: n, message: `RENAME of missing table ${from}` });
      if (tables.has(to)) problems.push({ line: n, message: `RENAME to existing table ${to}` });
      tables.delete(from);
      tables.add(to);
      return;
    }
    if ((m = line.match(/^STORE (\[[^\]]+\]|[\w]+) INTO/))) {
      const t = name(m[1]!);
      if (!tables.has(t)) problems.push({ line: n, message: `STORE of missing table ${t}` });
    }
    for (const am of line.matchAll(/ApplyMap\('([^']+)'/g)) {
      if (!mappings.has(am[1]!))
        problems.push({ line: n, message: `ApplyMap uses undefined mapping ${am[1]}` });
    }
    // A statement ends with ';' (also on the RESIDENT/FROM/SQL line).
    if (line.endsWith(';') && inLoad) {
      inLoad = false;
      if (pendingMapping) {
        if (pendingLabel) mappings.add(pendingLabel);
        else problems.push({ line: n, message: 'MAPPING LOAD without a label' });
        pendingMapping = false;
      } else if (pendingPrefixTable) {
        // merged into an existing table; a label here is allowed but creates nothing new
        pendingPrefixTable = null;
        if (pendingLabel) tables.add(pendingLabel);
      } else if (pendingLabel && pendingLabel !== '__chain__') {
        if (tables.has(pendingLabel))
          problems.push({ line: n, message: `table ${pendingLabel} created twice` });
        tables.add(pendingLabel);
      } else if (!/^SQL /.test(line) && pendingLabel !== '__chain__') {
        problems.push({ line: n, message: 'LOAD without a table label' });
      }
      pendingLabel = null;
      chainOpen = true;
    }
  });
  return problems;
}
