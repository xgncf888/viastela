import { describe, expect, it } from '@jest/globals';

import { dismissQueuedToast, emptyToastQueue, enqueueToast, type ToastPiece } from './toast-queue';

function piece(id: number, tone: ToastPiece['tone'], pinned?: boolean): ToastPiece {
  return { id, tone, pinned };
}

describe('toast queue', () => {
  it('shows an error immediately beside a pinned undo toast', () => {
    let state = enqueueToast(emptyToastQueue(), piece(1, 'ok', true));
    state = enqueueToast(state, piece(2, 'error'));
    expect(state.pinned?.id).toBe(1);
    expect(state.errors.map((item) => item.id)).toEqual([2]);
    expect(state.current).toBeNull();
    expect(state.queue).toEqual([]);
  });

  it('keeps two normal toasts in order until the pinned toast is dismissed', () => {
    let state = enqueueToast(emptyToastQueue(), piece(1, 'ok', true));
    state = enqueueToast(state, piece(2, 'ok'));
    state = enqueueToast(state, piece(3, 'ok'));
    expect(state.current).toBeNull();
    expect(state.queue.map((item) => item.id)).toEqual([2, 3]);

    state = dismissQueuedToast(state, 1);
    expect(state.pinned).toBeNull();
    expect(state.current?.id).toBe(2);
    expect(state.queue.map((item) => item.id)).toEqual([3]);

    state = dismissQueuedToast(state, 2);
    expect(state.current?.id).toBe(3);
    expect(state.queue).toEqual([]);
  });

  it('does not let the second normal toast replace the first', () => {
    let state = enqueueToast(emptyToastQueue(), piece(1, 'ok', true));
    state = enqueueToast(state, piece(2, 'ok'));
    state = enqueueToast(state, piece(3, 'ok'));
    expect(state.queue).toHaveLength(2);
    expect(state.queue[0]?.id).toBe(2);
    expect(state.queue[1]?.id).toBe(3);
  });
});
