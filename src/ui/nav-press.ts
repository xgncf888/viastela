/**
 * Pointer press-in navigates once and the click that follows is ignored.
 * A cancelled press clears that ignore, so the next keyboard click still navigates.
 */
export function createNavPress() {
  let fromPointer = false;
  return {
    pressIn(go: () => void) {
      fromPointer = true;
      go();
    },
    press(go: () => void) {
      if (fromPointer) {
        fromPointer = false;
        return;
      }
      go();
    },
    cancel() {
      queueMicrotask(() => {
        fromPointer = false;
      });
    },
  };
}
