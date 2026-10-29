import { LOAD_TIMEOUT_MS } from '@/lib/timing';

/** Reject when `work` is still pending after the shared load budget. The original promise is left alone. */
export function withLoadTimeout<T>(work: Promise<T>, ms: number = LOAD_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
