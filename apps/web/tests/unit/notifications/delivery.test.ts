import { describe, expect, it } from 'vitest';
import {
  GONE_STATUS_CODES,
  MAX_CONSECUTIVE_FAILURES,
  nextSubscriptionState,
  outcomeForStatus,
} from '@/modules/notifications/domain/delivery';

/**
 * The push retention policy (docs/architecture.md §6: "`404/410` → delete
 * subscription. 3 consecutive failures → disable").
 *
 * Both halves of the rule are easy to get subtly wrong in ways nobody notices
 * for months: deleting on a transient 500 quietly unsubscribes a working
 * phone, and counting failures cumulatively rather than consecutively
 * disables every device that has ever had a bad night. So the truth table is
 * a pure function and this is its truth table.
 */

describe('delivery outcome', () => {
  it('reads 2xx as success', () => {
    for (const status of [200, 201, 202, 204]) {
      expect(outcomeForStatus(status)).toBe('success');
    }
  });

  it('reads 404 and 410 as gone — and nothing else', () => {
    expect(GONE_STATUS_CODES).toEqual([404, 410]);
    expect(outcomeForStatus(404)).toBe('gone');
    expect(outcomeForStatus(410)).toBe('gone');

    expect(outcomeForStatus(400)).toBe('transient');
    expect(outcomeForStatus(429)).toBe('transient');
    expect(outcomeForStatus(500)).toBe('transient');
    expect(outcomeForStatus(503)).toBe('transient');
  });

  it('reads "no response at all" as transient', () => {
    // A DNS failure or a socket timeout says nothing about the subscription.
    expect(outcomeForStatus(undefined)).toBe('transient');
  });
});

describe('subscription state after an attempt', () => {
  it('deletes on gone, whatever the failure history', () => {
    expect(nextSubscriptionState({ failureCount: 0 }, 'gone')).toEqual({
      action: 'delete',
      failureCount: 0,
    });
    expect(nextSubscriptionState({ failureCount: 2 }, 'gone')).toEqual({
      action: 'delete',
      failureCount: 0,
    });
  });

  it('resets the run on success rather than decrementing it', () => {
    // The counter is a *run length*. A device that answered is healthy, even
    // if it missed the previous two.
    expect(nextSubscriptionState({ failureCount: 2 }, 'success')).toEqual({
      action: 'keep',
      failureCount: 0,
    });
  });

  it('keeps the subscription for the first two consecutive failures', () => {
    expect(nextSubscriptionState({ failureCount: 0 }, 'transient')).toEqual({
      action: 'keep',
      failureCount: 1,
    });
    expect(nextSubscriptionState({ failureCount: 1 }, 'transient')).toEqual({
      action: 'keep',
      failureCount: 2,
    });
  });

  it('disables — never deletes — on the third consecutive failure', () => {
    const third = nextSubscriptionState({ failureCount: 2 }, 'transient');

    expect(third).toEqual({ action: 'disable', failureCount: MAX_CONSECUTIVE_FAILURES });
    // Disabled, not deleted: the row has to survive so a re-subscribe from the
    // same browser upserts onto it instead of duplicating the device.
    expect(third.action).not.toBe('delete');
  });

  it('pins the threshold at three', () => {
    expect(MAX_CONSECUTIVE_FAILURES).toBe(3);
  });

  it('lets one success in the middle of a bad night reset the count to zero', () => {
    let state = { failureCount: 0 };
    state = nextSubscriptionState(state, 'transient');
    state = nextSubscriptionState(state, 'transient');
    expect(state.failureCount).toBe(2);

    state = nextSubscriptionState(state, 'success');
    expect(state.failureCount).toBe(0);

    // …so the next failure starts a fresh run rather than tripping the limit.
    expect(nextSubscriptionState(state, 'transient').action).toBe('keep');
  });
});
