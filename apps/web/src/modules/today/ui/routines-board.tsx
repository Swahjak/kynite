'use client';

import { useEffect, useOptimistic, useRef, useState, useTransition, type MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Icon, MemberFace, ProgressBar, cn, type IconName } from '@kynite/ui';
import { fireConfettiBurst } from '@/components/celebration';
import { useDateTimeFormat } from '@/components/formatting';
import { Link, useRouter } from '@/i18n/navigation';
import type { ActionState, ToggleTaskInput } from '@/modules/tasks';
import { columnProgress, daypartFromHour, type TimeSection } from '../domain/routines-board';
import type { BoardColumn, BoardTaskRow, RoutinesBoardData } from '../page-data-board';
import { MemberFilter, type MemberFilterEntry } from './member-filter';
import { TodayClock } from './today-clock';

/**
 * The family-wide "Taken" board (`(hub)/hub/taken`, M-R2 → M1+M2 of the
 * 2026-09-14 taken-board-routines-page plan).
 *
 * One pool column for tasks nobody has picked up yet, one column per family
 * member — tasks always visible, and (M1+M2) a single collapsed routine
 * progress card at the top of a member's column instead of that member's
 * routine steps: this board is no longer where a routine step gets tapped.
 * Tapping the card is a `next/link` to that member's own routine page
 * (`/hub/routines/[memberId]`, unchanged), which is still the larger
 * single-child experience with step-by-step praise and confetti — this board
 * only shows *how far along* that routine is.
 *
 * **Task rows toggle both ways**, matching `TaskList` — a task's `completed`
 * state has always been a target value, not a one-way flag. There is no
 * routine-row tap left on this board at all (that is the change from the
 * M-R2 shape this file used to have): a done step is the read this board
 * shows through the progress card, never a control here.
 *
 * The daypart a member's progress card counts against is the wall clock's
 * own reading (`daypartFromHour`), recomputed on every render — this board
 * carries no daypart tab of its own any more (M1+M2 replaced it with the
 * "Wie" member filter below). `<TodayLive />` (mounted by the page) drives
 * `router.refresh()` on a push, which re-renders this component with a fresh
 * `board.now` and therefore a freshly derived daypart — "re-derived when
 * TodayLive refreshes" is this, not a `useEffect` of its own.
 *
 * Optimism is a local `Set` of task ids folded over the server data, the same
 * shape `TaskList` uses, followed by `router.refresh()` — not the child
 * board's full offline outbox (`useCompletionOutbox`), which exists for a
 * *child's own hands* on a tap that must never visibly roll back. A parent
 * correcting a shared household board a few steps away from the router does
 * not need that guarantee, and `<TodayLive />` already keeps every device's
 * board current over SSE.
 *
 * This component runs in the browser, so it may import neither the routines
 * slice's nor the tasks slice's nor the family slice's value exports — every
 * slice barrel re-exports `server-only` reads alongside its client-safe
 * pieces. `toggleTaskAction` therefore arrives as a prop, passed by
 * reference from the server route, exactly as `TodayTabSterren` hands
 * `completeStepAction` to `StarMatrix`; member colour classes and routine
 * icon tiles arrive pre-resolved on `board` itself (`colorClasses` on
 * `BoardColumn`, `accentClass` on every row) rather than being looked up
 * here.
 */

const DAYPART_ICON: Record<TimeSection, IconName> = {
  morning: 'wb_twilight',
  afternoon: 'wb_sunny',
  evening: 'bedtime',
};

type Origin = { x: number; y: number };
type OptimisticRow = { id: string; done: boolean };

function boundingOrigin(element: HTMLElement): Origin {
  const box = element.getBoundingClientRect();
  return {
    x: (box.left + box.width / 2) / Math.max(window.innerWidth, 1),
    y: (box.top + box.height / 2) / Math.max(window.innerHeight, 1),
  };
}

export type RoutinesBoardProps = {
  board: RoutinesBoardData;
  /** Household-local `YYYY-MM-DD` — feeds `TodayClock`'s midnight refresh. */
  dayKey: string;
  /** `toggleTaskAction` from the tasks slice, passed by reference. */
  toggleTaskAction: (input: ToggleTaskInput) => Promise<ActionState>;
};

export function RoutinesBoard({ board, dayKey, toggleTaskAction }: RoutinesBoardProps) {
  const t = useTranslations('today');
  const formatDateTime = useDateTimeFormat();
  const router = useRouter();

  const daypart: TimeSection = daypartFromHour(new Date(board.now).getHours());

  const [optimistic, setOptimistic] = useOptimistic<ReadonlyMap<string, boolean>, OptimisticRow>(
    new Map(),
    (previous, next) => new Map(previous).set(next.id, next.done)
  );
  const [, startTransition] = useTransition();

  const withOptimistic = (row: BoardTaskRow): BoardTaskRow => {
    const override = optimistic.get(row.id);
    return override === undefined || override === row.done ? row : { ...row, done: override };
  };

  const toggleTask = (row: BoardTaskRow, origin: Origin) => {
    if (!board.canCompleteTasks) return;
    const next = !row.done;

    startTransition(async () => {
      setOptimistic({ id: row.id, done: next });
      // Only completing fires the celebration — undoing a tick is a parent's
      // correction, not a moment for confetti.
      if (next) fireConfettiBurst({ intensity: 'gentle', origin });
      await toggleTaskAction({ taskId: row.id, completed: next });
      router.refresh();
    });
  };

  /** Plain client state — no `useOptimistic` here, nothing awaits a server round trip. */
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());

  const filterMembers: MemberFilterEntry[] = board.columns.map((column) => ({
    id: column.memberId,
    displayName: column.displayName,
    avatarUrl: column.avatarUrl,
    surfaceClass: column.colorClasses.surface,
  }));

  const visibleColumns =
    selectedIds.size === 0
      ? board.columns
      : board.columns.filter((column) => selectedIds.has(column.memberId));

  return (
    <div data-testid="routines-board" className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-shrink-0 items-center gap-5 border-b border-line-subtle pb-4">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-extrabold tracking-tight">{t('board.title')}</h1>
          <span className="mt-0.5 block text-body-sm text-ink-secondary">
            {formatDateTime(board.now, { dateStyle: 'full' })}
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

        <TodayClock now={board.now} timeZone={board.timeZone} dayKey={dayKey} variant="hub" />
      </header>

      <div className="flex min-h-0 flex-1 gap-3.5 overflow-x-auto [scrollbar-color:var(--line-subtle)_transparent] [scrollbar-width:thin]">
        <PoolColumn
          pool={board.pool.map(withOptimistic)}
          onToggle={toggleTask}
          canComplete={board.canCompleteTasks}
        />

        {visibleColumns.map((column) => (
          <MemberColumn
            key={column.memberId}
            column={column}
            daypart={daypart}
            resolveRow={withOptimistic}
            onToggle={toggleTask}
            canCompleteTasks={board.canCompleteTasks}
          />
        ))}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2.5 pt-1">
        <Icon name="swipe" size="sm" className="text-ink-muted" />
        <span className="text-body-sm text-ink-muted">{t('board.footerHint')}</span>
      </div>
    </div>
  );
}

function PoolColumn({
  pool,
  onToggle,
  canComplete,
}: {
  pool: BoardTaskRow[];
  onToggle: (row: BoardTaskRow, origin: Origin) => void;
  canComplete: boolean;
}) {
  const t = useTranslations('today');

  return (
    <div
      data-testid="routines-board-pool"
      className="flex flex-[0_0_280px] min-w-[280px] flex-col overflow-hidden rounded-2xl border-2 border-dashed border-primary/35 bg-card"
    >
      <div className="flex-shrink-0 px-3.5 pt-3.5 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Icon name="waving_hand" size="sm" className="text-primary" />
          </span>
          <span className="font-display text-h3 leading-tight font-extrabold">
            {t('board.pool.title')}
          </span>
        </div>
        <span className="mt-2 block text-caption text-ink-secondary">
          {t('board.pool.subtitle')}
        </span>
      </div>

      <div className="noscroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2.5">
        {pool.length === 0 ? (
          <p className="px-2 py-2 text-body-sm text-ink-muted">{t('board.pool.empty')}</p>
        ) : (
          pool.map((row) => (
            <BoardRowView key={row.id} row={row} canComplete={canComplete} onToggle={onToggle} />
          ))
        )}
      </div>
    </div>
  );
}

function RoutineProgressCard({
  column,
  daypart,
}: {
  column: BoardColumn;
  daypart: TimeSection;
}) {
  const t = useTranslations('today');
  const routines = column.sections[daypart];

  if (routines.length === 0) return null;

  const progress = columnProgress(routines);
  const colors = column.colorClasses;

  return (
    <Link
      href={`/hub/routines/${column.memberId}`}
      data-testid="routine-progress-card"
      className={cn(
        'mx-1.5 mt-3 mb-1 block min-h-12 rounded-lg p-3 transition-colors duration-200 ease-brand',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        progress.celebrate ? 'bg-success/10' : colors.surface
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex size-[34px] shrink-0 items-center justify-center rounded-lg',
            colors.surface
          )}
        >
          <Icon name={DAYPART_ICON[daypart]} size="sm" className={colors.ink} />
        </span>

        <div className="min-w-0 flex-1">
          <span className="block font-display text-body-sm leading-tight font-extrabold">
            {t(`board.routineCard.title.${daypart}`)}
          </span>
          <span className="tnum block text-caption text-ink-secondary">
            {t('board.routineCard.meta', { done: progress.doneCount, total: progress.total })}
          </span>
        </div>

        <Icon name="chevron_right" size="sm" className="shrink-0 text-ink-muted" />
      </div>

      {/* No `label`: the meta line above already gives the "X van Y" number
          the doc comment on `ProgressBar` reserves `label` for. */}
      <ProgressBar
        value={progress.percent}
        size="sm"
        className="mt-2.5"
        fillClassName={colors.fill}
      />
    </Link>
  );
}

function MemberColumn({
  column,
  daypart,
  resolveRow,
  onToggle,
  canCompleteTasks,
}: {
  column: BoardColumn;
  daypart: TimeSection;
  resolveRow: (row: BoardTaskRow) => BoardTaskRow;
  onToggle: (row: BoardTaskRow, origin: Origin) => void;
  canCompleteTasks: boolean;
}) {
  const t = useTranslations('today');

  const routines = column.sections[daypart];
  const tasks = column.tasks.map(resolveRow);
  // Tasks only (2026-09-14 plan, M1+M2): the header count, bar and celebrate
  // treatment all read from what a member can actually pick up and finish
  // here — a routine step is finished on its own page now, not on this
  // board, so it no longer counts toward this column's "done", and tasks pay
  // no stars, so this column has none left to total.
  const progress = columnProgress(tasks);

  const colors = column.colorClasses;
  const celebrate = progress.celebrate;

  // Fires the bigger, once-only celebration on the transition into 100% of
  // this column's tasks — never on mount (a page loaded already-celebrating
  // is not "just now"), and never again on a plain refresh that leaves
  // `celebrate` unchanged (`<TodayLive />` calls `router.refresh()` on every
  // push, which must not replay this).
  const wasCelebrating = useRef(celebrate);
  useEffect(() => {
    if (celebrate && !wasCelebrating.current) {
      fireConfettiBurst({ intensity: 'big' });
    }
    wasCelebrating.current = celebrate;
  }, [celebrate]);

  return (
    <div
      data-testid="routines-board-column"
      data-member-id={column.memberId}
      data-celebrate={celebrate}
      className={cn(
        'flex min-w-[340px] flex-[0_0_calc(33.333%-10px)] flex-col overflow-hidden rounded-2xl border border-line-subtle',
        celebrate ? 'bg-gradient-to-b from-gold/12 to-card' : 'bg-card'
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 border-b-[3px] px-3.5 pt-3.5 pb-3',
          celebrate ? 'border-gold' : colors.border
        )}
      >
        <div className="flex items-center gap-2.5">
          <MemberFace
            name={column.displayName}
            avatarUrl={column.avatarUrl}
            surfaceClass={colors.surface}
            ringClass={celebrate ? 'ring-gold' : colors.ring}
            ringed
            size="default"
          />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-display text-h3 font-extrabold">
              {column.displayName}
            </span>
            <span className="block truncate text-caption text-ink-secondary">
              {t(`board.role.${column.role}`)}
            </span>
          </div>

          {celebrate ? (
            <span className="flex shrink-0 items-center gap-1 rounded-4xl bg-gold/18 px-2.5 py-1 text-caption font-bold text-gold-ink">
              <Icon name="celebration" size="xs+" filled />
              {t('board.celebrateBadge')}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="tnum text-caption font-bold text-ink-secondary">
            {t('board.countLabel', { done: progress.doneCount, total: progress.total })}
          </span>
          <span className="flex-1" />
        </div>

        <ProgressBar
          value={progress.percent}
          size="sm"
          className="mt-2"
          fillClassName={celebrate ? 'bg-gold' : colors.dot}
          shimmer={celebrate}
          label={t('board.progressLabel', { name: column.displayName })}
        />

        {celebrate ? (
          <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold/16 to-gold/5 px-2.5 py-1.5">
            <Icon name="emoji_events" size="sm" filled className="text-gold-ink" />
            <span className="tnum text-caption font-bold text-gold-ink">
              {t('board.allDone')}
            </span>
          </div>
        ) : null}
      </div>

      <div className="noscroll flex min-h-0 flex-1 flex-col overflow-y-auto pb-2.5">
        <RoutineProgressCard column={column} daypart={daypart} />

        <div className="px-2">
          {tasks.length > 0 ? (
            <div className="flex items-center gap-1.5 px-1.5 pt-3.5 pb-1.5">
              <Icon name="task_alt" size="sm" className="text-ink-muted" />
              <span className="text-overline text-ink-muted uppercase">
                {t('board.section.tasks')}
              </span>
            </div>
          ) : null}

          {tasks.map((row) => (
            <BoardRowView
              key={row.id}
              row={row}
              canComplete={canCompleteTasks}
              onToggle={onToggle}
            />
          ))}

          {routines.length === 0 && tasks.length === 0 ? (
            <p className="px-2 py-3 text-body-sm text-ink-muted">{t('board.columnEmpty')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BoardRowView({
  row,
  canComplete,
  onToggle,
}: {
  row: BoardTaskRow;
  canComplete: boolean;
  onToggle: (row: BoardTaskRow, origin: Origin) => void;
}) {
  const t = useTranslations('today');
  const done = row.done;

  const tap = (event: MouseEvent<HTMLButtonElement>) => {
    if (!canComplete) return;
    onToggle(row, boundingOrigin(event.currentTarget));
  };

  return (
    <button
      type="button"
      data-testid="routine-board-task"
      data-state={done ? 'done' : 'open'}
      aria-pressed={done}
      aria-label={t(done ? 'board.row.undo' : 'board.row.complete', { title: row.title })}
      disabled={!canComplete}
      onClick={tap}
      className={cn(
        'mb-0.5 flex min-h-16 items-center gap-1.5 rounded-lg px-1.5 py-2 text-left transition-colors duration-200 ease-brand',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        done ? 'bg-ink/[0.035]' : 'bg-transparent hover:bg-surface-container'
      )}
    >
      <span
        className={cn(
          'flex size-[30px] shrink-0 items-center justify-center rounded-lg',
          done ? 'bg-surface-container text-ink-muted opacity-70' : row.accentClass
        )}
      >
        <Icon name={row.icon} size="sm" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'min-w-0 text-body-sm font-semibold text-wrap-pretty',
            done ? 'text-ink-muted line-through decoration-ink-muted/50' : 'text-ink'
          )}
        >
          {row.title}
        </span>
      </span>

      <span
        aria-hidden
        className={cn(
          'flex size-[46px] shrink-0 items-center justify-center rounded-full',
          done ? 'bg-success' : 'border-2 border-line-subtle bg-surface-container-lowest'
        )}
      >
        {done ? (
          <Icon name="check" size="xl" filled className="text-white kynite-anim-check" />
        ) : null}
      </span>
    </button>
  );
}
