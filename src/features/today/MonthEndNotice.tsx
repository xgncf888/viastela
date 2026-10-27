import { useEffect, useState } from 'react';
import { router } from 'expo-router';

import { zonedCivilTime } from '@/core/local-day';
import {
  monthBounds,
  monthKey,
  MONTH_END_BANNER_COPY,
  shouldShowMonthEndBanner,
} from '@/core/month-end-banner';
import { MONTH_END_REMINDER_PATH } from '@/core/reminder-paths';
import { balanceUpdatedThisMonth } from '@/data/account-balances';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Row } from '@/ui/layout';
import { Text } from '@/ui/Text';

const DISMISS_KEY = 'viastela.month-end-banner-dismissed';

function readDismissed(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(DISMISS_KEY);
}

function writeDismissed(month: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DISMISS_KEY, month);
}

/** Last three civil days, and only when this month has no live balance update. */
export function MonthEndNotice({ timeZone }: { timeZone: string }) {
  const [visible, setVisible] = useState(false);
  const [month, setMonth] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    const civil = zonedCivilTime(new Date(), timeZone);
    const key = monthKey(civil.year, civil.month);
    const bounds = monthBounds(civil.year, civil.month);
    void balanceUpdatedThisMonth(bounds.start, bounds.end)
      .then((balanceUpdated) => {
        if (cancel) return;
        setMonth(key);
        setVisible(
          shouldShowMonthEndBanner({
            year: civil.year,
            month: civil.month,
            day: civil.day,
            balanceUpdated,
            dismissedMonth: readDismissed(),
          }),
        );
      })
      .catch(() => {
        if (!cancel) setVisible(false);
      });
    return () => {
      cancel = true;
    };
  }, [timeZone]);

  if (!visible) return null;
  return (
    <Card>
      <Text variant="body">{MONTH_END_BANNER_COPY.message}</Text>
      <Row gap="sm" wrap>
        <Button label={MONTH_END_BANNER_COPY.update} variant="ghost" onPress={() => router.push(MONTH_END_REMINDER_PATH)} />
        <Button
          label={MONTH_END_BANNER_COPY.dismiss}
          variant="ghost"
          onPress={() => {
            if (month) writeDismissed(month);
            setVisible(false);
          }}
        />
      </Row>
    </Card>
  );
}
