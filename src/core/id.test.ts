import { describe, expect, it } from '@jest/globals';

import { createId } from './id';

describe('createId', () => {
  it('returns a uuid', () => {
    expect(createId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
