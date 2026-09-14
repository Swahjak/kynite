import 'server-only';
import { startOfDay } from '@/modules/calendar';
import {
  MEMBER_COLOR_CLASSES,
  can,
  getFamily,
  getPrincipal,
  listMembers,
  type Member,
} from '@/modules/family';
import {
  ROUTINE_ICON_TILE,
  completionSeed,
  listCompletionsOn,
  listRoutines,
  routineIconOf,
  sectionOf,
  starsFor,
  suggestIcon,
  timingAt,
  todayKeyIn,
  type RoutineIcon,
  type TimeSection,
} from '@/modules/routines';
import { listTodayTasks, type Task } from '@/modules/tasks';
import { partitionTasksByAssignee } from './domain/routines-board';

/**
 * The read behind the family-wide "Taken" board
 * (`(hub)/hub/taken`, moved here from `/hub/routines` by the 2026-09-14
 * taken-board-routines-page plan's M1+M2) — every member's routines *and*
 * tasks in one composition, unlike `loadTodayProgress` (children only,
 * routines only) and
 * `loadTodayTasks` (the household's flat list). This is the union the board
 * actually draws: one column per member, routines banded by
 * `sectionOf` and tasks always visible under them, plus the pool of tasks
 * nobody has picked up yet.
 *
 * Route files hold no logic (architecture §2 rule 4), so — like every other
 * page-data loader in this slice — this resolves its own principal rather
 * than trusting one passed in.
 */

export type BoardTaskRow = {
  kind: 'task';
  id: string;
  title: string;
  done: boolean;
  /**
   * The tile a task row's icon sits on — `ROUTINE_ICON_TILE.task_alt`,
   * resolved here rather than in the client board. `RoutinesBoard` runs in
   * the browser and may not import the routines slice's value exports (its
   * barrel carries `server-only` reads alongside them); see the note on
   * `RoutinesBoard` itself.
   */
  accentClass: string;
};

export type BoardRoutineRow = {
  kind: 'routine';
  /** The step id — a routine board row is one step, never a whole routine. */
  id: string;
  title: string;
  icon: RoutineIcon;
  /** `ROUTINE_ICON_TILE[icon]` — resolved here for the same reason as above. */
  accentClass: string;
  /** Stars this step pays, per the routine's own economy — 0 once graduated. */
  stars: number;
  done: boolean;
  routineId: string;
  routineStepId: string;
  memberId: string;
  occurrenceDate: string;
  /** The idempotency key `completeStepAction` expects. */
  clientId: string;
};

export type BoardRow = BoardTaskRow | BoardRoutineRow;

export type BoardColumn = {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  /**
   * `MEMBER_COLOR_CLASSES[member.color]`, resolved here — the client board
   * may not import the family slice's value exports any more than the
   * routines slice's, for the same `server-only`-barrel reason.
   */
  colorClasses: { dot: string; surface: string; ring: string; border: string; ink: string; fill: string };
  role: Member['role'];
  /** Routine steps due today (plus any open grace day), banded by daypart. */
  sections: Record<TimeSection, BoardRoutineRow[]>;
  /** This member's tasks — always visible, whatever daypart is selected. */
  tasks: BoardTaskRow[];
};

export type RoutinesBoardData = {
  timeZone: string;
  now: Date;
  columns: BoardColumn[];
  /** Tasks nobody has picked up yet — `task.assigneeMemberId === null`. */
  pool: BoardTaskRow[];
  /** `completion:write` for this principal — gates tapping a routine step. */
  canCompleteRoutines: boolean;
  /** `task:complete` for this principal — gates tapping a task row. */
  canCompleteTasks: boolean;
};

const EMPTY_SECTIONS = (): Record<TimeSection, BoardRoutineRow[]> => ({
  morning: [],
  afternoon: [],
  evening: [],
});

/** Null when there is no principal — the caller has already redirected. */
export async function loadRoutinesBoardData(
  options: { now?: Date } = {}
): Promise<RoutinesBoardData | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  const family = await getFamily(principal.familyId);
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';
  const now = options.now ?? new Date();

  const [members, routines, tasks] = await Promise.all([
    listMembers(principal.familyId),
    listRoutines(principal.familyId, { activeOnly: true }),
    listTodayTasks({
      familyId: principal.familyId,
      todayKey: todayKeyIn(timeZone, now),
      since: startOfDay(now, timeZone),
    }),
  ]);

  // Which routines are actually open today, and for whom — the same
  // `timingAt` definition every other routine surface uses, so this board and
  // the child's own hub board can never disagree about what "today" contains.
  const open = routines.flatMap((row) => {
    const timing = timingAt({ schedule: row.schedule, anchor: row.createdAt, timeZone }, now);
    return timing.occurrence ? [{ row, occurrence: timing.occurrence }] : [];
  });

  const completions = await listCompletionsOn({
    familyId: principal.familyId,
    occurrenceDates: [...new Set(open.map(({ occurrence }) => occurrence.occurrenceDate))],
  });

  const done = new Set(
    completions.map((entry) => `${entry.memberId}:${entry.routineStepId}:${entry.occurrenceDate}`)
  );

  const sectionsByMember = new Map<string, Record<TimeSection, BoardRoutineRow[]>>(
    members.map((member) => [member.id, EMPTY_SECTIONS()])
  );

  for (const { row, occurrence } of open) {
    const bucket = sectionsByMember.get(row.ownerMemberId);
    if (!bucket) continue;

    const section = sectionOf(row.schedule);
    const stars = starsFor(row);

    for (const step of row.steps) {
      const icon = routineIconOf(step.icon, step.title);
      bucket[section].push({
        kind: 'routine',
        id: step.id,
        title: step.title,
        icon,
        accentClass: ROUTINE_ICON_TILE[icon],
        stars,
        done: done.has(`${row.ownerMemberId}:${step.id}:${occurrence.occurrenceDate}`),
        routineId: row.id,
        routineStepId: step.id,
        memberId: row.ownerMemberId,
        occurrenceDate: occurrence.occurrenceDate,
        clientId: completionSeed({
          memberId: row.ownerMemberId,
          routineStepId: step.id,
          occurrenceDate: occurrence.occurrenceDate,
        }),
      });
    }
  }

  const boardTaskRow = (row: Task): BoardTaskRow => ({
    kind: 'task',
    id: row.id,
    title: row.title,
    done: row.completedAt !== null,
    accentClass: ROUTINE_ICON_TILE[suggestIcon(row.title)],
  });

  const { pool, byMember } = partitionTasksByAssignee(tasks);

  return {
    timeZone,
    now,
    // `listMembers` already orders by `sortOrder`; the columns inherit it.
    columns: members.map((member) => ({
      memberId: member.id,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      colorClasses: MEMBER_COLOR_CLASSES[member.color],
      role: member.role,
      sections: sectionsByMember.get(member.id) ?? EMPTY_SECTIONS(),
      tasks: (byMember.get(member.id) ?? []).map(boardTaskRow),
    })),
    pool: pool.map(boardTaskRow),
    canCompleteRoutines: can(principal, 'completion:write', { familyId: principal.familyId }),
    canCompleteTasks: can(principal, 'task:complete', { familyId: principal.familyId }),
  };
}
