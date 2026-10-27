/** Thrown when a write targets an id that was already soft-deleted. Do not retry that id. */
export const RECORD_DELETED = 'record deleted';

type DbError = {
  code?: string | null;
  message?: string | null;
};

/**
 * The deleted-row trigger raises P0001 with message `record deleted`.
 * Any other code, or the same code with a different message, can be retried.
 */
export function isRecordDeleted(error: DbError): boolean {
  return error.code === 'P0001' && error.message === RECORD_DELETED;
}

/** A soft-delete update asked for the id back. No row means the write did not land. */
export function requireDeletedIds(rows: readonly { id: string }[] | null | undefined): void {
  if (!rows || rows.length === 0) throw new Error('delete matched no row');
}

/** `record deleted` drops the pending row. Anything else can be retried on the same id. */
export function weightSaveOutcome(error: unknown): 'retry' | typeof RECORD_DELETED {
  if (error instanceof Error && error.message === RECORD_DELETED) return RECORD_DELETED;
  return 'retry';
}
