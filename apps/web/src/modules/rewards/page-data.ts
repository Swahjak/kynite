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
  type RewardHorizon,
} from '@/modules/family';
import { hasGraduated, listRoutines } from '@/modules/routines';
import {
  REWARD_PRESETS,
  rewardStateOf,
  savingsGoalOf,
  starsShort,
  type Goal,
  type RewardState,
  type RewardPreset,
} from './domain/economy';
import { redemptionSeed } from './domain/redemption';
import {
  getStarTotals,
  listRedemptions,
  listRewards,
  listStarHistory,
  listStarTotals,
  starsPerDay,
  type RedemptionWithReward,
  type StarEntry,
} from './queries';
import type { StarTotals } from './domain/economy';
import type { Reward, RewardCategory } from './schema';
import { rewardIconOf, type RewardIcon } from './ui/tokens';

/**
 * The three server-side reads the reward surfaces compose (architecture §2
 * rule 4: route files hold no logic).
 *
 * `loadRewardsPage` feeds the parent's catalogue and approval queue.
 * `loadStore` and `loadStarChart` feed the child's hub surfaces — and they are
 * the *only* place those screens' shapes are decided, which is what keeps
 * "what a child can see about themselves" from drifting between components.
 *
 * One structural rule runs through both child loaders and is enforced by the
 * types, not by care: **neither ever returns more than one member's totals.**
 * `loadStore` returns a `children` list for the selector chips carrying names
 * and colours only, and exactly one `totals`. `listStarTotals` — the map keyed
 * by member — is called from the parent loader and nowhere else (research
 * §Decisions 3; the Playwright sweep asserts it on the rendered DOM).
 */

/** `YYYY-MM-DD` in a given zone. */
function dateKeyIn(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant);
}

/* -------------------------------------------------------------------------- */
/* parent: catalogue + approvals                                              */
/* -------------------------------------------------------------------------- */

export type RewardsPageData = {
  familyId: string;
  members: Member[];
  /** The children a reward can be assigned to, and stars awarded to. */
  children: Member[];
  rewards: Reward[];
  /** Open requests, oldest first — a queue, not a feed. */
  pending: RedemptionWithReward[];
  /** Granted but not yet handed over. */
  outstanding: RedemptionWithReward[];
  /** Everything decided, newest first. */
  history: RedemptionWithReward[];
  totals: Map<string, StarTotals>;
  presets: readonly RewardPreset[];
  canManage: boolean;
  canApprove: boolean;
  canAward: boolean;
};

export async function loadRewardsPage(): Promise<RewardsPageData | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  const [members, rewards, open, outstanding, history, totals] = await Promise.all([
    listMembers(principal.familyId),
    listRewards(principal.familyId),
    listRedemptions(principal.familyId, { statuses: ['requested'] }),
    listRedemptions(principal.familyId, { statuses: ['approved'] }),
    listRedemptions(principal.familyId, { statuses: ['denied', 'fulfilled'], limit: 20 }),
    listStarTotals(principal.familyId),
  ]);

  return {
    familyId: principal.familyId,
    members,
    children: members.filter((member) => member.role === 'child'),
    rewards,
    // Oldest first: the child who has been waiting longest is the one a queue
    // should surface, which is the opposite of every other list in this app.
    pending: [...open].reverse(),
    outstanding,
    history,
    totals,
    presets: REWARD_PRESETS,
    canManage: can(principal, 'reward:manage', { familyId: principal.familyId }),
    canApprove: can(principal, 'redemption:approve', { familyId: principal.familyId }),
    canAward: can(principal, 'stars:award', { familyId: principal.familyId }),
  };
}

/* -------------------------------------------------------------------------- */
/* child: the store                                                           */
/* -------------------------------------------------------------------------- */

export type StoreTile = {
  id: string;
  title: string;
  icon: RewardIcon;
  category: RewardCategory;
  costStars: number;
  state: RewardState;
  /** How many more stars this needs. 0 unless `state === 'outOfReach'`. */
  starsShort: number;
  /** The idempotency key this tile's tap will carry — derived, so a retry reuses it. */
  clientId: string;
};

/**
 * A selector chip. Face, name and colour only — deliberately no numbers.
 *
 * `colorClass` and `initials` are resolved *here* rather than in the store
 * component, which is a `'use client'` module: importing `@/modules/family` for
 * `MEMBER_COLOR_CLASSES` from there would pull the family barrel — and with it
 * `queries.ts` and `pg` — into the browser bundle. The barrel is safe in a
 * server module like this one and fatal in a client one, so the mapping happens
 * on this side of the boundary and the chip receives plain strings.
 */
export type StoreChip = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** Design-system classes for this member's colour. */
  colorClass: string;
  initials: string;
};

export type StoreData = {
  familyId: string;
  member: Member;
  /**
   * Who else's shelf can be switched to. Carries no totals, no progress and no
   * counts: switching between children is navigation, not comparison.
   */
  chips: StoreChip[];
  horizon: RewardHorizon;
  totals: StarTotals;
  tiles: StoreTile[];
  /** The featured goal. `null` for `instant` children, who do not save. */
  goal: Goal | null;
  canRequest: boolean;
  timeZone: string;
  now: Date;
};

export type StoreOptions = {
  /** `?member=` — which child's shelf. Defaults to the first child. */
  memberId?: string;
  /** `?date=YYYY-MM-DD` — pins the derived day so snapshots are deterministic. */
  date?: string;
};

export async function loadStore(options: StoreOptions = {}): Promise<StoreData | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  const [family, members] = await Promise.all([
    getFamily(principal.familyId),
    listMembers(principal.familyId),
  ]);

  const timeZone = family?.timezone ?? 'Europe/Amsterdam';
  const children = members.filter((entry) => entry.role === 'child');

  const member = options.memberId
    ? ((await getMember(principal.familyId, options.memberId)) ?? null)
    : (children[0] ?? null);

  if (!member) return null;

  const [rewards, totals, openRequests] = await Promise.all([
    listRewards(principal.familyId, { memberId: member.id, activeOnly: true }),
    getStarTotals(principal.familyId, member.id),
    listRedemptions(principal.familyId, { memberId: member.id, statuses: ['requested'] }),
  ]);

  const requestedIds = new Set(openRequests.map((entry) => entry.rewardId));

  // The day the idempotency key is derived from. `?date=` only ever affects
  // *rendering*; the action re-derives nothing from it, so a pinned store
  // cannot mint a key for another day that would then collide tomorrow.
  const now = new Date();
  const day = options.date ?? dateKeyIn(now, timeZone);

  const tiles: StoreTile[] = rewards.map((entry) => ({
    id: entry.id,
    title: entry.title,
    icon: rewardIconOf(entry.icon),
    category: entry.category,
    costStars: entry.costStars,
    state: rewardStateOf({
      costStars: entry.costStars,
      availableStars: totals.available,
      requested: requestedIds.has(entry.id),
    }),
    starsShort: starsShort(entry.costStars, totals.available),
    clientId: redemptionSeed({ memberId: member.id, rewardId: entry.id, day }),
  }));

  return {
    familyId: principal.familyId,
    member,
    chips: children.map((entry) => ({
      id: entry.id,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl,
      colorClass: MEMBER_COLOR_CLASSES[entry.color].surface,
      initials: initialsOf(entry.displayName),
    })),
    horizon: member.rewardHorizon,
    totals,
    tiles,
    // Only the savings tier gets a goal. For a four-year-old a progress bar
    // towards something days away is a bar that does not move (research
    // §"Age differentiation"), so the instant store simply has no such card.
    goal:
      member.rewardHorizon === 'savings'
        ? savingsGoalOf(
            rewards.map((entry) => ({
              id: entry.id,
              title: entry.title,
              costStars: entry.costStars,
            })),
            totals.available
          )
        : null,
    canRequest: can(principal, 'redemption:request', {
      familyId: principal.familyId,
      memberId: member.id,
    }),
    timeZone,
    now,
  };
}

/* -------------------------------------------------------------------------- */
/* child: the star chart                                                      */
/* -------------------------------------------------------------------------- */

export type WeekBar = { day: string; total: number };

export type GraduatedRoutine = { id: string; title: string };

export type StarChartData = {
  familyId: string;
  member: Member;
  horizon: RewardHorizon;
  totals: StarTotals;
  history: StarEntry[];
  /** The calendar week, Monday first, zeros included — a gap is not a hole. */
  week: WeekBar[];
  weekTotal: number;
  /** The family-zone day key of `now` — which of the seven bars is marked. */
  today: string;
  /** Routines that have graduated: the badge, never a downgrade (FR17). */
  graduated: GraduatedRoutine[];
  now: Date;
  timeZone: string;
};

export type StarChartOptions = {
  memberId: string;
  /** `?date=YYYY-MM-DD` — pins the week window so snapshots are deterministic. */
  date?: string;
};

export async function loadStarChart(options: StarChartOptions): Promise<StarChartData | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  const member = await getMember(principal.familyId, options.memberId);
  if (!member) return null;

  const family = await getFamily(principal.familyId);
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';

  const now = options.date ? new Date(`${options.date}T12:00:00Z`) : new Date();
  /**
   * **The calendar week, Monday to Sunday** — not a rolling seven days ending
   * today (`Beloningen.dc.html` r72-80, where "vr" is marked in a ma…zo row).
   *
   * A rolling window is the easier query and the wrong object: "deze week" is a
   * thing a household says to each other, and a chart whose leftmost bar is a
   * different weekday every day cannot be compared to yesterday's glance at it.
   * The fixed week also makes the marked column mean something — it is *where
   * in the week we are*, which is the second question the card answers.
   */
  const since = new Date(now.getTime());
  since.setUTCHours(0, 0, 0, 0);
  // getUTCDay: 0 = Sunday. Monday is the week start, so Sunday steps back six.
  since.setUTCDate(since.getUTCDate() - ((since.getUTCDay() + 6) % 7));

  const [totals, history, perDay, routines] = await Promise.all([
    getStarTotals(principal.familyId, member.id),
    listStarHistory(principal.familyId, member.id),
    starsPerDay({ familyId: principal.familyId, memberId: member.id, since, timeZone }),
    listRoutines(principal.familyId, { ownerMemberId: member.id }),
  ]);

  const totalsByDay = new Map(perDay.map((row) => [row.day, row.total]));

  // Seven bars, always. A day with nothing earned is a zero-height bar and no
  // annotation — the absence *is* the rendering (research §Decisions 1), and a
  // chart that silently omitted the day would make the week look shorter than
  // it was.
  const week: WeekBar[] = Array.from({ length: 7 }, (_, index) => {
    const dayInstant = new Date(since.getTime() + index * 86_400_000);
    const day = dateKeyIn(dayInstant, timeZone);
    return { day, total: totalsByDay.get(day) ?? 0 };
  });

  return {
    familyId: principal.familyId,
    member,
    horizon: member.rewardHorizon,
    totals,
    history,
    week,
    weekTotal: week.reduce((sum, bar) => sum + bar.total, 0),
    today: dateKeyIn(now, timeZone),
    graduated: routines
      .filter((routine) => hasGraduated(routine))
      .map((routine) => ({ id: routine.id, title: routine.title })),
    now,
    timeZone,
  };
}
