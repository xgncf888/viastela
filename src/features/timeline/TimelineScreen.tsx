import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';

import { computeLocalDay, currentTimeZone } from '@/core/local-day';
import { timelineSaveNotice } from '@/core/timeline-errors';
import type { TimelineCursor } from '@/core/timeline-day';
import { compareTimelineDesc, type TimelineFilter } from '@/core/timeline-page';
import { groupTimeline, presentTimeline, type PresentedTimelineItem } from '@/core/timeline-present';
import { scheduleDeferredDelete, useDeferredDeleteIds } from '@/features/record/deferred-delete';
import { useAuth } from '@/features/auth/AuthProvider';
import { useShellInset } from '@/features/shell/AppShell';
import { getDaySwitch } from '@/data/profile';
import {
  listTimelineAccounts,
  loadTimelinePage,
  readTimelineAmountsHidden,
  softDeleteJournal,
  type TimelineAccountRow,
  type TimelineRecord,
} from '@/data/timeline';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { ChipGroup } from '@/ui/ChipGroup';
import { EmptyState } from '@/ui/EmptyState';
import { Callout, Row, ScreenHeader, Stack } from '@/ui/layout';
import { MaskedAmount } from '@/ui/MaskedAmount';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TimelineItem } from '@/ui/TimelineItem';
import { DeletedRecordNotice } from '@/ui/deleted-record';
import { showToast } from '@/ui/toast';

import { JournalSheet, type JournalSeed } from './JournalSheet';
import { TimelineScroll } from './TimelineScroll';

const FILTERS: { id: TimelineFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'money', label: '资金' },
  { id: 'journal', label: '日志' },
];

type KeyedRecord = TimelineRecord & { dayKey: string };

export function TimelineScreen() {
  const { session } = useAuth();
  const inset = useShellInset();
  const pendingDeleteIds = useDeferredDeleteIds();
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [daySwitch, setDaySwitch] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState(() => currentTimeZone());
  const [rows, setRows] = useState<KeyedRecord[]>([]);
  const [accounts, setAccounts] = useState<TimelineAccountRow[]>([]);
  const [cursor, setCursor] = useState<TimelineCursor | null>(null);
  const [ready, setReady] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [masked, setMasked] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [seed, setSeed] = useState<JournalSeed | null>(null);
  const [deletedNotice, setDeletedNotice] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const filterRef = useRef(filter);
  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  const reload = useCallback(async (nextFilter: TimelineFilter, switchTime: string, zone: string) => {
    const ticket = generation.current + 1;
    generation.current = ticket;
    setLoadError(null);
    const [page, nextAccounts, hidden] = await Promise.all([
      loadTimelinePage({ timeZone: zone, daySwitch: switchTime, filter: nextFilter, cursor: null }),
      listTimelineAccounts(),
      session ? readTimelineAmountsHidden(session.userId) : Promise.resolve(true),
    ]);
    if (ticket !== generation.current) return;
    setRows(page.records);
    setCursor(page.nextCursor);
    setAccounts(nextAccounts);
    setMasked(hidden);
    setDaySwitch(switchTime);
    setTimeZone(zone);
    setReady(true);
  }, [session]);

  useEffect(() => {
    if (!session) return undefined;
    let cancelled = false;
    const zone = currentTimeZone();
    void getDaySwitch()
      .then((switchTime) => {
        if (cancelled) return;
        setDaySwitch(switchTime);
        setTimeZone(zone);
        return reload(filter, switchTime, zone);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError('读取失败');
        setReady(true);
      });
    return () => {
      cancelled = true;
      generation.current += 1;
    };
  }, [attempt, filter, reload, session]);

  const loadMore = useCallback(async () => {
    if (!cursor || !daySwitch || loadingMore) return;
    const requested = filter;
    setLoadingMore(true);
    try {
      const page = await loadTimelinePage({
        timeZone,
        daySwitch,
        filter: requested,
        cursor,
      });
      if (requested !== filterRef.current) return;
      setRows((current) => {
        const seen = new Set(current.map((row) => row.id));
        return [...current, ...page.records.filter((row) => !seen.has(row.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      if (requested === filterRef.current) showToast({ text: '读取失败', tone: 'error' });
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, daySwitch, filter, loadingMore, timeZone]);

  function openCreate() {
    setSeed(null);
    setSheetOpen(true);
  }

  function openJournal(item: PresentedTimelineItem) {
    if (!item.journal) return;
    setSeed({ id: item.id, ...item.journal });
    setSheetOpen(true);
  }

  const today = daySwitch ? computeLocalDay(new Date(), timeZone, daySwitch) : '';
  const visible = presentTimeline(
    [...rows].sort(compareTimelineDesc).filter((row) => !pendingDeleteIds.has(row.id)),
    accounts,
    timeZone,
  );
  const groups = today ? groupTimeline(visible, today) : [];

  if (!ready) {
    return (
      <Screen>
        <TimelineScroll inset={inset} onNearEnd={() => undefined}>
          <Text variant="body">读取中</Text>
        </TimelineScroll>
      </Screen>
    );
  }

  return (
    <Screen>
      <TimelineScroll
        inset={inset}
        onNearEnd={() => {
          if (cursor && !loadingMore) void loadMore();
        }}
      >
        <ScreenHeader kicker="记录" title="时间线" />
        <Row justify="between" align="center" wrap>
          <ChipGroup>
            {FILTERS.map((choice) => (
              <Chip
                key={choice.id}
                label={choice.label}
                selected={filter === choice.id}
                onPress={() => {
                  if (choice.id === filter) return;
                  filterRef.current = choice.id;
                  setReady(false);
                  setRows([]);
                  setCursor(null);
                  setFilter(choice.id);
                }}
              />
            ))}
          </ChipGroup>
          <Button label="写日志" onPress={openCreate} />
        </Row>
        {loadError ? (
          <Callout
            message={loadError}
            action={
              <Button
                label="重试"
                variant="secondary"
                onPress={() => {
                  setReady(false);
                  setLoadError(null);
                  if (!daySwitch) {
                    setAttempt((current) => current + 1);
                    return;
                  }
                  void reload(filter, daySwitch, timeZone).catch(() => {
                    setLoadError('读取失败');
                    setReady(true);
                  });
                }}
              />
            }
          />
        ) : null}
        {groups.length === 0 && !loadError ? (
          <EmptyState title="还没有记录" description="" action={<Button label="写一条日志" onPress={openCreate} />} />
        ) : (
          groups.map((group) => (
            <Stack key={group.dayKey} gap="sm">
              <Text variant="heading" accessibilityRole="header">
                {group.label}
              </Text>
              <Card>
                {group.items.map((item) => (
                  <Stack key={item.id} gap="xs">
                    {item.editable ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`编辑 ${item.title}`}
                        onPress={() => openJournal(item)}
                      >
                        <TimelineRow item={item} masked={masked} />
                      </Pressable>
                    ) : (
                      <TimelineRow item={item} masked={masked} />
                    )}
                    {item.editable ? (
                      <Row justify="end">
                        <Button
                          label="删除"
                          variant="ghost"
                          onPress={() =>
                            scheduleDeferredDelete('journal', item.id, async () => {
                              try {
                                await softDeleteJournal(item.id);
                              } catch (deleteError) {
                                const notice = timelineSaveNotice(deleteError);
                                if (notice.kind === 'record-deleted') setDeletedNotice(true);
                                else showToast({ text: notice.message, tone: 'error' });
                              }
                            })
                          }
                        />
                      </Row>
                    ) : null}
                  </Stack>
                ))}
              </Card>
            </Stack>
          ))
        )}
        {loadingMore ? <Text variant="body">读取中</Text> : null}
      </TimelineScroll>
      {daySwitch ? (
        <JournalSheet
          visible={sheetOpen}
          today={today}
          timeZone={timeZone}
          seed={seed}
          onClose={() => {
            if (sheetOpen) setSheetOpen(false);
          }}
          onSaved={() => {
            setSheetOpen(false);
            setReady(false);
            void reload(filter, daySwitch, timeZone).catch(() => {
              setLoadError('读取失败');
              setReady(true);
            });
          }}
          onNotice={(notice) => {
            setSheetOpen(false);
            if (notice.kind === 'record-deleted') setDeletedNotice(true);
            else showToast({ text: notice.message, tone: 'error' });
            setReady(false);
            void reload(filter, daySwitch, timeZone).catch(() => {
              setLoadError('读取失败');
              setReady(true);
            });
          }}
        />
      ) : null}
      <DeletedRecordNotice visible={deletedNotice} onClose={() => setDeletedNotice(false)} />
    </Screen>
  );
}

function TimelineRow({ item, masked }: { item: PresentedTimelineItem; masked: boolean }) {
  const detail =
    item.detail == null
      ? undefined
      : item.maskDetail
        ? <MaskedAmount text={item.detail} masked={masked} variant="muted" tone="muted" />
        : item.detail;
  return <TimelineItem title={item.title} detail={detail} time={item.time} />;
}
