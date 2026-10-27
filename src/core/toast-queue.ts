export type ToastPiece = {
  id: number;
  tone: 'ok' | 'error';
  pinned?: boolean;
};

export type ToastQueueState<T extends ToastPiece> = {
  pinned: T | null;
  errors: T[];
  current: T | null;
  queue: T[];
};

export function emptyToastQueue<T extends ToastPiece>(): ToastQueueState<T> {
  return { pinned: null, errors: [], current: null, queue: [] };
}

function reveal<T extends ToastPiece>(state: ToastQueueState<T>): ToastQueueState<T> {
  if (state.pinned || state.current || state.queue.length === 0) return state;
  const [next, ...queue] = state.queue;
  if (!next) return { ...state, queue };
  return { ...state, current: next, queue };
}

/** Error toasts show immediately. Normal toasts wait behind a pinned toast, in order. */
export function enqueueToast<T extends ToastPiece>(state: ToastQueueState<T>, toast: T): ToastQueueState<T> {
  if (toast.pinned) {
    const queue = state.current ? [state.current, ...state.queue] : state.queue;
    return { ...state, pinned: toast, current: null, queue };
  }
  if (toast.tone === 'error') {
    return { ...state, errors: [...state.errors, toast] };
  }
  if (state.pinned || state.current) {
    return { ...state, queue: [...state.queue, toast] };
  }
  return { ...state, current: toast };
}

export function dismissQueuedToast<T extends ToastPiece>(state: ToastQueueState<T>, id: number): ToastQueueState<T> {
  if (state.pinned?.id === id) return reveal({ ...state, pinned: null });
  if (state.current?.id === id) return reveal({ ...state, current: null });
  if (state.errors.some((item) => item.id === id)) {
    return { ...state, errors: state.errors.filter((item) => item.id !== id) };
  }
  if (state.queue.some((item) => item.id === id)) {
    return { ...state, queue: state.queue.filter((item) => item.id !== id) };
  }
  return state;
}
