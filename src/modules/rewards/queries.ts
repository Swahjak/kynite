import 'server-only';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not from a slice barrel
// (the same note as `modules/calendar/page-data.ts`): the routines barrel
// re-exports client components, and this is a `server-only` module.
import { memberStarBalance, starLedger } from '@/server/db/schema';
import { redemption, reward, type Redemption, type Reward } from './schema';
import { starTotals, type StarTotals } from './domain/economy';

/**
 * Reads for the rewards slice. `server-only`: a client component that imported
 * this would ship the database client and its connection string to the browser.
 */

/**
 * The rewards on one child's shelf.
 *
 * `availableToMemberIds = []` means "every child" — that is the default, and it
 * is what makes the catalogue usable without per-child configuration. A
 * non-empty array is a deliberate restriction, and it is applied in SQL rather
 * than filtered in JavaScript so a reward that is not this child's never
 * crosses the process boundary at all.
 */
export async function listRewards(
  familyId: string,
  options: { memberId?: string; activeOnly?: boolean } = {}
): Promise<Reward[]> {
  return getDb()
    .select()
    .from(reward)
    .where(
      and(
        eq(reward.familyId, familyId),
        options.activeOnly ? eq(reward.active, true) : undefined,
        options.memberId
          ? sql`(cardinality(${reward.availableToMemberIds}) = 0 or ${options.memberId}::uuid = any(${reward.availableToMemberIds}))`
          : undefined
      )
    )
    .orderBy(asc(reward.sortOrder), asc(reward.costStars), asc(reward.createdAt));
}

/** One reward, family-scoped. Null for another family's id — never a leak. */
export async function getReward(familyId: string, rewardId: string): Promise<Reward | null> {
  const [row] = await getDb()
    .select()
    .from(reward)
    .where(and(eq(reward.id, rewardId), eq(reward.familyId, familyId)))
    .limit(1);

  return row ?? null;
}

export type RedemptionWithReward = Redemption & {
  rewardTitle: string;
  rewardIcon: string | null;
};

/**
 * Redemptions, newest first, with the reward's display fields joined in.
 *
 * The title is joined rather than denormalised at request time, but the *cost*
 * is not: `redemption.costStars` is frozen when the request is made, so
 * re-pricing the catalogue never re-prices a pending request. That asymmetry is
 * deliberate and lives in the schema comment too.
 */
export async function listRedemptions(
  familyId: string,
  options: { memberId?: string; statuses?: readonly Redemption['status'][]; limit?: number } = {}
): Promise<RedemptionWithReward[]> {
  const rows = await getDb()
    .select({
      redemption,
      rewardTitle: reward.title,
      rewardIcon: reward.icon,
    })
    .from(redemption)
    .innerJoin(reward, eq(reward.id, redemption.rewardId))
    .where(
      and(
        eq(redemption.familyId, familyId),
        options.memberId ? eq(redemption.memberId, options.memberId) : undefined,
        options.statuses && options.statuses.length > 0
          ? inArray(redemption.status, [...options.statuses])
          : undefined
      )
    )
    .orderBy(desc(redemption.requestedAt))
    .limit(options.limit ?? 100);

  return rows.map((row) => ({
    ...row.redemption,
    rewardTitle: row.rewardTitle,
    rewardIcon: row.rewardIcon,
  }));
}

/**
 * One member's star totals, from the derived view.
 *
 * Zeros for a member with no history — the view left-joins from `member`, so
 * "no rows yet" and "nothing earned" are the same answer, which is what keeps a
 * brand-new child's chart from rendering as an error state.
 */
export async function getStarTotals(familyId: string, memberId: string): Promise<StarTotals> {
  const [row] = await getDb()
    .select()
    .from(memberStarBalance)
    .where(and(eq(memberStarBalance.familyId, familyId), eq(memberStarBalance.memberId, memberId)))
    .limit(1);

  return starTotals({ earned: row?.earnedStars ?? 0, spent: row?.spentStars ?? 0 });
}

/**
 * Totals for every member of a family, as a map.
 *
 * Used by the *parent* surfaces only. Nothing child-facing may call this into
 * one screen: research §Decisions 3 puts no cross-sibling comparison anywhere a
 * child sees, and the Playwright assertion in `e2e/tests/rewards` enforces it
 * on the rendered DOM rather than trusting this comment.
 */
export async function listStarTotals(familyId: string): Promise<Map<string, StarTotals>> {
  const rows = await getDb()
    .select()
    .from(memberStarBalance)
    .where(eq(memberStarBalance.familyId, familyId));

  return new Map(
    rows.map((row) => [
      row.memberId,
      starTotals({ earned: row.earnedStars, spent: row.spentStars }),
    ])
  );
}

export type StarEntry = {
  id: string;
  amount: number;
  reason: string;
  note: string | null;
  createdAt: Date;
};

/**
 * A child's recent star history — the "earned" side of the chart.
 *
 * Read straight from `star_ledger`, which is append-only, so this list is a
 * record of things that happened and never a running correction. There is no
 * "spent" row interleaved here on purpose: spending belongs to the redemption
 * list, and mixing the two would put a debit in a feed whose whole point is
 * that it only grows.
 */
export async function listStarHistory(
  familyId: string,
  memberId: string,
  limit = 20
): Promise<StarEntry[]> {
  return getDb()
    .select({
      id: starLedger.id,
      amount: starLedger.amount,
      reason: starLedger.reason,
      note: starLedger.note,
      createdAt: starLedger.createdAt,
    })
    .from(starLedger)
    .where(and(eq(starLedger.familyId, familyId), eq(starLedger.memberId, memberId)))
    .orderBy(desc(starLedger.createdAt))
    .limit(limit);
}

/**
 * Stars earned per day over a window — the weekly totals a `savings`-horizon
 * child (ages ~8–12) sees, where a bar chart of "this week" is meaningful and
 * a four-year-old's "how many do I have" is not.
 *
 * The bucketing is done here rather than in SQL, deliberately. A
 * `group by date_trunc('day', created_at at time zone $tz)` is the obvious
 * version and it is subtly wrong twice over: drizzle renders the column
 * qualified in `GROUP BY` and unqualified in the select list, which Postgres
 * rejects outright, and more importantly it introduces a *second* definition of
 * "which local day is this instant" alongside the `Intl` one every other
 * surface uses. A week of one child's ledger is a handful of rows; bucketing
 * them in TypeScript keeps one definition of a day for the whole product.
 */
export async function starsPerDay(input: {
  familyId: string;
  memberId: string;
  since: Date;
  timeZone: string;
}): Promise<{ day: string; total: number }[]> {
  const rows = await getDb()
    .select({ amount: starLedger.amount, createdAt: starLedger.createdAt })
    .from(starLedger)
    .where(
      and(
        eq(starLedger.familyId, input.familyId),
        eq(starLedger.memberId, input.memberId),
        gte(starLedger.createdAt, input.since)
      )
    );

  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: input.timeZone });
  const totals = new Map<string, number>();

  for (const row of rows) {
    const day = formatter.format(row.createdAt);
    totals.set(day, (totals.get(day) ?? 0) + row.amount);
  }

  return [...totals.entries()]
    .map(([day, total]) => ({ day, total }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
