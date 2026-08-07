import 'server-only';
import {
  can,
  getFamily,
  getMember,
  getPrincipal,
  listMembers,
  type Member,
} from '@/modules/family';
import {
  TIME_SECTIONS,
  instantAt,
  sectionOf,
  timingAt,
  type RoutineState,
  type TimeSection,
} from './domain/occurrence';
import {
  completionSeed,
  praiseKeyFor,
  routineDoneKeyFor,
  type PraiseKey,
  type RoutineDoneKey,
} from './domain/praise';
import { completionRatio } from './domain/steps';
import { hasGraduated, starsFor } from './domain/stars';
import {
  listCompletedSteps,
  listCompletionsOn,
  listRoutines,
  type RoutineWithSteps,
} from './queries';
import { routineIconOf, type RoutineIcon } from './ui/tokens';

/**
 * The two server-side reads the routine surfaces compose (architecture §2 rule
 * 4: route files hold no logic).
 *
 * `loadRoutinesPage` feeds the parent builder. `loadMemberRoutines` assembles
 * the child-facing hub board — and it is the only place the board's shape is
 * decided, so "which routine is expanded", "what counts as done" and "what the
 * praise line says" cannot drift between components.
 */

export type RoutinesPageData = {
  familyId: string;
  members: Member[];
  routines: RoutineWithSteps[];
  timeZone: string;
  canWrite: boolean;
};

export async function loadRoutinesPage(): Promise<RoutinesPageData | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  const [family, members, routines] = await Promise.all([
    getFamily(principal.familyId),
    listMembers(principal.familyId),
    listRoutines(principal.familyId),
  ]);

  return {
    familyId: principal.familyId,
    members,
    routines,
    timeZone: family?.timezone ?? 'Europe/Amsterdam',
    canWrite: can(principal, 'routine:write', { familyId: principal.familyId }),
  };
}

export type BoardStep = {
  id: string;
  title: string;
  timerSeconds: number | null;
  done: boolean;
  /** The praise headline shown once this step is done. */
  praiseKey: PraiseKey;
  /** The idempotency key the tap will carry — derived, so a retry reuses it. */
  clientId: string;
};

export type BoardRoutine = {
  id: string;
  title: string;
  icon: RoutineIcon;
  memberId: string;
  section: TimeSection;
  state: RoutineState;
  occurrenceDate: string;
  /** Whole minutes until the routine is due; null once it is. */
  minutesUntil: number | null;
  steps: BoardStep[];
  doneCount: number;
  total: number;
  complete: boolean;
  ratio: number;
  /** Stars this routine pays per step — 0 once it has graduated. */
  starsPerCompletion: number;
  graduated: boolean;
  doneKey: RoutineDoneKey;
};

export type BoardSection = {
  section: TimeSection;
  routines: BoardRoutine[];
  doneCount: number;
  total: number;
  ratio: number;
};

export type RoutineBoard = {
  familyId: string;
  member: Member;
  sections: BoardSection[];
  /**
   * The one routine rendered expanded — the first that is actually actionable.
   * Everything else collapses, so the board stays glanceable from six feet
   * (research §"Ambient display retention") instead of becoming a wall of rows.
   */
  activeRoutineId: string | null;
  now: Date;
  timeZone: string;
};

export type BoardOptions = {
  memberId: string;
  /** `?date=YYYY-MM-DD` — pins the board's "now" so snapshots are deterministic. */
  date?: string;
  /** `?time=HH:mm` — the wall clock to pair with `date`. Display only. */
  time?: string;
};

/**
 * Resolve the instant the board renders as "now".
 *
 * The query parameters exist for the same reason `(app)/calendar`'s `?date=`
 * does: a screenshot of a live clock is not a regression test. They affect
 * *rendering only* — `completeStepAction` reads the real clock server-side, so
 * a pinned board cannot be used to write a completion for another day.
 */
function resolveNow(options: { date?: string; time?: string }, timeZone: string): Date {
  const pinned = options.date ? instantAt(options.date, options.time, timeZone) : null;
  return pinned ?? new Date();
}

/** "3 of 7 done", for one member, on the day the board is rendering. */
export type RoutineTotals = { done: number; total: number };

/**
 * Today's step totals for **every** member of the family, in one query set.
 *
 * The hub board draws one launcher tile per child, each with a step count. It
 * used to get them by calling `loadMemberRoutines` once per child — which is
 * `getPrincipal` + `getMember` + `getFamily` + `listRoutines` + a completion
 * lookup *per child*, assembling four board sections and a praise key per step
 * to read two integers off the end. On a wall display that re-renders on every
 * SSE event, with four children, that is an N+1 firing all evening.
 *
 * This is the same question asked once, following `listCompletionsOn`'s
 * family-scan pattern (`queries.ts`, and `modules/today/page-data.ts` which
 * does the same for the "Kids' Progress" panel): all active routines for the
 * family, all completions on the occurrence dates they open, grouped in
 * JavaScript. Members are not filtered — a family has a handful, and the caller
 * decides which of them it draws.
 *
 * Null only when there is no principal. A member with nothing scheduled today
 * is present with `{ done: 0, total: 0 }`, because "nothing today" is a thing
 * the launcher says rather than a member it omits.
 */
export async function loadFamilyRoutineTotals(
  options: { date?: string; time?: string } = {}
): Promise<Map<string, RoutineTotals> | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  const [family, members, routines] = await Promise.all([
    getFamily(principal.familyId),
    listMembers(principal.familyId),
    listRoutines(principal.familyId, { activeOnly: true }),
  ]);

  const timeZone = family?.timezone ?? 'Europe/Amsterdam';
  const now = resolveNow(options, timeZone);

  // Same rule as the single-member board: a routine with no open occurrence is
  // not due today and does not count towards anyone's total.
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

  const totals = new Map<string, RoutineTotals>(
    members.map((member) => [member.id, { done: 0, total: 0 }])
  );

  for (const { row, occurrence } of open) {
    const bucket = totals.get(row.ownerMemberId);
    if (!bucket) continue;

    for (const step of row.steps) {
      bucket.total += 1;
      if (done.has(`${row.ownerMemberId}:${step.id}:${occurrence.occurrenceDate}`)) {
        bucket.done += 1;
      }
    }
  }

  return totals;
}

/** Null when there is no principal, or the member is not in this family. */
export async function loadMemberRoutines(options: BoardOptions): Promise<RoutineBoard | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  const member = await getMember(principal.familyId, options.memberId);
  if (!member) return null;

  const family = await getFamily(principal.familyId);
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';
  const now = resolveNow(options, timeZone);

  const routines = await listRoutines(principal.familyId, {
    ownerMemberId: member.id,
    activeOnly: true,
  });

  // Timing first: it decides both which routines appear at all and which
  // occurrence dates the completion lookup has to cover.
  const timed = routines.flatMap((row) => {
    const timing = timingAt({ schedule: row.schedule, anchor: row.createdAt, timeZone }, now);
    // `none` means the routine is not due today and has no open grace day. It
    // is absent from the board — not marked, not greyed out with a cross.
    return timing.occurrence ? [{ row, timing, occurrence: timing.occurrence }] : [];
  });

  const completed = await listCompletedSteps({
    familyId: principal.familyId,
    memberId: member.id,
    occurrenceDates: [...new Set(timed.map(({ occurrence }) => occurrence.occurrenceDate))],
  });

  const doneKeys = new Set(
    completed.map((entry) => `${entry.routineStepId}:${entry.occurrenceDate}`)
  );

  const board: BoardRoutine[] = timed.map(({ row, timing, occurrence }) => {
    const steps: BoardStep[] = row.steps.map((step) => ({
      id: step.id,
      title: step.title,
      timerSeconds: step.timerSeconds,
      done: doneKeys.has(`${step.id}:${occurrence.occurrenceDate}`),
      praiseKey: praiseKeyFor(
        completionSeed({
          memberId: member.id,
          routineStepId: step.id,
          occurrenceDate: occurrence.occurrenceDate,
        })
      ),
      clientId: completionSeed({
        memberId: member.id,
        routineStepId: step.id,
        occurrenceDate: occurrence.occurrenceDate,
      }),
    }));

    const doneCount = steps.filter((step) => step.done).length;

    return {
      id: row.id,
      title: row.title,
      icon: routineIconOf(row.icon),
      memberId: member.id,
      section: sectionOf(row.schedule),
      state: timing.state,
      occurrenceDate: occurrence.occurrenceDate,
      minutesUntil: timing.minutesUntil,
      steps,
      doneCount,
      total: steps.length,
      complete: steps.length > 0 && doneCount === steps.length,
      ratio: completionRatio(steps.length, doneCount),
      starsPerCompletion: starsFor(row),
      graduated: hasGraduated(row),
      doneKey: routineDoneKeyFor(`${row.id}:${occurrence.occurrenceDate}`),
    };
  });

  const sections: BoardSection[] = TIME_SECTIONS.map((section) => {
    const inSection = board.filter((entry) => entry.section === section);

    const total = inSection.reduce((sum, entry) => sum + entry.total, 0);
    const doneCount = inSection.reduce((sum, entry) => sum + entry.doneCount, 0);

    return {
      section,
      routines: inSection,
      doneCount,
      total,
      ratio: completionRatio(total, doneCount),
    };
  });

  // The expanded routine: the first unfinished one that is actually live.
  // A routine still ahead of its time, or one already done, does not steal the
  // expansion from the thing the child is meant to be doing right now.
  const active =
    board.find((entry) => !entry.complete && (entry.state === 'due' || entry.state === 'grace')) ??
    board.find((entry) => !entry.complete) ??
    null;

  return {
    familyId: principal.familyId,
    member,
    sections,
    activeRoutineId: active?.id ?? null,
    now,
    timeZone,
  };
}
