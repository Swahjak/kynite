'use client';

import { useTranslations } from 'next-intl';
import { useCompletionFlow } from '@/components/realtime';
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

  /**
   * The completion flow itself lives in `@/components/realtime`
   * (`useCompletionFlow`): the optimistic flip, the outbox, the echo
   * suppression and the celebration that is never walked back. It was
   * extracted from this file when M3 of the 2026-09-14 plan added the
   * family-wide "Actieve routines" page, which taps the same steps — so both
   * surfaces celebrate identically and neither can drift.
   */
  const { withOptimistic, lingering, complete, celebration, justFinished } =
    useCompletionFlow<BoardRoutine>({
      send: (entry) =>
        completeStepAction({
          routineId: entry.routineId,
          routineStepId: entry.routineStepId,
          memberId: entry.memberId,
          occurrenceDate: entry.occurrenceDate,
          clientId: entry.clientId,
          source: entry.source,
        }),
      // Per completed *step*, never per routine — a five-step routine at three
      // stars pays fifteen for a full run.
      starsFor: (routine) => routine.total * routine.starsPerCompletion,
    });

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
                celebrating={justFinished.has(routine.id)}
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
      {/* The whole-routine moment (M3 of the 2026-09-14 plan, owner ask).
          Praise first, stars second (FR15) and the child by name — it appears
          on the transition only, never on a refresh that re-renders a routine
          that was already finished, and clears itself after a few seconds. */}
      {celebration ? (
        <p
          data-testid="routine-celebration"
          data-routine-id={celebration.routine.id}
          role="status"
          className="kynite-anim-pop flex items-center gap-3 rounded-2xl bg-accent px-5 py-3.5 font-display text-h3 font-extrabold text-brand-ink lg:col-span-2"
        >
          <Icon name="celebration" filled size="lg" className="shrink-0" />
          {t('routineCelebration', {
            name: board.member.displayName,
            routine: celebration.routine.title,
            stars: celebration.stars,
          })}
        </p>
      ) : null}

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
