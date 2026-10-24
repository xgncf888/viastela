import { describe, expect, it } from '@jest/globals';

import { parseWeightKg } from './weight-input';

describe('parseWeightKg', () => {
  it('accepts a positive weight under 500', () => {
    expect(parseWeightKg('72.4')).toBe(72.4);
    expect(parseWeightKg('72,4')).toBe(72.4);
    expect(parseWeightKg('72.4.1')).toBeNull();
    expect(parseWeightKg('0')).toBeNull();
    expect(parseWeightKg('500')).toBeNull();
    expect(parseWeightKg('')).toBeNull();
  });
});
