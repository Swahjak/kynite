import 'server-only';
import { startOfDay } from '@/modules/calendar';
import { getFamily, getPrincipal, listMembers, type Member } from '@/modules/family';
import { listStarTotals, listStarsEarnedSince } from '@/modules/rewards';
import {
  completionRatio,
  completionSeed,
  listCompletionsOn,
  listRoutines,
  routineIconOf,
  timingAt,
} from '@/modules/routines';
import { resolveStepIcon, type StarMatrixStep } from './domain/star-matrix';

/**
 * The "Kids' Progress" read behind `/today` (M19,
 * `docs/design/stitch/.../today_s_flow_light_mode/code.html:108-171`, and
 * `docs/rebuild-design-gaps.md` §3).
 *
 * The mockup's version of this panel is a streak row, a `LEVEL n` bar and a
 * percentage to the next level. Streaks and levels are a **deliberate product
 * cut** (design-gaps §"root cause 7", and the note at
 * `modules/rewards/ui/savings-goal-card.tsx:14`), so the panel is rebuilt from
 * the two facts this product actually keeps: how much of today's routine work
 * is done, and how many stars that has earned. Same composition, same weight on
 * the screen, no reintroduction of a mechanic that was rejected on purpose —
 * and nothing here counts consecutive days, which is what a streak *is*.
 *
 * Route files hold no logic (architecture §2 rule 4), so this resolves its own
 * principal rather than trusting one passed in: it is one more cheap read on a
 * page that already did it, and it means the panel cannot be mounted anywhere
 * without an authorisation check.
 */

export type KidProgress = {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  color: Member['color'];
  /** Routine steps due today (plus any still-open grace day) that are done. */
  doneSteps: number;
  totalSteps: number;
  /** `doneSteps / totalSteps`, clamped — 0 when nothing is due at all. */
  ratio: number;
  /** Stars earned since local midnight. Earned, never balance — see the query. */
  starsToday: number;
  /** Stars available to spend right now. */
  starBalance: number;
  /**
   * Today's steps for this child, in board order — the raw material of the
   * star matrix (`domain/star-matrix.ts`), and the reason this loader returns
   * more than the two counts above.
   *
   * Not a second query: the counts are *derived* from this list, so a card and
   * the grid beside it cannot disagree about what today contains.
   */
  steps: StarMatrixStep[];
};

export type TodayProgressData = {
  kids: KidProgress[];
  timeZone: string;
};

/** Null when there is no principal — the caller has already redirected. */
export async function loadTodayProgress(
  options: { now?: Date } = {}
): Promise<TodayProgressData | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  const family = await getFamily(principal.familyId);
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';
  const now = options.now ?? new Date();

  const [members, routines, starTotals, starsToday] = await Promise.all([
    listMembers(principal.familyId),
    listRoutines(principal.familyId, { activeOnly: true }),
    listStarTotals(principal.familyId),
    // "Today" is the family's local day, not the server's — the same rule the
    // calendar's `?date=` resolution follows.
    listStarsEarnedSince({ familyId: principal.familyId, since: startOfDay(now, timeZone) }),
  ]);

  // Only children get a card. An adult's routines exist and are counted
  // nowhere here: the panel is about the part of the day a parent is coaching.
  const kids = members.filter((member) => member.role === 'child');
  if (kids.length === 0) return { kids: [], timeZone };

  const kidIds = new Set(kids.map((kid) => kid.id));

  /**
   * Which routines are actually open today, and for whom.
   *
   * `timingAt` is the routines slice's own definition of that — including the
   * grace day an occurrence stays completable through — so this panel and the
   * child's board on the hub can never disagree about what "today" contains.
   */
  const open = routines.flatMap((row) => {
    if (!kidIds.has(row.ownerMemberId)) return [];
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

  /**
   * Every open step, per child, in board order.
   *
   * The counts below are counted off this list rather than tallied alongside
   * it: the stat card and the star matrix are then two readings of one fact,
   * and a step that appears in the grid is by construction a step the card
   * counted.
   */
  const stepsByKid = new Map<string, StarMatrixStep[]>(kids.map((kid) => [kid.id, []]));

  for (const { row, occurrence } of open) {
    const bucket = stepsByKid.get(row.ownerMemberId);
    if (!bucket) continue;

    const fallbackIcon = routineIconOf(row.icon);

    for (const step of row.steps) {
      bucket.push({
        routineId: row.id,
        stepId: step.id,
        title: step.title,
        icon: resolveStepIcon(step.icon, fallbackIcon),
        occurrenceDate: occurrence.occurrenceDate,
        done: done.has(`${row.ownerMemberId}:${step.id}:${occurrence.occurrenceDate}`),
        // Derived, not random — the same key the hub board mints for this
        // (member, step, day), so a tap here and a tap there are one write.
        clientId: completionSeed({
          memberId: row.ownerMemberId,
          routineStepId: step.id,
          occurrenceDate: occurrence.occurrenceDate,
        }),
      });
    }
  }

  return {
    timeZone,
    // `listMembers` already orders by `sortOrder`; the panel inherits it, so
    // the cards sit in the same order as the columns below them.
    kids: kids.map((kid) => {
      const steps = stepsByKid.get(kid.id) ?? [];
      const bucket = { done: steps.filter((step) => step.done).length, total: steps.length };

      return {
        memberId: kid.id,
        displayName: kid.displayName,
        avatarUrl: kid.avatarUrl,
        color: kid.color,
        doneSteps: bucket.done,
        totalSteps: bucket.total,
        ratio: completionRatio(bucket.total, bucket.done),
        starsToday: starsToday.get(kid.id) ?? 0,
        starBalance: starTotals.get(kid.id)?.available ?? 0,
        steps,
      };
    }),
  };
}
