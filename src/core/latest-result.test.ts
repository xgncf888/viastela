import { expect, test } from '@jest/globals';

import { createResultSequence } from './latest-result';

test('only the latest reload token is current', () => {
  const sequence = createResultSequence();
  const first = sequence.next();
  const second = sequence.next();
  expect(sequence.isCurrent(first)).toBe(false);
  expect(sequence.isCurrent(second)).toBe(true);
  const third = sequence.next();
  expect(sequence.isCurrent(second)).toBe(false);
  expect(sequence.isCurrent(third)).toBe(true);
});

test('an older reload result is ignored after a newer one starts', async () => {
  const sequence = createResultSequence();
  let applied: string | null = null;
  const firstToken = sequence.next();
  const first = new Promise<string>((resolve) => {
    setTimeout(() => resolve('500000'), 20);
  }).then((value) => {
    if (sequence.isCurrent(firstToken)) applied = value;
  });
  const secondToken = sequence.next();
  await Promise.resolve('700000').then((value) => {
    if (sequence.isCurrent(secondToken)) applied = value;
  });
  expect(applied).toBe('700000');
  await first;
  expect(applied).toBe('700000');
});
