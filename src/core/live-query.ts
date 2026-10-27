const RECORD_TABLES = ['weight_records', 'training_sets'] as const;

/** Record-table selects must be wrapped in liveRows so deleted rows stay out of the app. */
export function recordReadsMissingLiveRows(source: string): string[] {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const missing: string[] = [];
  for (const statement of stripped.split(';')) {
    for (const table of RECORD_TABLES) {
      if (!statement.includes(`.from('${table}')`) && !statement.includes(`.from("${table}")`)) continue;
      if (!statement.includes('.select(')) continue;
      if (!statement.includes('liveRows(')) missing.push(table);
    }
  }
  return missing;
}
