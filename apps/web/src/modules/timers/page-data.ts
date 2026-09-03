import 'server-only';
import { cache } from 'react';
import { can, getPrincipal, listMembers, type Member } from '@/modules/family';
import { listRoutines } from '@/modules/routines';
import { isOnBoard, phaseOf, type TimerPhase } from './domain/countdown';
import { listRecentTimers, listRunningTimers, type TimerWithMember } from './queries';

/**
 * The server-side reads the timer surfaces compose (architecture §2 rule 4:
 * route files hold no logic).
 *
 * Both carry `serverNow` — the whole slice's skew correction rests on it. The
 * client subtracts its own `Date.now()` once to learn how wrong its clock is
 * and derives every subsequent frame from that offset, so a wall tablet whose
 * clock is hours out still shows the right countdown
 * (`domain/countdown.clockOffsetMs`).
 */

export type TimerView = {
  id: string;
  label: string;
  durationSeconds: number;
  /** Epoch milliseconds — a Date would arrive at the client as a string. */
  startedAt: number;
  stoppedAt: number | null;
  /** Epoch milliseconds, set while frozen — see `domain/countdown.ts`. */
  pausedAt: number | null;
  /** Seconds already folded in from earlier pauses. */
  pausedSeconds: number;
  warningLeadSeconds: number | null;
  memberId: string | null;
  memberName: string | null;
  memberColor: string | null;
  routineId: string | null;
  routineStepId: string | null;
  /** This timer's own icon, or null to fall back to the routine's / the default. */
  icon: string | null;
  /** The parent routine's icon — the fallback `ui/tokens.ts`'s `timerIconOf` reads. */
  routineIcon: string | null;
};

export type TimerBoardData = {
  familyId: string;
  /** The server's clock at read time. The client's clock is never the source. */
  serverNow: number;
  timers: TimerView[];
  /**
   * True when `serverNow` was pinned by `?now=` — the board then renders that
   * instant and neither ticks nor polls. Display only (see `resolveNow`).
   */
  frozen: boolean;
};

export type TimerBoardOptions = {
  /**
   * `?now=` — an epoch-milliseconds or ISO instant that pins what the board
   * renders as "now", the same trick `(hub)/hub/routines` uses with
   * `?date=&time=`: a screenshot of a live countdown is not a regression test.
   *
   * Rendering only. Timers are written with the server's real clock in
   * `actions.ts`, so a pinned board cannot start or stop anything in the past.
   */
  now?: string;
};

function resolveNow(options: TimerBoardOptions): { serverNow: number; frozen: boolean } {
  if (!options.now) return { serverNow: Date.now(), frozen: false };

  const numeric = Number(options.now);
  const pinned = Number.isFinite(numeric) ? new Date(numeric) : new Date(options.now);

  return Number.isNaN(pinned.getTime())
    ? { serverNow: Date.now(), frozen: false }
    : { serverNow: pinned.getTime(), frozen: true };
}

function toView(row: TimerWithMember): TimerView {
  return {
    id: row.id,
    label: row.label,
    durationSeconds: row.durationSeconds,
    startedAt: row.startedAt.getTime(),
    stoppedAt: row.stoppedAt ? row.stoppedAt.getTime() : null,
    pausedAt: row.pausedAt ? row.pausedAt.getTime() : null,
    pausedSeconds: row.pausedSeconds,
    warningLeadSeconds: row.warningLeadSeconds,
    memberId: row.memberId,
    memberName: row.memberName,
    memberColor: row.memberColor,
    routineId: row.routineId,
    routineStepId: row.routineStepId,
    icon: row.icon,
    routineIcon: row.routineIcon,
  };
}

/**
 * What the hub renders: the family's running timers, plus the server's clock.
 *
 * Timers that ran over long ago are dropped here rather than in the component,
 * so the ambient board, the timers screen and the polling endpoint cannot
 * disagree about what is still on the wall.
 *
 * `React.cache()`d the same way `getFamily` is (`modules/family/queries.ts`):
 * `(hub)/layout.tsx` reads this to seed the rail tile and `IdleReturn`'s "is
 * something running" context, and the page under it (`hub/timer/page.tsx`,
 * `hub/timers/page.tsx`) reads it again for the board itself — same request,
 * same principal, same instant. Memoizing on the primitive `now` rather than
 * the whole `options` object is deliberate: two separately-constructed `{}`
 * literals are two different cache keys to `cache()`, so the unpinned common
 * case (layout's bare call and a page's `{ now: undefined }`) would still miss
 * if the object itself were the key.
 */
async function loadTimerBoardFor(now: string | undefined): Promise<TimerBoardData | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  const { serverNow, frozen } = resolveNow({ now });
  // The window `listRunningTimers` applies is relative to the *board's* clock,
  // not the process's: `?now=` pins what the board renders as now, and a
  // snapshot pinned to another day must still see the timers that belong to
  // that day (M09 carry-forward — the bound was added in M11).
  const running = await listRunningTimers(principal.familyId, new Date(serverNow));

  return {
    familyId: principal.familyId,
    serverNow,
    timers: running.filter((row) => isOnBoard(row, serverNow)).map(toView),
    frozen,
  };
}

const cachedLoadTimerBoard = cache(loadTimerBoardFor);

export async function loadTimerBoard(
  options: TimerBoardOptions = {}
): Promise<TimerBoardData | null> {
  return cachedLoadTimerBoard(options.now);
}

/** A routine step that prescribes a timer — one tap starts it from the Controller. */
export type StepTimerOption = {
  routineStepId: string;
  routineTitle: string;
  stepTitle: string;
  timerSeconds: number;
  memberId: string;
};

export type TimersPageData = {
  familyId: string;
  serverNow: number;
  members: Member[];
  running: TimerView[];
  recent: (TimerView & { phase: TimerPhase })[];
  stepOptions: StepTimerOption[];
  canControl: boolean;
};

/**
 * The Controller surface (`(app)/timers`): start a timer for anyone, from a
 * routine step's prescription or ad hoc, and stop what is running.
 */
export async function loadTimersPage(): Promise<TimersPageData | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  const serverNow = Date.now();

  const [members, running, recent, routines] = await Promise.all([
    listMembers(principal.familyId),
    listRunningTimers(principal.familyId),
    listRecentTimers(principal.familyId),
    listRoutines(principal.familyId, { activeOnly: true }),
  ]);

  const stepOptions: StepTimerOption[] = routines.flatMap((routine) =>
    routine.steps.flatMap((step) =>
      step.timerSeconds
        ? [
            {
              routineStepId: step.id,
              routineTitle: routine.title,
              stepTitle: step.title,
              timerSeconds: step.timerSeconds,
              memberId: routine.ownerMemberId,
            },
          ]
        : []
    )
  );

  return {
    familyId: principal.familyId,
    serverNow,
    members,
    running: running.map(toView),
    recent: recent.map((row) => ({ ...toView(row), phase: phaseOf(row, serverNow) })),
    stepOptions,
    canControl: can(principal, 'timer:control', { familyId: principal.familyId }),
  };
}
