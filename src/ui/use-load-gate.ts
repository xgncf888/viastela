import { useEffect, useState } from 'react';

import { decideLoad, idleMemory, sameMemory, wakeDelay, type LoadDecision, type LoadMemory } from '@/lib/load-gate';

type Clock = {
  loading: boolean;
  attempt: number;
  now: number;
  memory: LoadMemory;
};

function memoryOf(decision: LoadDecision): LoadMemory {
  return { phase: decision.phase, startedAt: decision.startedAt, shownAt: decision.shownAt };
}

export function useLoadGate(loading: boolean, attempt = 0): LoadDecision {
  const [clock, setClock] = useState<Clock>(() => ({ loading, attempt, now: Date.now(), memory: idleMemory }));

  let active = clock;
  if (clock.attempt !== attempt || clock.loading !== loading) {
    // A new attempt starts at the delay even when `loading` never flipped
    // back to false. A loading flip keeps the previous phase so a restart
    // inside the minimum hold does not drop the skeleton. `now` is read here
    // so a stale clock cannot skip straight to timeout.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const decision = decideLoad({
      loading,
      now,
      memory: clock.attempt !== attempt ? idleMemory : clock.memory,
    });
    active = { loading, attempt, now, memory: memoryOf(decision) };
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
