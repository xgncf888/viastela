export type UpdatePromptInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/**
 * While the update prompt is on screen it uses the top inset as its own padding.
 * Screens under it read safe-area insets, so that top value must be zero or they pad twice.
 */
export function insetsBelowUpdatePrompt<T extends UpdatePromptInsets>(insets: T, promptVisible: boolean): T {
  if (!promptVisible || insets.top === 0) return insets;
  return { ...insets, top: 0 };
}
