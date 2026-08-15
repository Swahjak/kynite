import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REDEMPTION_TRANSITIONS,
  canTransition,
  isGrantable,
  isOpen,
  isTerminal,
  redemptionSeed,
  spendsStars,
  statusForDecision,
} from '@/modules/rewards/domain/redemption';
import { REDEMPTION_STATUSES, SPENDING_REDEMPTION_STATUSES } from '@/modules/rewards/schema';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * The status list the `member_star_balance` view's `where status in (...)`
 * clause actually filters on, pulled out of the schema source rather than
 * imported — `spendsStars` is *defined from* `SPENDING_REDEMPTION_STATUSES`
 * (`domain/redemption.ts`), so comparing the two constants against each other
 * is a tautology that cannot fail even if the view's SQL drifts from both. This
 * reads the SQL text the view actually runs, so a future edit to the `where`
 * clause that isn't mirrored in `SPENDING_REDEMPTION_STATUSES` fails here.
 */
function viewSpendingStatuses(): string[] {
  const source = readFileSync(join(root, 'src/modules/routines/schema.ts'), 'utf8');
  const match = source.match(/where status in \(([^)]+)\)/);
  if (!match)
    throw new Error("member_star_balance view's `where status in (...)` clause not found");

  return match[1].split(',').map((entry) => entry.trim().replace(/^'(.*)'$/, '$1'));
}

/** The redemption state machine — and the transitions it deliberately lacks. */

describe('redemption transitions', () => {
  it('covers every status in the enum', () => {
    expect(Object.keys(REDEMPTION_TRANSITIONS).sort()).toEqual([...REDEMPTION_STATUSES].sort());
  });

  it('lets an open request be approved or denied', () => {
    expect(canTransition('requested', 'approved')).toBe(true);
    expect(canTransition('requested', 'denied')).toBe(true);
  });

  it('lets an approved reward be handed over', () => {
    expect(canTransition('approved', 'fulfilled')).toBe(true);
  });

  it('makes denial terminal — there is no undo path and no penalty state', () => {
    expect(isTerminal('denied')).toBe(true);
    expect(canTransition('denied', 'requested')).toBe(false);
    expect(canTransition('denied', 'approved')).toBe(false);
  });

  it('never reopens a decided request — re-asking is a new row', () => {
    for (const status of ['approved', 'denied', 'fulfilled'] as const) {
      expect(canTransition(status, 'requested'), `${status} → requested`).toBe(false);
    }
  });

  it('does not let an approval be walked back into a denial', () => {
    // Stars have already been committed at that point; unwinding one would be
    // the star removal the ledger's CHECK exists to make impossible.
    expect(canTransition('approved', 'denied')).toBe(false);
    expect(canTransition('fulfilled', 'denied')).toBe(false);
  });

  it('treats only `requested` as open', () => {
    expect(REDEMPTION_STATUSES.filter(isOpen)).toEqual(['requested']);
  });
});

describe('what spends stars', () => {
  it('is exactly approved and fulfilled — the same pair member_star_balance sums', () => {
    expect(REDEMPTION_STATUSES.filter(spendsStars).sort()).toEqual(
      [...SPENDING_REDEMPTION_STATUSES].sort()
    );
  });

  it('matches the status list the view SQL actually filters on, read from source — not a self-comparison', () => {
    // Pinned against the SQL text itself (see `viewSpendingStatuses` above),
    // so a `where` clause edited without a matching change to
    // `SPENDING_REDEMPTION_STATUSES` fails here instead of drifting silently.
    expect(viewSpendingStatuses().sort()).toEqual([...SPENDING_REDEMPTION_STATUSES].sort());
  });

  it('costs nothing while a request is open', () => {
    expect(spendsStars('requested')).toBe(false);
  });

  it('costs nothing when denied — the whole point of a reward-only system', () => {
    expect(spendsStars('denied')).toBe(false);
  });
});

describe('decisions', () => {
  it('maps approve and deny onto their statuses', () => {
    expect(statusForDecision('approve')).toBe('approved');
    expect(statusForDecision('deny')).toBe('denied');
  });

  it('grants only an open, affordable request', () => {
    expect(isGrantable({ status: 'requested', costStars: 5, availableStars: 5 })).toBe(true);
    expect(isGrantable({ status: 'requested', costStars: 6, availableStars: 5 })).toBe(false);
    // The second of two open requests, once the first has eaten the balance.
    expect(isGrantable({ status: 'approved', costStars: 1, availableStars: 99 })).toBe(false);
  });
});

describe('redemptionSeed', () => {
  it('is derived, so a retry reuses the same key without remembering it', () => {
    const input = { memberId: 'm1', rewardId: 'r1', day: '2026-03-11' };
    expect(redemptionSeed(input)).toBe(redemptionSeed({ ...input }));
  });

  it('separates children, rewards and days', () => {
    const base = { memberId: 'm1', rewardId: 'r1', day: '2026-03-11' };
    const keys = new Set([
      redemptionSeed(base),
      redemptionSeed({ ...base, memberId: 'm2' }),
      redemptionSeed({ ...base, rewardId: 'r2' }),
      redemptionSeed({ ...base, day: '2026-03-12' }),
    ]);

    expect(keys.size).toBe(4);
  });

  it('lets the same reward be asked for again on another day', () => {
    // A denial on Monday must not permanently consume the idempotency key: the
    // open-request unique index already covers the same-day double tap.
    expect(redemptionSeed({ memberId: 'm', rewardId: 'r', day: '2026-03-11' })).not.toBe(
      redemptionSeed({ memberId: 'm', rewardId: 'r', day: '2026-03-12' })
    );
  });
});
