import { useEffect, useState } from 'react';

import { decideLoad, idleMemory, sameMemory, wakeDelay, type LoadDecision, type LoadMemory } from '@/lib/load-gate';

type Clock = {
  loading: boolean;
  now: number;
  memory: LoadMemory;
};

function memoryOf(decision: LoadDecision): LoadMemory {
  return { phase: decision.phase, startedAt: decision.startedAt, shownAt: decision.shownAt };
}

export function useLoadGate(loading: boolean): LoadDecision {
  const [clock, setClock] = useState<Clock>(() => ({ loading, now: Date.now(), memory: idleMemory }));

  let active = clock;
  if (clock.loading !== loading) {
    // The new episode has to start at this prop change, before paint. A stale
    // `now` would turn a fresh request into an instant timeout.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const decision = decideLoad({
      loading,
      now,
      memory: loading ? idleMemory : clock.memory,
    });
    active = { loading, now, memory: memoryOf(decision) };
    setClock(active);
  }

  const decision = decideLoad({ loading: active.loading, now: active.now, memory: active.memory });
  const nextMemory = memoryOf(decision);
  if (!sameMemory(active.memory, nextMemory)) {
    setClock({ ...active, memory: nextMemory });
  }

  const { phase, startedAt, shownAt } = decision;
  const now = active.now;
  useEffect(() => {
    const wait = wakeDelay({ phase, startedAt, shownAt }, now);
    if (wait == null) return undefined;
    const due = now + wait;
    const id = setTimeout(() => {
      setClock((current) => ({ ...current, now: Math.max(due, Date.now()) }));
    }, Math.max(0, due - Date.now()));
    return () => clearTimeout(id);
  }, [phase, startedAt, shownAt, now]);

  return decision;
}
