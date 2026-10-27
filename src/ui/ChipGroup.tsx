import type { ReactNode } from 'react';

import { Row } from './layout';

/** One wrapping row of chips: a single choice such as exercise, load kind, or band level. */
export function ChipGroup({ children }: { children: ReactNode }) {
  return (
    <Row gap="sm" wrap>
      {children}
    </Row>
  );
}
