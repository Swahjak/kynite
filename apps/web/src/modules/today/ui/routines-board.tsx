'use client';

import { useMemo, useOptimistic, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Icon,
  MemberFace,
  PillTabs,
  ProgressBar,
  StarCount,
  cn,
  type IconName,
  type PillTabItem,
} from '@kynite/ui';
import { useDateTimeFormat } from '@/components/formatting';
import { useRouter } from '@/i18n/navigation';
import type { CompleteStepInput, CompletionState } from '@/modules/routines';
import type { ActionState, ToggleTaskInput } from '@/modules/tasks';
import { columnProgress, daypartFromHour, type TimeSection } from '../domain/routines-board';
import type { BoardColumn, BoardRow, RoutinesBoardData } from '../page-data-board';
import { TodayClock } from './today-clock';

/**
 * The family-wide "Taken & routines" board (`(hub)/hub/routines`, M-R2).
 *
 * One pool column for tasks nobody has picked up yet, one column per family
 * member — routines banded by the daypart currently selected, tasks always
 * underneath. This replaces the M-R1 check-in (`TodayTabRoutines`), which
 * only ever drew a read-out of the kids' step counts; this is the control
 * surface itself; a tap here is the same `completeStepAction` /
 * `toggleTaskAction` write the child's own board and the phone's Takenlijst
 * already use, so a step ticked here is the same step, on the same ledger.
 *
 * **Routine rows are forward-only.** A done step is not re-tappable here —
 * the same rule the child's own hub board follows
 * (`modules/routines/ui/routine-board.tsx`): undoing a completion is
 * documented as "the parent's correction path" with no affordance on a device
 * principal (`modules/routines/actions.ts`'s `undoCompletionAction`), and this
 * board renders under exactly that principal. **Task rows toggle both ways**,
 * matching `TaskList` — a task's `completed` state has always been a target
 * value, not a one-way flag.
 *
 * Optimism is a local `Set` of ids folded over the server data, the same
 * shape `TaskList` uses, followed by `router.refresh()` — not the child
 * board's full offline outbox (`useCompletionOutbox`), which exists for a
 * *child's own hands* on a tap that must never visibly roll back. A parent
 * correcting a shared household board a few steps away from the router does
 * not need that guarantee, and `<TodayLive />` (mounted once, by the page)
 * already keeps every device's board current over SSE.
 *
 * This component runs in the browser, so it may import neither the routines
 * slice's nor the tasks slice's nor the family slice's value exports — every
 * slice barrel re-exports `server-only` reads alongside its client-safe
 * pieces (`@/modules/routines`'s and `@/modules/tasks`'s own module doc), and
 * a value import drags that into the client bundle even when only one named
 * export is used. `completeStepAction` and `toggleTaskAction` therefore
 * arrive as props, passed by reference from the server route
 * (`(hub)/hub/routines/page.tsx`) exactly as `TodayTabSterren` hands
 * `completeStepAction` / `undoCompletionAction` to `StarMatrix`; member
 * colour classes and routine icon tiles arrive pre-resolved on `board` itself
 * (`colorClasses` on `BoardColumn`, `accentClass` on every row) rather than
 * being looked up here from `MEMBER_COLOR_CLASSES` / `ROUTINE_ICON_TILE`.
 */

const DAYPART_ICON: Record<TimeSection, IconName> = {
  morning: 'wb_twilight',
  afternoon: 'wb_sunny',
  evening: 'bedtime',
};

/**
 * Tasks carry no icon of their own (`modules/tasks/schema.ts`'s header: "a
 * task has no steps, no stars, no schedule" — deliberately lighter than a
 * routine), so every task row wears one fixed icon. Its tile colour is
 * `accentClass` on the row itself (`BoardTaskRow`), resolved server-side —
 * see the module note above on why this file cannot look it up from
 * `ROUTINE_ICON_TILE` directly.
 */
const TASK_ROW_ICON: IconName = 'task_alt';

type OptimisticRow = { id: string; done: boolean };

function toggleKey(row: BoardRow): string {
  return row.kind === 'task' ? `task:${row.id}` : `step:${row.id}`;
}

export type RoutinesBoardProps = {
  board: RoutinesBoardData;
  /** Household-local `YYYY-MM-DD` — feeds `TodayClock`'s midnight refresh. */
  dayKey: string;
  /** `completeStepAction` from the routines slice, passed by reference. */
  completeStepAction: (input: CompleteStepInput) => Promise<CompletionState>;
  /** `toggleTaskAction` from the tasks slice, likewise. */
  toggleTaskAction: (input: ToggleTaskInput) => Promise<ActionState>;
};

export function RoutinesBoard({
  board,
  dayKey,
  completeStepAction,
  toggleTaskAction,
}: RoutinesBoardProps) {
  const t = useTranslations('today');
  const formatDateTime = useDateTimeFormat();
  const router = useRouter();

  const [daypart, setDaypart] = useState<TimeSection>(() => {
    const hour = new Date(board.now).getHours();
    return daypartFromHour(hour);
  });

  const [optimistic, setOptimistic] = useOptimistic<ReadonlyMap<string, boolean>, OptimisticRow>(
    new Map(),
    (previous, next) => new Map(previous).set(next.id, next.done)
  );
  const [, startTransition] = useTransition();

  const withOptimistic = (row: BoardRow): BoardRow => {
    const override = optimistic.get(toggleKey(row));
    return override === undefined || override === row.done ? row : { ...row, done: override };
  };

  const completeStep = (row: Extract<BoardRow, { kind: 'routine' }>) => {
    if (row.done || !board.canCompleteRoutines) return;
    const key = toggleKey(row);

    startTransition(async () => {
      setOptimistic({ id: key, done: true });
      await completeStepAction({
        routineId: row.routineId,
        routineStepId: row.routineStepId,
        memberId: row.memberId,
        occurrenceDate: row.occurrenceDate,
        clientId: row.clientId,
        source: 'hub',
      });
      router.refresh();
    });
  };

  const toggleTask = (row: Extract<BoardRow, { kind: 'task' }>) => {
    if (!board.canCompleteTasks) return;
    const key = toggleKey(row);
    const next = !row.done;

    startTransition(async () => {
      setOptimistic({ id: key, done: next });
      await toggleTaskAction({ taskId: row.id, completed: next });
      router.refresh();
    });
  };

  const toggle = (row: BoardRow) => {
    if (row.kind === 'task') toggleTask(row);
    else completeStep(row);
  };

  const daypartItems: PillTabItem<TimeSection>[] = (
    ['morning', 'afternoon', 'evening'] as const
  ).map((section) => ({
    value: section,
    label: t(`board.daypart.${section}`),
    icon: DAYPART_ICON[section],
  }));

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

        <PillTabs
          items={daypartItems}
          value={daypart}
          onValueChange={setDaypart}
          label={t('board.daypart.label')}
          className="w-auto gap-0"
          listClassName="w-auto"
        />

        <TodayClock now={board.now} timeZone={board.timeZone} dayKey={dayKey} variant="hub" />
      </header>

      <div className="noscroll flex min-h-0 flex-1 gap-2.5 overflow-x-auto">
        <PoolColumn
          pool={board.pool.map(withOptimistic)}
          onToggle={toggle}
          canComplete={board.canCompleteTasks}
        />

        {board.columns.map((column) => (
          <MemberColumn
            key={column.memberId}
            column={column}
            daypart={daypart}
            resolveRow={withOptimistic}
            onToggle={toggle}
            canCompleteRoutines={board.canCompleteRoutines}
            canCompleteTasks={board.canCompleteTasks}
          />
        ))}
      </div>
    </div>
  );
}

function PoolColumn({
  pool,
  onToggle,
  canComplete,
}: {
  pool: BoardRow[];
  onToggle: (row: BoardRow) => void;
  canComplete: boolean;
}) {
  const t = useTranslations('today');

  return (
    <div
      data-testid="routines-board-pool"
      className="flex w-60 shrink-0 flex-col overflow-hidden rounded-2xl border-2 border-dashed border-primary/35 bg-card"
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

function MemberColumn({
  column,
  daypart,
  resolveRow,
  onToggle,
  canCompleteRoutines,
  canCompleteTasks,
}: {
  column: BoardColumn;
  daypart: TimeSection;
  resolveRow: (row: BoardRow) => BoardRow;
  onToggle: (row: BoardRow) => void;
  canCompleteRoutines: boolean;
  canCompleteTasks: boolean;
}) {
  const t = useTranslations('today');

  const routines = column.sections[daypart].map(resolveRow);
  const tasks = column.tasks.map(resolveRow);
  const progress = useMemo(() => columnProgress([...routines, ...tasks]), [routines, tasks]);

  const colors = column.colorClasses;
  const celebrate = progress.celebrate;
  const starTotal = [...routines, ...tasks]
    .filter((row) => row.done && row.kind === 'routine')
    .reduce((sum, row) => sum + (row.kind === 'routine' ? row.stars : 0), 0);

  return (
    <div
      data-testid="routines-board-column"
      data-member-id={column.memberId}
      data-celebrate={celebrate}
      className={cn(
        'flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line-subtle',
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
          {starTotal > 0 ? (
            <StarCount
              value={starTotal}
              srLabel={t('board.starTotalLabel', { count: starTotal })}
              tone="bare"
              size="sm"
            />
          ) : null}
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
              {t('board.celebrateCard', { count: starTotal })}
            </span>
          </div>
        ) : null}
      </div>

      <div className="noscroll flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2.5">
        {routines.length > 0 ? (
          <div className="flex items-center gap-1.5 px-1.5 pt-3 pb-1.5">
            <Icon name={DAYPART_ICON[daypart]} size="sm" className="text-ink-muted" />
            <span className="text-overline text-ink-muted uppercase">
              {t(`board.daypart.${daypart}`)}
            </span>
          </div>
        ) : null}

        {routines.map((row) => (
          <BoardRowView
            key={row.id}
            row={row}
            canComplete={canCompleteRoutines}
            onToggle={onToggle}
          />
        ))}

        {tasks.length > 0 ? (
          <div className="flex items-center gap-1.5 px-1.5 pt-3.5 pb-1.5">
            <Icon name="task_alt" size="sm" className="text-ink-muted" />
            <span className="text-overline text-ink-muted uppercase">
              {t('board.section.tasks')}
            </span>
          </div>
        ) : null}

        {tasks.map((row) => (
          <BoardRowView key={row.id} row={row} canComplete={canCompleteTasks} onToggle={onToggle} />
        ))}

        {routines.length === 0 && tasks.length === 0 ? (
          <p className="px-2 py-3 text-body-sm text-ink-muted">{t('board.columnEmpty')}</p>
        ) : null}
      </div>
    </div>
  );
}

function BoardRowView({
  row,
  canComplete,
  onToggle,
}: {
  row: BoardRow;
  canComplete: boolean;
  onToggle: (row: BoardRow) => void;
}) {
  const t = useTranslations('today');
  const done = row.done;
  // A done routine step is not re-tappable here (see the module doc); a task
  // stays interactive either way, matching `TaskList`.
  const interactive = canComplete && (row.kind === 'task' || !done);
  const icon: IconName = row.kind === 'routine' ? row.icon : TASK_ROW_ICON;
  const stars = row.kind === 'routine' ? row.stars : 0;

  return (
    <button
      type="button"
      data-testid={row.kind === 'routine' ? 'routine-board-step' : 'routine-board-task'}
      data-state={done ? 'done' : 'open'}
      aria-pressed={done}
      aria-label={t(done ? 'board.row.undo' : 'board.row.complete', { title: row.title })}
      disabled={!interactive}
      onClick={() => onToggle(row)}
      className={cn(
        'mb-0.5 flex min-h-16 items-center gap-1.5 rounded-lg px-1.5 py-2 text-left transition-colors duration-200 ease-brand',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        done ? 'bg-ink/[0.035]' : 'bg-transparent hover:bg-surface-container',
        !interactive && done && row.kind === 'routine' && 'cursor-default hover:bg-transparent'
      )}
    >
      <span
        className={cn(
          'flex size-[30px] shrink-0 items-center justify-center rounded-lg',
          done ? 'bg-surface-container text-ink-muted opacity-70' : row.accentClass
        )}
      >
        <Icon name={icon} size="sm" />
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
        {stars > 0 ? (
          <StarCount
            value={stars}
            srLabel={t('board.starTotalLabel', { count: stars })}
            tone="bare"
            size="sm"
          />
        ) : null}
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
