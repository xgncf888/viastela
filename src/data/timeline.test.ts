import { describe, expect, it } from '@jest/globals';

declare const process: { cwd(): string };
declare function require(id: 'fs'): { readFileSync(file: string, encoding: 'utf8'): string };
declare function require(id: 'path'): { join(...parts: string[]): string };

describe('timeline reads', () => {
  it('reads the timeline view and live accounts, and does not hardcode the day switch', () => {
    const fs = require('fs');
    const path = require('path');
    const data = fs.readFileSync(path.join(process.cwd(), 'src/data/timeline.ts'), 'utf8');
    expect(data).toContain(".from('timeline')");
    expect(data).toContain('liveRows(');
    expect(data).toContain("from('asset_accounts')");
    expect(data).not.toContain('push_subscriptions');
    expect(data).not.toContain('04:00');
    for (const file of [
      'src/core/timeline-day.ts',
      'src/core/timeline-page.ts',
      'src/core/timeline-present.ts',
      'src/core/timeline-journal.ts',
      'src/features/timeline/TimelineScreen.tsx',
    ]) {
      expect(fs.readFileSync(path.join(process.cwd(), file), 'utf8')).not.toContain('04:00');
    }
  });
});
