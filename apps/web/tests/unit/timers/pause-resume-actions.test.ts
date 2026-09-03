import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '@/modules/family';

/**
 * `pauseTimerAction` / `resumeTimerAction` (M-T1) — the same
 * `assertCan('timer:control')` chokepoint and single-predicate idempotent
 * guard `stopTimerAction`/`extendTimerAction` already use, exercised with a
 * fully mocked `getDb()` the way `tests/unit/tasks/write-seam.test.ts` and
 * `tests/unit/calendar/write-seam.test.ts` mock theirs.
 *
 * Both actions gate every refusal behind one `WHERE` predicate
 * (`stoppedAt is null` plus the pause-state check), so "already paused",
 * "not paused", "already stopped" and "another family's timer" are, by
 * design, indistinguishable from outside the transaction — all four collapse
 * to the update returning no rows, which is what `timerNotFound` below
 * stands in for.
 */

const updateRows = vi.hoisted(() => ({ current: [] as unknown[] }));
const updateCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/server/db', () => ({
  getDb: () => ({
    transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        update: () => {
          updateCalls.count += 1;
          return {
            set: () => ({
              where: () => ({
                returning: async () => updateRows.current,
              }),
            }),
          };
        },
      }),
  }),
}));

const publish = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/modules/realtime', () => ({ publish }));

const assertCan = vi.hoisted(() => vi.fn());
vi.mock('@/modules/family', () => ({
  assertCan: (...args: unknown[]) => assertCan(...args),
  can: vi.fn(() => true),
  getMember: vi.fn(async () => null),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'nl' }));

const { pauseTimerAction, resumeTimerAction } = await import('@/modules/timers/actions');

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';
const TIMER_ID = '55555555-5555-4555-8555-555555555555';

const adultPrincipal: Principal = {
  kind: 'member',
  familyId: FAMILY_ID,
  memberId: MEMBER_ID,
  role: 'adult',
};

beforeEach(() => {
  updateRows.current = [];
  updateCalls.count = 0;
  publish.mockClear();
  assertCan.mockReset();
});

describe('pauseTimerAction', () => {
  it('refuses a principal without timer:control', async () => {
    assertCan.mockRejectedValue(new Error('forbidden'));

    const result = await pauseTimerAction({ timerId: TIMER_ID });

    expect(result).toEqual({ status: 'error', error: 'forbidden' });
    expect(updateCalls.count).toBe(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it('refuses invalid input before touching the database', async () => {
    assertCan.mockResolvedValue(adultPrincipal);

    const result = await pauseTimerAction({ timerId: 'not-a-uuid' } as never);

    expect(result).toEqual({ status: 'error', error: 'invalidInput' });
    expect(updateCalls.count).toBe(0);
  });

  it('reports timerNotFound when the guarded update matches nothing — already paused, stopped, missing, or another family', async () => {
    assertCan.mockResolvedValue(adultPrincipal);
    updateRows.current = [];

    const result = await pauseTimerAction({ timerId: TIMER_ID });

    expect(result).toEqual({ status: 'error', error: 'timerNotFound' });
    expect(publish).not.toHaveBeenCalled();
  });

  it('pauses on the happy path and publishes timer.paused', async () => {
    assertCan.mockResolvedValue(adultPrincipal);
    updateRows.current = [{ id: TIMER_ID, memberId: MEMBER_ID }];

    const result = await pauseTimerAction({ timerId: TIMER_ID });

    expect(result).toEqual({ status: 'paused' });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: FAMILY_ID,
        type: 'timer.paused',
        entity: { id: TIMER_ID },
      }),
      expect.anything()
    );
  });
});

describe('resumeTimerAction', () => {
  it('refuses a principal without timer:control', async () => {
    assertCan.mockRejectedValue(new Error('forbidden'));

    const result = await resumeTimerAction({ timerId: TIMER_ID });

    expect(result).toEqual({ status: 'error', error: 'forbidden' });
    expect(updateCalls.count).toBe(0);
  });

  it('reports timerNotFound when nothing is actually paused', async () => {
    assertCan.mockResolvedValue(adultPrincipal);
    updateRows.current = [];

    const result = await resumeTimerAction({ timerId: TIMER_ID });

    expect(result).toEqual({ status: 'error', error: 'timerNotFound' });
    expect(publish).not.toHaveBeenCalled();
  });

  it('resumes on the happy path and publishes timer.resumed', async () => {
    assertCan.mockResolvedValue(adultPrincipal);
    updateRows.current = [{ id: TIMER_ID, memberId: MEMBER_ID, pausedSeconds: 90 }];

    const result = await resumeTimerAction({ timerId: TIMER_ID });

    expect(result).toEqual({ status: 'resumed' });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: FAMILY_ID,
        type: 'timer.resumed',
        entity: { id: TIMER_ID },
        patch: expect.objectContaining({ pausedSeconds: 90 }),
      }),
      expect.anything()
    );
  });
});
