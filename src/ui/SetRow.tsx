import type { ReactNode } from 'react';

import { Button } from './Button';
import { Card } from './Card';
import { Row } from './layout';
import { Text } from './Text';

/** One set. Title is the exercise, detail is reps and load, and 删除 sits at the top-right when it can be removed. */
export function SetRow({
  title,
  detail,
  onDelete,
  children,
}: {
  title: string;
  detail: string;
  onDelete?: () => void;
  children?: ReactNode;
}) {
  return (
    <Card>
      <Row justify="between" align="center">
        <Text variant="muted">{title}</Text>
        {onDelete ? <Button label="删除" variant="ghost" onPress={onDelete} /> : null}
      </Row>
      <Text variant="heading">{detail}</Text>
      {children}
    </Card>
  );
}
