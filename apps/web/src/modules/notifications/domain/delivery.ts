/**
 * What a push delivery attempt means for the subscription that produced it
 * (docs/architecture.md §6: "`404/410` → delete subscription. 3 consecutive
 * failures → disable").
 *
 * Pure and framework-free (architecture §2 rule 2): no `web-push`, no
 * database, no `server-only`. The retention policy for a family's devices is
 * a truth table, and it is worth being able to read it as one.
 */

/** §6: three *consecutive* failures, not three ever. */
export const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * The two things a push service can tell us that we act on.
 *
 * `gone` is the service saying this endpoint no longer exists — the browser
 * was uninstalled, the subscription was revoked, the token rotated. There is
 * nothing to retry and nothing to keep.
 *
 * `transient` is everything else: a 500, a 429, a timeout, a DNS failure. Any
 * one of them is noise; three in a row is a device that has stopped answering.
 */
export type DeliveryOutcome = 'success' | 'gone' | 'transient';

/** HTTP statuses that mean "this subscription is gone" (§6). */
export const GONE_STATUS_CODES = [404, 410] as const;

export function outcomeForStatus(statusCode: number | undefined): DeliveryOutcome {
  if (statusCode !== undefined && statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode !== undefined && (GONE_STATUS_CODES as readonly number[]).includes(statusCode)) {
    return 'gone';
  }
  return 'transient';
}

/**
 * What to do with the row.
 *
 * `delete` is reserved for `gone`. A run of transient failures gets `disable`
 * instead: the endpoint stays in the table so a re-subscribe from the same
 * browser upserts back onto it (and clears the disable) rather than silently
 * creating a second row for one device.
 */
export type SubscriptionAction = 'keep' | 'delete' | 'disable';

export type SubscriptionState = {
  action: SubscriptionAction;
  /** The value to write back to `failure_count`. */
  failureCount: number;
};

export function nextSubscriptionState(
  current: { failureCount: number },
  outcome: DeliveryOutcome
): SubscriptionState {
  if (outcome === 'gone') return { action: 'delete', failureCount: 0 };

  if (outcome === 'success') {
    // Reset, not decrement: the counter is a run length. A device that
    // answered is a healthy device, whatever it did last week.
    return { action: 'keep', failureCount: 0 };
  }

  const failureCount = current.failureCount + 1;
  return {
    action: failureCount >= MAX_CONSECUTIVE_FAILURES ? 'disable' : 'keep',
    failureCount,
  };
}
