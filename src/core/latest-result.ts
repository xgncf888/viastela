export type ResultSequence = {
  next: () => number;
  isCurrent: (token: number) => boolean;
};

/** Each reload takes a token. Only the newest token may write state. */
export function createResultSequence(): ResultSequence {
  let current = 0;
  return {
    next() {
      current += 1;
      return current;
    },
    isCurrent(token: number) {
      return token === current;
    },
  };
}
