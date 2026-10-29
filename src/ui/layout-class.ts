import { theme } from './theme';

/** Window-width class. Native tablets use the same widths as the browser. */
export type LayoutClass = 'compact' | 'medium' | 'expanded';

/**
 * Compact is below the tablet breakpoint, medium is below desktop, expanded is the rest.
 * Boundaries: 599 compact, 600 medium, 1023 medium, 1024 expanded.
 */
export function layoutClassForWidth(width: number): LayoutClass {
  if (width >= theme.breakpoint.desktop) return 'expanded';
  if (width >= theme.breakpoint.tablet) return 'medium';
  return 'compact';
}
