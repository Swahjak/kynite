'use client';

import { useCallback, useOptimistic, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { fireConfettiBurst } from '@/components/celebration';
import {
  dropCompletion,
  enqueueCompletion,
  useCompletionOutbox,
  useRealtime,
  useRealtimeEvents,
  useRealtimeResync,
  type PendingCompletion,
} from '@/components/realtime';
import { useRouter } from '@/i18n/navigation';
import { Icon, ProgressBar, RoutineCard } from '@kynite/ui';
import { completeStepAction } from '../actions';
import type { BoardRoutine, BoardSection, RoutineBoard as RoutineBoardData } from '../page-data';
import { ROUTINE_ICON_TILE, SECTION_ICONS, SECTION_TONE } from './tokens';

/**
 * The child-facing hub board (M07's `(hub)/routines/[memberId]`).
 *
 * This component owns the client half of the <100ms optimistic completion flow
 * (docs/architecture.md §4):
 *
 * ```
 * tap ─ local state flips to done ─ confetti + praise fire ─ Server Action
 * ```
 *
 * in that order, with **no await before the flip and no spinner anywhere**.
 * `pending` from `useTransition` is deliberately not destructured: there is no
 * loading state to render, because the child has already seen the result.
 *
 * Failure is equally deliberate. Nothing here rolls a celebration back — the
 * write is idempotent (`clientId`) and will land; if it truly does not, the
 * next server render simply shows the step as not-done, quietly. A child never
 * sees an animation reversed.
 *
 * M10 adds the two halves that make that promise true rather than merely
 * intended:
 *
 * - **The outbox.** The tap is written to IndexedDB *after* the flip and
 *   *before* the request, so a tap made with no network survives the tab. The
 *   Server Action is still attempted immediately; if it throws, the entry stays
 *   queued and is flushed the moment the stream comes back. `clientId` is
 *   derived from `(member, step, day)`, so the replay lands idempotently —
 *   `unique(client_id)` turns the second write into a no-op rather than a
 *   second star.
 * - **Reconciliation over SSE.** Another device's completion refreshes this
 *   board; *this* device's own echo is dropped by `clientId` (§4), because it
 *   has already rendered the result and re-applying it could interrupt an
 *   animation a child is still watching.
 *
 * Nothing in either path can roll a celebration back. There is deliberately no
 * branch here that clears an optimistic completion on failure.
 */

export function RoutineBoard({ board }: { board: RoutineBoardData }) {
  const t = useTranslations('routines');

  const [optimisticDone, addOptimisticDone] = useOptimistic<ReadonlySet<string>, string>(
    new Set<string>(),
    (previous, stepId) => new Set(previous).add(stepId)
  );
  /**
   * Steps this device has celebrated, which **outlive the transition**.
   *
   * `useOptimistic` alone cannot express §4's rule. It reverts by design when
   * the transition settles, so a tap made with no network flips to done,
   * celebrates, and then silently flips *back* the moment the failed request
   * returns — a celebration rolled back under a child's hands, which is the one
   * thing the research says never to do. This set is what makes it stick: added
   * before the transition, removed only by an explicit terminal rejection.
   *
   * `useOptimistic` still earns its place: it is what carries the flip through
   * the `router.refresh()` that follows a successful write, before the server's
   * own render catches up.
   */
  const [celebrated, setCelebrated] = useState<ReadonlySet<string>>(new Set());
  /**
   * Routines this device finished that the *server* has since dropped from the
   * board (M20).
   *
   * A finished one-off leaves the board — that is the point of a one-off, and
   * `loadMemberRoutines` filters it out. But the completion also triggers a
   * refresh, so without this the card a child has just tapped would be yanked
   * off the screen underneath their finger, half a second into its
   * celebration. That is the same broken promise as a rolled-back animation,
   * arriving by a different route.
   *
   * So the card lingers for as long as this view lives: the child watches it
   * finish, and the next time the board loads it is simply not there. Nothing
   * is re-fetched and nothing is written — this is a render-level memory of
   * something that has already happened.
   */
  const [lingering, setLingering] = useState<ReadonlyMap<string, BoardRoutine>>(new Map());
  const [, startTransition] = useTransition();
  const router = useRouter();
  const { markOwn } = useRealtime();

  const sendCompletion = useCallback(
    (entry: PendingCompletion) =>
      completeStepAction({
        routineId: entry.routineId,
        routineStepId: entry.routineStepId,
        memberId: entry.memberId,
        occurrenceDate: entry.occurrenceDate,
        clientId: entry.clientId,
        source: entry.source,
      }),
    []
  );

  /** One queued tap → the Server Action. `true` means "settled, stop retrying". */
  const send = useCallback(
    async (entry: PendingCompletion) => {
      const result = await sendCompletion(entry);
      // `done` covers the replay case too, which is exactly right: a write that
      // was already there is a write that no longer needs sending. An `error`
      // is settled as well — a routine that no longer exists never will
      // succeed, and retrying it forever would be the one way this queue could
      // become permanent.
      return result.status !== 'undone';
    },
    [sendCompletion]
  );

  // Anything queued from an earlier session — or from a tap that could not
  // reach the server — lands as soon as landing it can work.
  useCompletionOutbox(send, () => router.refresh());

  // Someone else's tap (this device's own echoes never arrive — §4).
  useRealtimeEvents(['completion.created', 'completion.undone', 'stars.awarded'], () => {
    router.refresh();
  });

  // The gap was too big to replay: refetch everything (§4).
  useRealtimeResync(() => router.refresh());

  /** The board with this device's completions folded in — one source for render. */
  const withOptimistic = (routine: BoardRoutine): BoardRoutine => {
    if (optimisticDone.size === 0 && celebrated.size === 0) return routine;

    const steps = routine.steps.map((step) =>
      step.done || !(optimisticDone.has(step.id) || celebrated.has(step.id))
        ? step
        : { ...step, done: true }
    );
    const doneCount = steps.filter((step) => step.done).length;

    return {
      ...routine,
      steps,
      doneCount,
      complete: steps.length > 0 && doneCount === steps.length,
      ratio: steps.length === 0 ? 0 : doneCount / steps.length,
    };
  };

  const complete = (routine: BoardRoutine, stepId: string, origin: { x: number; y: number }) => {
    const step = routine.steps.find((entry) => entry.id === stepId);
    if (!step || step.done) return;

    // Finishing the last step of a routine is a bigger moment than finishing
    // one of four — but only one step up the intensity dial, never a different
    // kind of animation that would make the everyday tap feel unrewarded.
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

    startTransition(async () => {
      addOptimisticDone(stepId);
      fireConfettiBurst({ intensity: lastStep ? 'standard' : 'gentle', origin });

      // Durable before the request, per §4's timeline. Everything from here on
      // is retry plumbing — the child has already seen the result.
      await enqueueCompletion(entry);

      try {
        const result = await sendCompletion(entry);
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
          // The same revert has to reach `lingering`, or the one-off whose
          // deletion caused this rejection is held on screen *forever* — and
          // held as permanently incomplete, since the completion it was holding
          // for has just been taken back. A card that cannot be finished and
          // cannot be dismissed is worse than the card simply going away, which
          // is what the server has already decided happened.
          setLingering((previous) => {
            if (!previous.has(routine.id)) return previous;
            const next = new Map(previous);
            next.delete(routine.id);
            return next;
          });
        }
      } catch {
        // Offline, or the request died in flight. The entry stays queued and
        // the celebration stays on screen; the flush effect above will land it.
      }
    });
  };

  /**
   * The line under a routine's title, which is a different sentence in each of
   * the card's readings (`Routines.dc.html`): what is left of the one being
   * done, how long a grace occurrence still has, and what an upcoming one is
   * worth.
   */
  const subtitleFor = (routine: BoardRoutine, expanded: boolean) => {
    if (expanded) return t('stepProgress', { done: routine.doneCount, total: routine.total });
    if (routine.state === 'grace') return t('graceHint');
    // A graduated routine no longer pays, so "3 stappen · +0 sterren" would be
    // an arithmetic statement about nothing. The sheet's line is the promotion
    // it actually is: "dat kun jij al zelf!" (`Routines.dc.html` r131).
    if (routine.graduated) return t('graduatedHint');
    if (routine.oneOff) return t('oneOffAndStars', { stars: routine.starsPerCompletion });
    return t('stepsAndStars', { count: routine.total, stars: routine.starsPerCompletion });
  };

  /**
   * The countdown chip, in the two readings the sheet draws.
   *
   * Close in, a duration is what a child can act on: "over 40 min", "over 4
   * uur". Far out it stops being one — "over 11 uur" is a number nobody
   * converts — so the chip names the clock time instead ("om 19:30"), which is
   * also what the household already says to each other about bedtime. Six
   * hours is the hinge: past it a routine belongs to a *later part of today*
   * rather than to soon.
   */
  const countdownFor = (routine: BoardRoutine) => {
    if (routine.state !== 'upcoming' || routine.minutesUntil === null) return null;
    if (routine.minutesUntil <= 90) return t('startsIn', { minutes: routine.minutesUntil });
    if (routine.minutesUntil <= 360)
      return t('startsInHours', { hours: Math.round(routine.minutesUntil / 60) });
    return t('startsAt', { time: routine.dueTime });
  };

  const copyFor = (routine: BoardRoutine, expanded: boolean) => ({
    stepCount: subtitleFor(routine, expanded),
    inProgress: t('inProgress'),
    doneLine: t(`routineDone.${routine.doneKey}`, { name: board.member.displayName }),
    countdown: countdownFor(routine),
    starLabel: (amount: number) => t('starsEarned', { count: amount }),
    actionLabel: (title: string) => t('completeStep', { title }),
    praise: (praiseKey: string) => t(`praise.${praiseKey}`),
    graduated: routine.graduated ? t('graduated') : null,
    // Praise for having done nothing yet is not praise — the line appears with
    // the first tick and goes away again when the routine is finished, where
    // the done card's own line takes over.
    praiseLine:
      expanded && routine.doneCount > 0 && !routine.complete
        ? t('praiseRemaining', { count: routine.total - routine.doneCount })
        : null,
    graceLabel: t('graceChip'),
    tileClass: ROUTINE_ICON_TILE[routine.icon],
  });

  /**
   * The server's section, plus anything this device is still holding on screen.
   *
   * Only the *list* is merged — the counters are left exactly as the server
   * sent them. `loadMemberRoutines` counts a finished one-off in both the
   * numerator and the denominator of its band even though it drops the card
   * (the work happened, so the band still says "3 van 3"), which means a held
   * card is already in those numbers. Recomputing the totals over
   * `routines + held` would count it a second time and the band would read
   * "4 van 4" for three routines.
   */
  const merge = (section: BoardSection) => {
    const routines = section.routines.map(withOptimistic);
    const present = new Set(routines.map((entry) => entry.id));
    const held = [...lingering.values()]
      .filter((entry) => entry.section === section.section && !present.has(entry.id))
      .map(withOptimistic);

    if (held.length === 0) return { ...section, routines };

    return { ...section, routines: [...routines, ...held] };
  };

  const sections = board.sections.map(merge);
  const anythingToShow = sections.some((section) => section.routines.length > 0);

  /**
   * The sheet's two columns: the band a child is standing in front of on the
   * left at 1.4fr, the rest of the day stacked on the right.
   *
   * Which band goes left is decided by the *content*, not by the clock — the
   * band holding the expanded routine, or failing that the first band with
   * anything in it. A fixed "morning is always left" would leave a wall at
   * seven in the evening with an empty left half and the thing being done
   * squeezed into the narrow column.
   */
  const leading =
    sections.find((section) =>
      section.routines.some((routine) => routine.id === board.activeRoutineId)
    ) ??
    sections.find((section) => section.routines.length > 0) ??
    sections[0];

  const trailing = sections.filter((section) => section !== leading);

  const band = (section: BoardSection) => (
    <section key={section.section} data-testid={`routine-section-${section.section}`}>
      {/* The band header: the time of day, how far into it we are, and a rule
          that runs the whole width between them. Nothing here is interactive —
          a heading, a bar and a count — and on the hub it sits above 80px tap
          targets, so it gives its clicks back to whatever is underneath it. */}
      <div className="pointer-events-none mb-4 flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <Icon
          name={SECTION_ICONS[section.section]}
          size="lg"
          filled
          className={SECTION_TONE[section.section].icon}
        />
        <h2 className="font-display text-h2 font-extrabold text-ink">
          {t(`sections.${section.section}`)}
        </h2>

        <ProgressBar
          value={Math.round(section.ratio * 100)}
          size="sm"
          fillClassName={SECTION_TONE[section.section].fill}
          className="min-w-24 flex-1"
        />

        {/* Neutral board voice: "3 of 7 done", never "you still have to…".
            `shrink-0` because it is a fixed sentence beside a bar that gives:
            without it the count wrapped under the band's own sun icon. */}
        <span
          data-testid={`section-progress-${section.section}`}
          className="tnum shrink-0 font-display text-body font-bold text-ink-secondary"
        >
          {t('sectionProgress', { done: section.doneCount, total: section.total })}
        </span>
      </div>

      {section.routines.length === 0 ? (
        // Only when *something else* on the board has content. A day with
        // nothing at all says so once, underneath, rather than three times over
        // three empty bands (`anythingToShow` below).
        anythingToShow ? (
          <p className="text-body text-ink-muted">{t('sectionEmpty')}</p>
        ) : null
      ) : (
        <div className="flex flex-col gap-3">
          {section.routines.map((routine) => {
            const expanded = routine.id === board.activeRoutineId && !routine.complete;

            return (
              <RoutineCard
                key={routine.id}
                routine={routine}
                expanded={expanded}
                copy={copyFor(routine, expanded)}
                onComplete={(stepId, origin) => complete(routine, stepId, origin)}
              />
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    // The sheet's grid: the live band on the left at 1.4fr, the rest of the day
    // stacked on the right. Below `lg` — a phone looking at the hub — the two
    // columns become one, in the order the day happens.
    <div
      data-testid="routine-board"
      className="grid items-start gap-x-10 gap-y-6 lg:grid-cols-[1.4fr_1fr]"
    >
      <div className="flex min-w-0 flex-col gap-6">{leading ? band(leading) : null}</div>
      <div className="flex min-w-0 flex-col gap-6">{trailing.map(band)}</div>

      {anythingToShow ? null : (
        <p data-testid="routine-board-empty" className="text-body-lg text-ink-secondary">
          {t('boardEmpty')}
        </p>
      )}
    </div>
  );
}
