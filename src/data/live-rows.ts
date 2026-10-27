/** Every record-table read goes through here so soft-deleted rows stay out of the app. */
export function liveRows<Q extends { is(column: 'deleted_at', value: null): Q }>(query: Q): Q {
  return query.is('deleted_at', null);
}
