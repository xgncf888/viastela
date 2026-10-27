/** Thrown when a write targets an id that was already soft-deleted. Do not retry that id. */
export const RECORD_DELETED = 'record deleted';

type DbError = {
  code?: string | null;
  message?: string | null;
};

/**
 * The deleted-row trigger raises P0001. Any other code, including row-level
 * security, means the same id can be retried.
 */
export function isRecordDeleted(error: DbError): boolean {
  return error.code === 'P0001';
}

/** `record deleted` drops the pending row. Anything else can be retried on the same id. */
export function weightSaveOutcome(error: unknown): 'retry' | typeof RECORD_DELETED {
  if (error instanceof Error && error.message === RECORD_DELETED) return RECORD_DELETED;
  return 'retry';
}
