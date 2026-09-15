'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon, MemberFace, ProgressBar, RoutineCard, cn, type IconName } from '@kynite/ui';
import { useCompletionFlow } from '@/components/realtime';
import { useDateTimeFormat } from '@/components/formatting';
import { resolveOpenRoutineId, type OpenOverride } from '../domain/routines-board';
import type {
  CompleteStepInput,
  CompletionState,
  FamilyBoardRoutine,
  FamilyRoutineColumn,
  FamilyRoutinesData,
  TimeSection,
} from '@/modules/routines';
import { MemberFilter, type MemberFilterEntry } from './member-filter';
import { TodayClock } from './today-clock';

/**
 * The family-wide "Actieve routines" page (`(hub)/hub/routines`, M3 of the
 * 2026-09-14 taken-board-routines-page plan, after
 * `docs/design/claude-design/Actieve routines.dc.html`).
 *
 * One column per family member, each running the day top to bottom: the
 * routine that is live right now stands open with its steps, everything else
 * is a quiet line, and a finished routine stays in place wearing KLAAR rather
 * than disappearing — children see their own day back.
 *
 * Where this sits relative to the two boards that already exist:
 *
 * - `/hub/taken` (`routines-board.tsx`) is the **tasks** board. A routine step
 *   is not tapped there at all; it shows a collapsed progress card instead.
 * - `/hub/routines/[memberId]` (`RoutineBoard`, routines slice) is one child's
 *   own larger screen.
 * - This is the household's overview of the same steps, tappable — the wall
 *   tablet's answer to "where is everyone".
 *
 * It lives in the today slice, beside `routines-board.tsx`, because it needs
 * that slice's `TodayClock` and `MemberFilter`; deep imports across slices are
 * banned and the routines barrel carries `server-only` reads, so the data
 * arrives fully resolved (colour classes, icon tints) and `completeStepAction`
 * arrives by reference from the route, exactly as `toggleTaskAction` does on
 * the taken board.
 *
 * The completion flow itself is *not* reimplemented here: `useCompletionFlow`
 * (`@/components/realtime`) is the same hook `RoutineBoard` uses, so the
 * optimistic flip, the offline outbox, the echo suppression and the promise
 * that a celebration is never walked back are one implementation rather than
 * two.
 */

const BAND_ICON: Record<TimeSection, IconName> = {
  morning: 'wb_twilight',
  afternoon: 'wb_sunny',
  evening: 'bedtime',
};

const BAND_TONE: Record<TimeSection, { icon: string; fill: string }> = {
  morning: { icon: 'text-cat-yellow-fg', fill: 'bg-cat-yellow-solid' },
  afternoon: { icon: 'text-cat-teal-fg', fill: 'bg-cat-teal-solid' },
  evening: { icon: 'text-cat-purple-fg', fill: 'bg-cat-purple-solid' },
};

export type RoutinesPageBoardProps = {
  data: FamilyRoutinesData;
  /** Household-local `YYYY-MM-DD` — feeds `TodayClock`'s midnight refresh. */
  dayKey: string;
  /** `completeStepAction` from the routines slice, passed by reference. */
  completeStepAction: (input: CompleteStepInput) => Promise<CompletionState>;
};

export function RoutinesPageBoard({ data, dayKey, completeStepAction }: RoutinesPageBoardProps) {
  const t = useTranslations('today');
  const formatDateTime = useDateTimeFormat();

  const { withOptimistic, complete, celebration, justFinished } =
    useCompletionFlow<FamilyBoardRoutine>({
      send: (entry) =>
        completeStepAction({
          routineId: entry.routineId,
          routineStepId: entry.routineStepId,
          memberId: entry.memberId,
          occurrenceDate: entry.occurrenceDate,
          clientId: entry.clientId,
          source: entry.source,
        }),
      // Per completed *step*, never per routine.
      starsFor: (routine) => routine.total * routine.starsPerCompletion,
    });

  /** Client state only — a filter chosen at the wall is not a link to share. */
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());

  /**
   * Which card a column has open, once someone has tapped one.
   *
   * Absent means "whatever the server decided" (`activeRoutineId`, the first
   * live unfinished routine). One open card per column, never one for the whole
   * page — the columns belong to different people.
   *
   * The entry is an `OpenOverride`, not a bare id: it carries the
   * `activeRoutineId` it was made against, so `resolveOpenRoutineId` can let it
   * yield once the day moves on. Without that, one tap would park a column on
   * one card for the rest of the evening — including on a *finished* one, with
   * the live routine collapsed underneath it, which is the opposite of what an
   * open card is for.
   */
  const [openByColumn, setOpenByColumn] = useState<ReadonlyMap<string, OpenOverride>>(
    () => new Map()
  );

  const filterMembers: MemberFilterEntry[] = data.columns.map((column) => ({
    id: column.memberId,
    displayName: column.displayName,
    avatarUrl: column.avatarUrl,
    surfaceClass: column.colorClasses.surface,
  }));

  const visibleColumns =
    selectedIds.size === 0
      ? data.columns
      : data.columns.filter((column) => selectedIds.has(column.memberId));

  /**
   * Pager dots: which columns the scroller currently has in view.
   *
   * Measured rather than assumed. How many columns fit depends on the viewport
   * (three at 1280, one on a phone looking at the hub, and fewer again once the
   * 340px floor beats the 33% basis), so a hardcoded initial range would light
   * the wrong dots until the first scroll — and on a wall tablet that never
   * scrolls, forever.
   */
  const scroller = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState<{ first: number; last: number }>({ first: 0, last: 0 });

  const measure = useCallback(() => {
    const node = scroller.current;
    if (!node) return;

    const children = [...node.children] as HTMLElement[];
    if (children.length === 0) return;

    const left = node.scrollLeft;
    const right = left + node.clientWidth;
    // A column counts as in view once its middle is: the mockup's fourth column
    // "announces itself at the edge" and is deliberately not lit.
    const indices = children.flatMap((child, index) => {
      const middle = child.offsetLeft + child.offsetWidth / 2;
      return middle > left && middle < right ? [index] : [];
    });
    if (indices.length === 0) return;

    setInView((previous) => {
      const first = indices[0] ?? 0;
      const last = indices[indices.length - 1] ?? 0;
      return previous.first === first && previous.last === last ? previous : { first, last };
    });
  }, []);

  // On mount, and on every resize of the scroller or its columns (which covers
  // a window resize, the rail collapsing, and a column being filtered in or
  // out) — torn down with the component.
  useEffect(() => {
    measure();

    const node = scroller.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);

    return () => observer.disconnect();
  }, [measure, visibleColumns.length]);

  return (
    <div data-testid="routines-page-board" className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-shrink-0 items-center gap-5 border-b border-line-subtle pb-4">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-extrabold tracking-tight">
            {t('routinesPage.title')}
          </h1>
          <span className="mt-0.5 block text-body-sm text-ink-secondary">
            {formatDateTime(data.now, { dateStyle: 'full' })}
          </span>
        </div>

        <span className="flex-1" />

        <MemberFilter
          members={filterMembers}
          selectedIds={selectedIds}
          onToggle={(memberId) =>
            setSelectedIds((previous) => {
              const next = new Set(previous);
              if (next.has(memberId)) next.delete(memberId);
              else next.add(memberId);
              return next;
            })
          }
          onClear={() => setSelectedIds(new Set())}
          label={t('board.who.label')}
          everyoneLabel={t('board.who.everyone')}
          filterLabel={(name) => t('board.who.filterByMember', { name })}
        />

        <TodayClock now={data.now} timeZone={data.timeZone} dayKey={dayKey} variant="hub" />
      </header>

      <div
        ref={scroller}
        onScroll={measure}
        className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto [scrollbar-color:var(--line-subtle)_transparent] [scrollbar-width:thin]"
      >
        {visibleColumns.map((column) => (
          <MemberRoutineColumn
            key={column.memberId}
            column={column}
            canComplete={data.canComplete}
            openRoutineId={resolveOpenRoutineId(
              column.bands.flatMap((band) => band.routines),
              column.activeRoutineId,
              openByColumn.get(column.memberId)
            )}
            onToggleRoutine={(routineId) =>
              setOpenByColumn((previous) => {
                const current = resolveOpenRoutineId(
                  column.bands.flatMap((band) => band.routines),
                  column.activeRoutineId,
                  previous.get(column.memberId)
                );
                const next = new Map(previous);
                next.set(column.memberId, {
                  against: column.activeRoutineId,
                  openId: current === routineId ? null : routineId,
                });
                return next;
              })
            }
            resolveRoutine={withOptimistic}
            justFinished={justFinished}
            celebration={
              celebration && celebration.routine.memberId === column.memberId
                ? t('routinesPage.celebrate', {
                    name: column.displayName,
                    routine: celebration.routine.title,
                    stars: celebration.stars,
                  })
                : null
            }
            onComplete={complete}
          />
        ))}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2.5 pt-1">
        <Icon name="swipe" size="sm" className="text-ink-muted" />
        <span className="text-body-sm text-ink-muted">{t('board.footerHint')}</span>
        <span className="flex-1" />

        {/* Pager dots: a wide pill for each column actually in view, an 8px dot
            for the ones waiting off the edge. Decoration — the scroller itself
            is the control, and it is keyboard-reachable. */}
        <span aria-hidden data-testid="routines-pager" className="flex items-center gap-1.5">
          {visibleColumns.map((column, index) => (
            <span
              key={column.memberId}
              className={cn(
                'h-2 rounded-4xl transition-all duration-200 ease-brand',
                index >= inView.first && index <= inView.last ? 'w-5.5 bg-primary' : 'w-2 bg-line'
              )}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

function MemberRoutineColumn({
  column,
  canComplete,
  openRoutineId,
  onToggleRoutine,
  resolveRoutine,
  justFinished,
  celebration,
  onComplete,
}: {
  column: FamilyRoutineColumn;
  canComplete: boolean;
  openRoutineId: string | null;
  onToggleRoutine: (routineId: string) => void;
  resolveRoutine: (routine: FamilyBoardRoutine) => FamilyBoardRoutine;
  justFinished: ReadonlySet<string>;
  /** The finished-routine line, already translated, or null. */
  celebration: string | null;
  onComplete: (
    routine: FamilyBoardRoutine,
    stepId: string,
    origin: { x: number; y: number }
  ) => void;
}) {
  const t = useTranslations('today');
  const tRoutines = useTranslations('routines');

  // Optimism first: the header count, the bar and the gold treatment all read
  // from the same folded rows the cards below them render, so a tap cannot
  // move one without moving the others.
  const bands = column.bands.map((band) => {
    const routines = band.routines.map(resolveRoutine);
    const total = routines.reduce((sum, routine) => sum + routine.total, 0);
    const doneCount = routines.reduce((sum, routine) => sum + routine.doneCount, 0);
    return { ...band, routines, total, doneCount };
  });

  /**
   * The column head counts the server's own totals plus whatever this device
   * has ticked since — never a recount of the rendered cards.
   *
   * `column.progress` already includes a finished one-off that has left the
   * board (the work happened, so it stays counted, exactly as
   * `loadMemberRoutines` does it for a child's own page). Recomputing over the
   * visible cards alone would make the denominator shrink under the household.
   * So the optimistic *delta* is added to the server's number instead.
   */
  const totalSteps = column.progress.totalSteps;
  const serverDone = column.bands
    .flatMap((band) => band.routines)
    .reduce((sum, routine) => sum + routine.doneCount, 0);
  const optimisticDone = bands
    .flatMap((band) => band.routines)
    .reduce((sum, routine) => sum + routine.doneCount, 0);

  const doneSteps = Math.min(totalSteps, column.progress.doneSteps + (optimisticDone - serverDone));
  const percent = totalSteps === 0 ? 0 : Math.round((doneSteps / totalSteps) * 100);
  const complete = totalSteps > 0 && doneSteps === totalSteps;

  const colors = column.colorClasses;

  return (
    <div
      data-testid="routines-page-column"
      data-member-id={column.memberId}
      data-complete={complete}
      className={cn(
        'flex min-h-0 min-w-[340px] flex-[0_0_calc(33.333%-11px)] flex-col overflow-hidden rounded-2xl border border-line-subtle',
        complete ? 'bg-gradient-to-b from-gold/12 to-card' : 'bg-card'
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 border-b-[3px] px-4 pt-4 pb-3.5',
          complete ? 'border-gold' : colors.border
        )}
      >
        <div className="flex items-center gap-3">
          <MemberFace
            size="hub"
            name={column.displayName}
            avatarUrl={column.avatarUrl}
            initials={column.initials}
            surfaceClass={colors.track}
            ringClass={complete ? 'ring-gold' : colors.ring}
            ringed
          />

          <div className="min-w-0 flex-1">
            <span className="block truncate font-display text-h2 leading-tight font-extrabold">
              {column.displayName}
            </span>
            <span className="block truncate text-body-sm text-ink-secondary">
              {t(`board.role.${column.role}`)}
            </span>
          </div>

          {/* Only when there is something to show. A zero is not a score a
              child needs to read off a wall. */}
          {column.starsEarned > 0 ? (
            <span
              data-testid="column-stars"
              className="tnum flex shrink-0 items-center gap-1.5 rounded-4xl bg-gold/18 px-3 py-1.5 font-display text-body font-extrabold text-gold-ink"
            >
              <Icon name="star" filled size="sm" />
              {column.starsEarned}
              <span className="sr-only">
                {t('routinesPage.starsEarned', { count: column.starsEarned })}
              </span>
            </span>
          ) : null}
        </div>

        <div className="mt-3.5 flex items-center gap-2.5">
          <span className="tnum shrink-0 font-display text-body-sm font-bold text-ink-secondary">
            {t('routinesPage.stepCount', { done: doneSteps, total: totalSteps })}
          </span>
          <ProgressBar
            value={percent}
            size="md"
            className="min-w-12 flex-1"
            fillClassName={complete ? 'bg-gold' : colors.fill}
            shimmer={complete}
            label={t('board.progressLabel', { name: column.displayName })}
          />
          <span className="tnum shrink-0 font-display text-body-sm font-bold text-ink-muted">
            {t('routinesPage.percent', { value: percent })}
          </span>
        </div>
      </div>

      <div className="noscroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-3.5 pb-4.5">
        {celebration ? (
          <p
            data-testid="routine-celebration"
            role="status"
            className="kynite-anim-pop flex items-center gap-2.5 rounded-2xl bg-accent px-3.5 py-2.5 font-display text-body font-extrabold text-accent-foreground"
          >
            <Icon name="celebration" filled size="sm" className="shrink-0" />
            {celebration}
          </p>
        ) : null}

        {bands.length === 0 ? (
          <div
            data-testid="routines-page-column-empty"
            className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-4.5 py-8 text-center text-ink-muted"
          >
            <Icon name="self_improvement" size="xl" />
            <span className="font-display text-h3 font-bold">{t('routinesPage.empty')}</span>
          </div>
        ) : null}

        {bands.map((band) => (
          <div key={band.section} className="flex flex-col gap-3">
            {/* The band header: the time of day, how far into it this member
                is, and a rule between them. Nothing here is interactive. */}
            <div className="pointer-events-none flex items-center gap-2.5 pt-1.5">
              <Icon
                name={BAND_ICON[band.section]}
                size="sm"
                filled
                className={BAND_TONE[band.section].icon}
              />
              <span className="font-display text-h3 leading-tight font-extrabold">
                {tRoutines(`sections.${band.section}`)}
              </span>
              <ProgressBar
                value={band.total === 0 ? 0 : Math.round((band.doneCount / band.total) * 100)}
                size="sm"
                className="min-w-8 flex-1"
                fillClassName={BAND_TONE[band.section].fill}
              />
              <span className="tnum shrink-0 font-display text-body-sm font-bold text-ink-muted">
                {t('routinesPage.bandCount', { done: band.doneCount, total: band.total })}
              </span>
            </div>

            {band.routines.map((routine) => {
              const expanded = routine.id === openRoutineId && !routine.complete;

              return (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  expanded={expanded}
                  dense
                  celebrating={justFinished.has(routine.id)}
                  onToggle={() => onToggleRoutine(routine.id)}
                  copy={{
                    stepCount: expanded
                      ? tRoutines('stepProgress', {
                          done: routine.doneCount,
                          total: routine.total,
                        })
                      : t('routinesPage.routineMeta', {
                          time: routine.dueTime,
                          done: routine.doneCount,
                          total: routine.total,
                        }),
                    inProgress: tRoutines('inProgress'),
                    doneLine: tRoutines(`routineDone.${routine.doneKey}`, {
                      name: column.displayName,
                    }),
                    countdown: null,
                    starLabel: (amount: number) => tRoutines('starsEarned', { count: amount }),
                    actionLabel: (title: string) => tRoutines('completeStep', { title }),
                    praise: (praiseKey: string) => tRoutines(`praise.${praiseKey}`),
                    graduated: routine.graduated ? tRoutines('graduated') : null,
                    praiseLine:
                      expanded && routine.doneCount > 0 && !routine.complete
                        ? tRoutines('praiseRemaining', {
                            count: routine.total - routine.doneCount,
                          })
                        : null,
                    graceLabel: routine.state === 'grace' ? tRoutines('graceChip') : null,
                    tileClass: routine.tileClass,
                  }}
                  onComplete={
                    canComplete
                      ? (stepId, origin) => onComplete(routine, stepId, origin)
                      : undefined
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
