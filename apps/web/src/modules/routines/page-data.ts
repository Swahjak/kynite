import 'server-only';
import {
  MEMBER_COLOR_CLASSES,
  can,
  getFamily,
  getMember,
  getPrincipal,
  initialsOf,
  listMembers,
  type Member,
} from '@/modules/family';
import {
  TIME_SECTIONS,
  instantAt,
  sectionOf,
  timingAt,
  wallClockOf,
  type OpenOccurrence,
  type RoutineState,
  type RoutineTiming,
  type TimeSection,
} from './domain/occurrence';
import {
  completionSeed,
  praiseKeyFor,
  routineDoneKeyFor,
  type PraiseKey,
  type RoutineDoneKey,
} from './domain/praise';
import {
  bandsOf,
  columnProgress,
  firstOpenRoutineId,
  starsEarnedIn,
  type ColumnBand,
  type ColumnProgress,
} from './domain/board-columns';
import { isOneOff } from './domain/schedule';
import { completionRatio } from './domain/steps';
import { hasGraduated, starsFor } from './domain/stars';
import {
  listCompletedSteps,
  listCompletionsOn,
  listRoutines,
  type RoutineWithSteps,
} from './queries';
import { ROUTINE_ICON_TILE, routineIconOf, type RoutineIcon } from './ui/tokens';

/**
 * The two server-side reads the routine surfaces compose (architecture §2 rule
 * 4: route files hold no logic).
 *
 * `loadRoutinesPage` feeds the parent builder. `loadMemberRoutines` assembles
 * the child-facing hub board — and it is the only place the board's shape is
 * decided, so "which routine is expanded", "what counts as done" and "what the
 * praise line says" cannot drift between components.
 */

/**
 * A candidate owner in the builder's "Voor wie" row.
 *
 * Face, name and colour resolved *here* rather than in the chip, for the same
 * reason `rewards`' `QueueMember` is: the builder is a `'use client'` module,
 * and importing `@/modules/family` from one pulls `principal.ts` and
 * `next/headers` into the browser bundle, where it does not merely bloat — it
 * fails to compile.
 *
 * Children lead. A routine belongs to whoever it is for and an adult may own
 * one, but the sheet's row is a row of kids and that is the overwhelming case;
 * ordering is the cheapest way to say so without removing the option.
 */
export type OwnerOption = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  colorClass: string;
};

export type RoutinesPageData = {
  familyId: string;
  members: Member[];
  owners: OwnerOption[];
  routines: RoutineWithSteps[];
  timeZone: string;
  canWrite: boolean;
};

export function ownerOptionsOf(members: Member[]): OwnerOption[] {
  return [...members]
    .sort((left, right) => Number(right.role === 'child') - Number(left.role === 'child'))
    .map((member) => ({
      id: member.id,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      initials: initialsOf(member.displayName),
      colorClass: MEMBER_COLOR_CLASSES[member.color].track,
    }));
}

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
    owners: ownerOptionsOf(members),
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
  /** The step's own icon, or `suggestIcon(title)` while nobody has picked one. */
  icon: RoutineIcon;
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
  /**
   * `HH:mm` in the family's zone. The countdown chip switches to an absolute
   * time once "over 11 uur" stops being a useful sentence about tonight
   * (`Routines.dc.html` r168: "om 19:30").
   */
  dueTime: string;
  steps: BoardStep[];
  doneCount: number;
  total: number;
  complete: boolean;
  ratio: number;
  /** M20: a one-off chore rather than a recurring routine. */
  oneOff: boolean;
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
  /**
   * `MEMBER_COLOR_CLASSES[member.color]`, resolved here — `RoutineBoard`
   * (`ui/routine-board.tsx`) is a client component and may not import the
   * family slice's value exports (U2).
   */
  colorClasses: (typeof MEMBER_COLOR_CLASSES)[Member['color']];
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

type TimedRoutine = {
  row: RoutineWithSteps;
  timing: RoutineTiming;
  occurrence: OpenOccurrence;
};

/**
 * One open occurrence → the board row every routine surface draws.
 *
 * Extracted from `loadMemberRoutines` when M3 added the family-wide page: the
 * two loaders ask the same question for one member and for every member, and
 * a second copy of this mapping is exactly how "what counts as done" and
 * "which praise line this step wears" would start to differ between a child's
 * own board and the wall's overview of the whole household.
 */
function toBoardRoutine({
  row,
  timing,
  occurrence,
  memberId,
  doneKeys,
  timeZone,
}: TimedRoutine & {
  memberId: string;
  /** `${stepId}:${occurrenceDate}` for every step this member has finished. */
  doneKeys: ReadonlySet<string>;
  timeZone: string;
}): BoardRoutine {
  const steps: BoardStep[] = row.steps.map((step) => ({
    id: step.id,
    title: step.title,
    timerSeconds: step.timerSeconds,
    done: doneKeys.has(`${step.id}:${occurrence.occurrenceDate}`),
    praiseKey: praiseKeyFor(
      completionSeed({
        memberId,
        routineStepId: step.id,
        occurrenceDate: occurrence.occurrenceDate,
      })
    ),
    clientId: completionSeed({
      memberId,
      routineStepId: step.id,
      occurrenceDate: occurrence.occurrenceDate,
    }),
    icon: routineIconOf(step.icon, step.title),
  }));

  const doneCount = steps.filter((step) => step.done).length;

  return {
    id: row.id,
    title: row.title,
    icon: routineIconOf(row.icon, row.title),
    memberId,
    section: sectionOf(row.schedule),
    state: timing.state,
    occurrenceDate: occurrence.occurrenceDate,
    minutesUntil: timing.minutesUntil,
    dueTime: wallClockOf(occurrence.startsAt, timeZone),
    steps,
    doneCount,
    total: steps.length,
    complete: steps.length > 0 && doneCount === steps.length,
    ratio: completionRatio(steps.length, doneCount),
    oneOff: isOneOff(row.schedule),
    starsPerCompletion: starsFor(row),
    graduated: hasGraduated(row),
    doneKey: routineDoneKeyFor(`${row.id}:${occurrence.occurrenceDate}`),
  };
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

  const board: BoardRoutine[] = timed.map((entry) =>
    toBoardRoutine({ ...entry, memberId: member.id, doneKeys, timeZone })
  );

  /**
   * A finished one-off is **done with**, not merely ticked (M20).
   *
   * A recurring routine that is complete stays on the board all day as a calm
   * collapsed success line, because it will be back tomorrow and its place in
   * the day is part of what the board teaches. A one-off has no tomorrow: once
   * the garage is clean, leaving "Garage opruimen ✓" pinned to the evening
   * band is clutter that only a parent can clear. So it leaves — and it leaves
   * the same way an out-of-window occurrence does, by absence. The celebration
   * has already fired on the device that tapped (`routine-board.tsx` keeps it
   * through the refresh), so nothing a child is watching is cut short.
   */
  const visible = board.filter((entry) => !(entry.oneOff && entry.complete));

  /**
   * The card leaves; the credit does not.
   *
   * Counting the finished one-off out of the band's *denominator* as well as
   * its numerator would make the counter shrink under the household: a band
   * that read "0 van 3" this morning reads "0 van 2" after the garage is done,
   * on every fresh load and on every other device. That is a board quietly
   * rewriting what it asked for, and it is the same dishonesty as a progress
   * bar that jumps back — the work happened, so it stays counted.
   *
   * So the band counts `board` while it renders `visible`: the finished one-off
   * lands in both `doneCount` and `total`, giving "3 van 3 klaar" above a band
   * that no longer shows the card. This is deliberately the same arithmetic
   * `loadFamilyRoutineTotals` does for the parent dashboard, so the two never
   * disagree about the same day.
   */
  const sections: BoardSection[] = TIME_SECTIONS.map((section) => {
    const counted = board.filter((entry) => entry.section === section);

    const total = counted.reduce((sum, entry) => sum + entry.total, 0);
    const doneCount = counted.reduce((sum, entry) => sum + entry.doneCount, 0);

    return {
      section,
      routines: visible.filter((entry) => entry.section === section),
      doneCount,
      total,
      ratio: completionRatio(total, doneCount),
    };
  });

  // The expanded routine: the first unfinished one that is actually live.
  // A routine still ahead of its time, or one already done, does not steal the
  // expansion from the thing the child is meant to be doing right now.
  const activeRoutineId = firstOpenRoutineId(visible);

  return {
    familyId: principal.familyId,
    member,
    sections,
    activeRoutineId,
    now,
    timeZone,
    colorClasses: MEMBER_COLOR_CLASSES[member.color],
  };
}

/* -------------------------------------------------------------------------- */
/* The family-wide "Actieve routines" page (`(hub)/hub/routines`, M3)          */
/* -------------------------------------------------------------------------- */

/**
 * A board routine with its icon tint already resolved.
 *
 * `ROUTINE_ICON_TILE` lives in the routines slice, and the page that draws
 * these columns runs in the browser — a client component may not import this
 * slice's value exports, because this barrel carries `server-only` reads
 * beside them. Same reason `page-data-board.ts` resolves `accentClass` server
 * side for the taken board.
 */
export type FamilyBoardRoutine = BoardRoutine & { tileClass: string };

/** One member's column on the family-wide routines page. */
export type FamilyRoutineColumn = {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  role: Member['role'];
  /** `MEMBER_COLOR_CLASSES[member.color]` — resolved here, see above. */
  colorClasses: (typeof MEMBER_COLOR_CLASSES)[Member['color']];
  /** Dayparts this member actually has something in; empty bands are dropped. */
  bands: ColumnBand<FamilyBoardRoutine>[];
  /** The one card this column opens with — see `firstOpenRoutineId`. */
  activeRoutineId: string | null;
  progress: ColumnProgress;
  /** Stars earned today, per completed *step*. */
  starsEarned: number;
};

export type FamilyRoutinesData = {
  familyId: string;
  columns: FamilyRoutineColumn[];
  now: Date;
  timeZone: string;
  /** `completion:write` for this principal — gates tapping a step at all. */
  canComplete: boolean;
};

/**
 * Every member's routines for today, in one query set — the read behind the
 * family-wide "Actieve routines" page (2026-09-14 plan, M3).
 *
 * The single-member sibling of this is `loadMemberRoutines`, and the two
 * deliberately share `toBoardRoutine`: the wall's overview and a child's own
 * page must agree, step for step, about what today contains. What differs is
 * only the shape around it — one column per member with its own bands and its
 * own progress, rather than one member's two-column board.
 *
 * Following `loadFamilyRoutineTotals`' family-scan pattern rather than calling
 * `loadMemberRoutines` once per member: that would be four round trips per
 * child on a display that re-renders on every realtime push.
 *
 * Null only when there is no principal. A member with nothing scheduled today
 * is present with no bands at all — "niets vandaag" is something the column
 * says, not a member the page omits.
 */
export async function loadFamilyRoutines(
  options: { date?: string; time?: string } = {}
): Promise<FamilyRoutinesData | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  const [family, members, routines] = await Promise.all([
    getFamily(principal.familyId),
    listMembers(principal.familyId),
    listRoutines(principal.familyId, { activeOnly: true }),
  ]);

  const timeZone = family?.timezone ?? 'Europe/Amsterdam';
  const now = resolveNow(options, timeZone);

  const timed = routines.flatMap((row) => {
    const timing = timingAt({ schedule: row.schedule, anchor: row.createdAt, timeZone }, now);
    return timing.occurrence ? [{ row, timing, occurrence: timing.occurrence }] : [];
  });

  const completions = await listCompletionsOn({
    familyId: principal.familyId,
    occurrenceDates: [...new Set(timed.map(({ occurrence }) => occurrence.occurrenceDate))],
  });

  // `memberId:stepId:date` — one scan for the whole household, narrowed per
  // member below into the `stepId:date` keys `toBoardRoutine` expects.
  const done = new Set(
    completions.map((entry) => `${entry.memberId}:${entry.routineStepId}:${entry.occurrenceDate}`)
  );

  const byMember = new Map<string, typeof timed>();
  for (const entry of timed) {
    const bucket = byMember.get(entry.row.ownerMemberId);
    if (bucket) bucket.push(entry);
    else byMember.set(entry.row.ownerMemberId, [entry]);
  }

  const columns = members.map((member): FamilyRoutineColumn => {
    const doneKeys = new Set(
      [...done]
        .filter((key) => key.startsWith(`${member.id}:`))
        .map((key) => key.slice(member.id.length + 1))
    );

    const all: FamilyBoardRoutine[] = (byMember.get(member.id) ?? []).map((entry) => {
      const routine = toBoardRoutine({ ...entry, memberId: member.id, doneKeys, timeZone });
      return { ...routine, tileClass: ROUTINE_ICON_TILE[routine.icon] };
    });

    // A finished one-off leaves the board and keeps its credit — the same
    // arithmetic `loadMemberRoutines` does, and for the same reason: a counter
    // that shrank under the household would be the board rewriting what it
    // asked for. So the bands *count* `all` and *render* what is left.
    const visible = (routine: FamilyBoardRoutine) => !(routine.oneOff && routine.complete);

    const bands = bandsOf(all)
      .map((band) => ({ ...band, routines: band.routines.filter(visible) }))
      .filter((band) => band.routines.length > 0);

    return {
      memberId: member.id,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      initials: initialsOf(member.displayName),
      role: member.role,
      colorClasses: MEMBER_COLOR_CLASSES[member.color],
      bands,
      activeRoutineId: firstOpenRoutineId(all.filter(visible)),
      progress: columnProgress(all),
      starsEarned: starsEarnedIn(all),
    };
  });

  return {
    familyId: principal.familyId,
    columns,
    now,
    timeZone,
    canComplete: can(principal, 'completion:write', { familyId: principal.familyId }),
  };
}
