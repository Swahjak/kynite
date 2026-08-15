/**
 * The redemption state machine.
 *
 * ```
 *              ┌─ approve ─→ approved ─ hand over ─→ fulfilled
 * requested ───┤
 *              └─ deny ────→ denied
 * ```
 *
 * Four states, two of them terminal, and the shape of the machine *is* the
 * product decision:
 *
 * - **`denied` is terminal and costs nothing.** It does not roll back to
 *   `requested`, it does not deduct, and it has no follow-up state. A denial is
 *   a parent conversation, not an app mechanic (research §Decisions 1) — the
 *   only thing the system does is stop showing the request.
 * - **Only `approved` and `fulfilled` spend.** `member_star_balance` sums the
 *   cost of exactly those two, which is why `spendsStars()` and the view's
 *   `where status in (…)` must agree; the unit test pins them together.
 * - **There is no path back to `requested`.** Re-asking creates a *new* row, so
 *   the history of what a child asked for is append-only in practice even
 *   though the table is not append-only by constraint.
 *
 * Pure and framework-free (§2 rule 2): the actions validate against this, the
 * approval queue renders from it, and it is testable without a database.
 */

import { SPENDING_REDEMPTION_STATUSES, type RedemptionStatus } from '../schema';

/** Legal successors of each state. Empty = terminal. */
export const REDEMPTION_TRANSITIONS: Record<RedemptionStatus, readonly RedemptionStatus[]> = {
  requested: ['approved', 'denied'],
  approved: ['fulfilled'],
  denied: [],
  fulfilled: [],
};

export function canTransition(from: RedemptionStatus, to: RedemptionStatus): boolean {
  return REDEMPTION_TRANSITIONS[from].includes(to);
}

/** A state with nowhere left to go. */
export function isTerminal(status: RedemptionStatus): boolean {
  return REDEMPTION_TRANSITIONS[status].length === 0;
}

/** Awaiting a parent — the only state the approval queue shows. */
export function isOpen(status: RedemptionStatus): boolean {
  return status === 'requested';
}

/**
 * Has this redemption consumed stars?
 *
 * Mirrors `member_star_balance`'s `where status in ('approved','fulfilled')`.
 * Derived from the schema's own constant rather than re-listing the statuses,
 * so the view and the UI cannot drift apart by editing one of them.
 */
export function spendsStars(status: RedemptionStatus): boolean {
  return (SPENDING_REDEMPTION_STATUSES as readonly RedemptionStatus[]).includes(status);
}

/** The two decisions a parent can make on an open request. */
export const REDEMPTION_DECISIONS = ['approve', 'deny'] as const;

export type RedemptionDecision = (typeof REDEMPTION_DECISIONS)[number];

export function statusForDecision(decision: RedemptionDecision): RedemptionStatus {
  return decision === 'approve' ? 'approved' : 'denied';
}

/**
 * The idempotency key a redemption request carries, derived rather than random
 * — the same construction `domain/praise.completionSeed` uses for completions.
 *
 * Deriving it from `(member, reward, day)` means a retry after a dropped
 * connection reuses the same key *by construction* instead of by the client
 * remembering to. The day is in it so that a request denied on Monday can be
 * asked again on Tuesday: the open-request unique index already covers the
 * same-day double tap, and this covers the network retry.
 */
export function redemptionSeed(input: {
  memberId: string;
  rewardId: string;
  /** `YYYY-MM-DD` in the family's zone. */
  day: string;
}): string {
  return `redeem:${input.memberId}:${input.rewardId}:${input.day}`;
}

/**
 * Can this request be granted right now?
 *
 * Affordability is checked at *approval* time, not only at request time: a
 * child may have two requests open and enough stars for only one of them, and
 * whichever the parent approves second must be caught here. The action then
 * re-checks against the live balance inside the transaction — this function is
 * what both that check and the queue's rendering agree on.
 */
export function isGrantable(input: {
  status: RedemptionStatus;
  costStars: number;
  availableStars: number;
}): boolean {
  return isOpen(input.status) && input.availableStars >= input.costStars;
}
