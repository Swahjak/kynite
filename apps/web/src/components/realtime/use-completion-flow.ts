'use client';

import { useCallback, useOptimistic, useRef, useState, useTransition } from 'react';
import { fireConfettiBurst } from '@/components/celebration';
import { useRouter } from '@/i18n/navigation';
import { dropCompletion, enqueueCompletion, type PendingCompletion } from './outbox';
import {
  useCompletionOutbox,
  useRealtime,
  useRealtimeEvents,
  useRealtimeResync,
} from './realtime-provider';

/**
 * The one implementation of the optimistic completion flow
 * (docs/architecture.md §4):
 *
 * ```
 * tap ─ local state flips to done ─ confetti + praise fire ─ Server Action
 * ```
 *
 * in that order, with **no await before the flip and no spinner anywhere**.
 * It lived inside `modules/routines/ui/routine-board.tsx` until the 2026-09-14
 * taken-board-routines-page plan's M3 added a second surface that taps the
 * same steps — the family-wide "Actieve routines" page — and a second copy of
 * this would have been two answers to "did the celebration stick": the outbox
 * write, the echo suppression, the terminal-rejection revert and the lingering
 * one-off are all load-bearing and all easy to get subtly wrong twice.
 *
 * It lives under `components/realtime/` rather than in the routines slice for
 * the reason that directory exists at all: the machinery is the outbox, the
 * echo registry and the SSE resync, none of which a `server-only` slice barrel
 * can re-export to the browser. The routine domain arrives as the `send`
 * function the caller passes in, so this hook never imports a Server Action.
 *
 * What it refuses, on every path: rolling a celebration back. A network
 * failure leaves the tap queued and the animation standing; only a hard
 * rejection (`status === 'error'` — a routine that no longer exists) clears
 * it, and then silently on the next render.
 */

/** The read subset of a step this flow needs. */
export type FlowStep = { id: string; done: boolean; clientId: string };

/** The read subset of a routine this flow needs — `BoardRoutine` passes in. */
export type FlowRoutine = {
  id: string;
  memberId: string;
  occurrenceDate: string;
  oneOff: boolean;
  steps: readonly FlowStep[];
  doneCount: number;
  complete: boolean;
  ratio: number;
};

export type CompletionResult = { status: string };

/** What the caller renders as the big "routine finished" moment. */
export type RoutineCelebration<R> = { routine: R; stars: number };

/** How long the celebrate banner stays up before it clears itself. */
export const ROUTINE_CELEBRATION_MS = 7_000;

export type CompletionFlow<R extends FlowRoutine> = {
  /** Folds this device's completions into a server-rendered routine. */
  withOptimistic: (routine: R) => R;
  /** Routines this device finished that the server has since dropped (one-offs). */
  lingering: ReadonlyMap<string, R>;
  /** Tap a step. Fires the celebration before anything is awaited. */
  complete: (routine: R, stepId: string, origin: { x: number; y: number }) => void;
  /** The routine finished by the most recent tap, until it times out. */
  celebration: RoutineCelebration<R> | null;
  /** Routine ids this device has just finished — the KLAAR bounce reads this. */
  justFinished: ReadonlySet<string>;
};

export function useCompletionFlow<R extends FlowRoutine>({
  send,
  starsFor,
}: {
  /** One queued tap → the Server Action. */
  send: (entry: PendingCompletion) => Promise<CompletionResult>;
  /** Stars the finished routine paid, for the celebrate banner. */
  starsFor?: (routine: R) => number;
}): CompletionFlow<R> {
  const [optimisticDone, addOptimisticDone] = useOptimistic<ReadonlySet<string>, string>(
    new Set<string>(),
    (previous, stepId) => new Set(previous).add(stepId)
  );

  /**
   * Steps this device has celebrated, which **outlive the transition**.
   *
   * `useOptimistic` alone reverts by design when the transition settles, so a
   * tap made with no network would flip to done, celebrate, and silently flip
   * back — a celebration rolled back under a child's hands. This set is what
   * makes it stick; `useOptimistic` still carries the flip through the
   * `router.refresh()` that follows a successful write.
   */
  const [celebrated, setCelebrated] = useState<ReadonlySet<string>>(new Set());
  const [lingering, setLingering] = useState<ReadonlyMap<string, R>>(new Map());
  const [celebration, setCelebration] = useState<RoutineCelebration<R> | null>(null);
  const [justFinished, setJustFinished] = useState<ReadonlySet<string>>(new Set());
  const [, startTransition] = useTransition();
  const router = useRouter();
  const { markOwn } = useRealtime();

  /**
   * Routines whose finish this device has already announced.
   *
   * The guard §4's rules imply: the banner and the big burst belong to the
   * *transition*, not to the state. A `router.refresh()` (every realtime push
   * calls one) re-renders a finished routine as finished, and replaying the
   * moment there would have a wall tablet celebrating the same routine all
   * evening. Firing only from `complete` already makes that true for mount and
   * hydration; this ref makes it true for a double tap on the last step too.
   */
  const announced = useRef<Set<string>>(new Set());
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(
    async (entry: PendingCompletion) => {
      const result = await send(entry);
      // `done` covers the replay case: a write that was already there is a
      // write that no longer needs sending. An `error` is settled as well — a
      // routine that no longer exists never will succeed.
      return result.status !== 'undone';
    },
    [send]
  );

  useCompletionOutbox(flush, () => router.refresh());

  // Someone else's tap (this device's own echoes never arrive — §4).
  useRealtimeEvents(['completion.created', 'completion.undone', 'stars.awarded'], () => {
    router.refresh();
  });

  // The gap was too big to replay: refetch everything (§4).
  useRealtimeResync(() => router.refresh());

  const withOptimistic = (routine: R): R => {
    if (optimisticDone.size === 0 && celebrated.size === 0) return routine;

    const steps = routine.steps.map((step) =>
      step.done || !(optimisticDone.has(step.id) || celebrated.has(step.id))
        ? step
        : { ...step, done: true }
    );
    const doneCount = steps.filter((step) => step.done).length;

    // `as R`: every overridden field is declared on `FlowRoutine`, but TypeScript
    // cannot see that a spread of the *generic* R keeps R's own extra fields
    // alongside them.
    return {
      ...routine,
      steps,
      doneCount,
      complete: steps.length > 0 && doneCount === steps.length,
      ratio: steps.length === 0 ? 0 : doneCount / steps.length,
    } as R;
  };

  const complete = (routine: R, stepId: string, origin: { x: number; y: number }) => {
    const step = routine.steps.find((entry) => entry.id === stepId);
    if (!step || step.done) return;

    // Finishing the last step of a routine is a bigger moment than finishing
    // one of four — but only one step up the intensity dial for the tap
    // itself, never a different kind of animation that would make the everyday
    // tap feel unrewarded. The *routine's* own celebration is the extra thing
    // that happens beside it.
    const lastStep = routine.steps.every((entry) => entry.done || entry.id === stepId);

    const entry: PendingCompletion = {
      clientId: step.clientId,
      routineId: routine.id,
      routineStepId: stepId,
      memberId: routine.memberId,
      occurrenceDate: routine.occurrenceDate,
      source: 'hub',
    };

    // Both synchronous and both before the flip: the echo of this write must
    // already be recognisable as our own by the time it can arrive, and the
    // celebration must already be recorded as permanent before anything can
    // fail.
    markOwn(step.clientId);
    setCelebrated((previous) => new Set(previous).add(stepId));
    if (routine.oneOff) {
      setLingering((previous) => new Map(previous).set(routine.id, routine));
    }

    if (lastStep && !announced.current.has(routine.id)) {
      announced.current.add(routine.id);
      setJustFinished((previous) => new Set(previous).add(routine.id));
      setCelebration({ routine, stars: starsFor?.(routine) ?? 0 });

      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setCelebration(null), ROUTINE_CELEBRATION_MS);
    }

    startTransition(async () => {
      addOptimisticDone(stepId);
      // The whole-routine finish gets the full preset; a single step keeps the
      // burst it has always had. `fireConfettiBurst` is a no-op under
      // `prefers-reduced-motion`, so neither needs a guard here.
      fireConfettiBurst({ intensity: lastStep ? 'big' : 'gentle', origin });

      // Durable before the request, per §4's timeline. Everything from here on
      // is retry plumbing — the child has already seen the result.
      await enqueueCompletion(entry);

      try {
        const result = await send(entry);
        await dropCompletion(entry.clientId);

        // §4's single exception: "only a hard 4xx (deleted routine) reverts,
        // and then silently on next render, without a failure animation". A
        // *network* failure is not that — it throws, and is caught below, and
        // the celebration stands.
        if (result.status === 'error') {
          setCelebrated((previous) => {
            const next = new Set(previous);
            next.delete(stepId);
            return next;
          });
          // The revert has to reach `lingering` too, or the one-off whose
          // deletion caused this rejection is held on screen forever, and held
          // as permanently incomplete.
          setLingering((previous) => {
            if (!previous.has(routine.id)) return previous;
            const next = new Map(previous);
            next.delete(routine.id);
            return next;
          });
          setJustFinished((previous) => {
            if (!previous.has(routine.id)) return previous;
            const next = new Set(previous);
            next.delete(routine.id);
            return next;
          });
          setCelebration((previous) => (previous?.routine.id === routine.id ? null : previous));
        }
      } catch {
        // Offline, or the request died in flight. The entry stays queued and
        // the celebration stays on screen; the flush effect above will land it.
      }
    });
  };

  return { withOptimistic, lingering, complete, celebration, justFinished };
}
