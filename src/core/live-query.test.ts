import { describe, expect, it } from '@jest/globals';

import { RECORD_TABLES, recordReadsMissingLiveRows, tablesDeclaringDeletedAt } from './live-query';

declare const process: { cwd(): string };

type DirectoryReader = {
  readdirSync(dir: string): string[];
  readFileSync(file: string, encoding: 'utf8'): string;
};

type PathJoiner = {
  join(...parts: string[]): string;
};

declare function require(id: 'fs'): DirectoryReader;
declare function require(id: 'path'): PathJoiner;

describe('live row reads', () => {
  it('requires liveRows around a record-table select', () => {
    const source = "getSupabase().from('weight_records').select('id').eq('id', '1');";
    expect(recordReadsMissingLiveRows(source)).toEqual(['weight_records']);
    expect(recordReadsMissingLiveRows("liveRows(getSupabase().from('training_sets').select('id'));")).toEqual([]);
    expect(recordReadsMissingLiveRows("getSupabase().from('weight_records').update({ deleted_at: null });")).toEqual(
      [],
    );
    expect(
      recordReadsMissingLiveRows(
        "getSupabase().from('training_sets').update({ deleted_at: null }).eq('id', '1').select('id');",
      ),
    ).toEqual([]);
  });

  it('finds liveRows on every record-table read in src/data', () => {
    const fs = require('fs');
    const path = require('path');
    const directory = path.join(process.cwd(), 'src/data');
    const files = fs.readdirSync(directory).filter((file) => file.endsWith('.ts'));
    const misses = files.flatMap((file) => {
      const source = fs.readFileSync(path.join(directory, file), 'utf8');
      return recordReadsMissingLiveRows(source).map((table) => `${file}:${table}`);
    });
    expect(misses).toEqual([]);
    const helper = fs.readFileSync(path.join(directory, 'live-rows.ts'), 'utf8');
    expect(helper).toContain(".is('deleted_at', null)");
    for (const file of files) {
      if (file === 'live-rows.ts') continue;
      const source = fs.readFileSync(path.join(directory, file), 'utf8');
      expect(source.includes(".is('deleted_at'") || source.includes('.is("deleted_at"')).toBe(false);
    }
  });

  it('matches RECORD_TABLES to deleted_at columns in migrations', () => {
    expect(
      tablesDeclaringDeletedAt(`
        create table public.notes (
          id uuid primary key,
          deleted_at timestamptz
        );
        alter table public.logs
          add column if not exists deleted_at timestamptz;
        -- comment on column public.other.deleted_at is 'not a column';
      `),
    ).toEqual(['logs', 'notes']);
    const fs = require('fs');
    const path = require('path');
    const directory = path.join(process.cwd(), 'supabase/migrations');
    const sql = fs
      .readdirSync(directory)
      .filter((file) => file.endsWith('.sql'))
      .sort()
      .map((file) => fs.readFileSync(path.join(directory, file), 'utf8'))
      .join('\n');
    expect(tablesDeclaringDeletedAt(sql)).toEqual([...RECORD_TABLES].sort());
  });

  it('soft-delete updates ask for the id and reject an empty match', () => {
    const fs = require('fs');
    const path = require('path');
    for (const file of ['weights.ts', 'training.ts', 'study.ts']) {
      const source = fs.readFileSync(path.join(process.cwd(), 'src/data', file), 'utf8');
      expect(source).toContain(".select('id')");
      expect(source).toContain('requireDeletedIds');
    }
  });

  it('caps the recent exercise read at 200 rows, newest first', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(process.cwd(), 'src/data', 'training.ts'), 'utf8');
    expect(source).toContain(".order('recorded_at', { ascending: false })");
    expect(source).toContain('.limit(200)');
  });
});
