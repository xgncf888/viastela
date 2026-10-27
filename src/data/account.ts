import { getSupabase } from './client';

export class DeleteAccountError extends Error {
  readonly code: 'reauth_required' | 'delete_failed';

  constructor(code: 'reauth_required' | 'delete_failed') {
    super(code);
    this.name = 'DeleteAccountError';
    this.code = code;
  }
}

export function isReauthRequired(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  return (error as { code?: unknown }).code === 'reauth_required';
}

export async function deleteOwnAccount(): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke('delete-account', { method: 'POST' });
  if (!error) return;
  throw new DeleteAccountError(await readDeleteErrorCode(error, data));
}

/** Reads a function error body. Only `reauth_required` is special; everything else is a failed delete. */
export async function readDeleteErrorCode(
  error: unknown,
  data: unknown,
): Promise<'reauth_required' | 'delete_failed'> {
  if (errorCode(data) === 'reauth_required' || errorCode(error) === 'reauth_required') {
    return 'reauth_required';
  }
  const context = error && typeof error === 'object' && 'context' in error ? error.context : undefined;
  if (errorCode(context) === 'reauth_required') return 'reauth_required';
  if (context instanceof Response) {
    try {
      const body: unknown = await context.clone().json();
      if (errorCode(body) === 'reauth_required') return 'reauth_required';
    } catch {
      // Empty or unreadable body. The screen treats that as a failed delete.
    }
  }
  return 'delete_failed';
}

function errorCode(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('error' in value)) return null;
  const code = (value as { error?: unknown }).error;
  return typeof code === 'string' ? code : null;
}
