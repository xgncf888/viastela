export const RECORD_TABLES = ['weight_records', 'training_sets'] as const;

export type RecordTable = (typeof RECORD_TABLES)[number];

/** Tables whose migrations declare a `deleted_at` column. Comments are ignored. */
export function tablesDeclaringDeletedAt(sql: string): string[] {
  const cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
  const tables = new Set<string>();
  const alter =
    /alter\s+table\s+(?:only\s+)?(?:public\.)?([a-zA-Z_][\w]*)\s+add\s+column(?:\s+if\s+not\s+exists)?\s+deleted_at\b/gi;
  for (const match of cleaned.matchAll(alter)) tables.add(match[1]);
  const create = /create\s+table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?([a-zA-Z_][\w]*)\s*\(/gi;
  for (const match of cleaned.matchAll(create)) {
    const body = readBalanced(cleaned, (match.index ?? 0) + match[0].length);
    if (body.split('\n').some((line) => /^\s*deleted_at\b/.test(line))) tables.add(match[1]);
  }
  return [...tables].sort();
}

function readBalanced(source: string, contentStart: number): string {
  let depth = 1;
  for (let index = contentStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(contentStart, index);
    }
  }
  return source.slice(contentStart);
}

/** Record-table selects must be wrapped in liveRows so deleted rows stay out of the app. */
export function recordReadsMissingLiveRows(source: string): string[] {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const missing: string[] = [];
  for (const statement of stripped.split(';')) {
    for (const table of RECORD_TABLES) {
      if (!statement.includes(`.from('${table}')`) && !statement.includes(`.from("${table}")`)) continue;
      if (!statement.includes('.select(')) continue;
      if (statement.includes('.update(')) continue;
      if (!statement.includes('liveRows(')) missing.push(table);
    }
  }
  return missing;
}
