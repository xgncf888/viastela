import { expect, test } from '@jest/globals';

import { DeleteAccountError, isReauthRequired, readDeleteErrorCode } from './account';

test('reauth_required is read from the function body and other errors are a failed delete', async () => {
  const response = new Response(JSON.stringify({ error: 'reauth_required' }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });
  await expect(readDeleteErrorCode({ context: response }, null)).resolves.toBe('reauth_required');

  const failed = new Response(JSON.stringify({ error: 'delete_failed' }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  });
  await expect(readDeleteErrorCode({ context: failed }, null)).resolves.toBe('delete_failed');
  await expect(readDeleteErrorCode(new Error('network'), null)).resolves.toBe('delete_failed');

  const reauth = new DeleteAccountError('reauth_required');
  expect(isReauthRequired(reauth)).toBe(true);
  expect(isReauthRequired(new DeleteAccountError('delete_failed'))).toBe(false);
  expect(isReauthRequired(new Error('删除失败，请重试'))).toBe(false);
});
