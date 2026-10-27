/** Thrown when an upsert targets an id that was soft-deleted. Do not retry that id. */
export const RECORD_DELETED = 'record deleted';

type DbError = {
  code?: string | null;
  message?: string | null;
};

/**
 * Postgres rejects an upsert of a soft-deleted id with row-level security:
 * the hidden row can be matched, but the new row still has deleted_at set.
 */
export function isSoftDeletedUpsert(error: DbError): boolean {
  return error.code === '42501' && /row-level security policy/i.test(error.message ?? '');
}

/** `record deleted` drops the pending row. Anything else can be retried on the same id. */
export function weightSaveOutcome(error: unknown): 'retry' | typeof RECORD_DELETED {
  if (error instanceof Error && error.message === RECORD_DELETED) return RECORD_DELETED;
  return 'retry';
}
