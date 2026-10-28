import type { WeightRecord } from '@/core/weight-stats';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';

import { averageCaption } from './weight-copy';

export function AverageHeadline({ records, endDay }: { records: readonly WeightRecord[]; endDay: string }) {
  const caption = averageCaption(records, endDay);
  const insufficient = caption.headline === '数据不足';
  return (
    <Card>
      <Text variant="muted">7 日均重</Text>
      <Text variant={insufficient ? 'heading' : 'display'}>
        {caption.headline}
      </Text>
      <Text variant="muted">{caption.detail}</Text>
    </Card>
  );
}
