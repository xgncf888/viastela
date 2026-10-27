import { describe, expect, it } from '@jest/globals';

import { recordReadsMissingLiveRows } from './live-query';

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
});
