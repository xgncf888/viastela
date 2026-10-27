import { expect, test } from '@jest/globals';

import { clearQuoteCache, readCachedQuotes, writeCachedQuotes } from './quoteCache';

test('quote cache calls reject until a later change adds storage', async () => {
  const quote = {
    symbol: 'EXAMPLE',
    price: 1,
    currency: 'USD',
    as_of: '2026-01-01T00:00:00.000Z',
    status: 'fresh' as const,
  };
  await expect(readCachedQuotes('user-a')).rejects.toThrow('not implemented');
  await expect(writeCachedQuotes('user-a', [quote])).rejects.toThrow('not implemented');
  await expect(clearQuoteCache('user-a')).rejects.toThrow('not implemented');
  await expect(clearQuoteCache()).rejects.toThrow('not implemented');
});

test('quote cache requires a user id when one is passed', async () => {
  await expect(readCachedQuotes('  ')).rejects.toThrow(/userId/);
  await expect(clearQuoteCache('')).rejects.toThrow(/userId/);
});
