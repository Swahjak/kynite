import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '@/modules/family';
import { member as memberTable } from '@/server/db/schema';
import type { CreateTaskInput } from '@/modules/tasks/write';

/**
 * `createTask` — the MCP write seam (M-B), the tasks slice's twin of
 * `modules/calendar/write.ts#createEvent` and `modules/routines/complete.ts`'s
 * `recordCompletion`. Exercised with a fully mocked `getDb()`: `can()` runs
 * *inside* the seam against whatever `Principal` is passed in, so these tests
 * never touch a cookie or a session — only the explicit principal a future
 * `/api/mcp` route would build.
 */

const selectRows = vi.hoisted(() => new Map<unknown, unknown[]>());
const insertRows = vi.hoisted(() => ({ current: [] as unknown[] }));
const insertCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/server/db', () => ({
  getDb: () => ({
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => selectRows.get(table) ?? [],
        }),
      }),
    }),
    transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        insert: () => {
          insertCalls.count += 1;
          return {
            values: () => ({
              returning: async () => insertRows.current,
            }),
          };
        },
      }),
  }),
}));

const publish = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/modules/realtime', () => ({ publish }));

// `./write.ts` imports `@/modules/family`, whose barrel re-exports client
// components — which drags next-intl's client navigation into a plain Node
// run (see `tests/integration/routine-completion.test.ts` for the same fix).
// Only `redirect` matters here, and it throws like the real one.
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

const { createTask } = await import('@/modules/tasks/write');

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';
const ASSIGNEE_ID = '44444444-4444-4444-8444-444444444444';

const adultPrincipal: Principal = {
  kind: 'member',
  familyId: FAMILY_ID,
  memberId: MEMBER_ID,
  role: 'adult',
};

const childPrincipal: Principal = {
  kind: 'member',
  familyId: FAMILY_ID,
  memberId: MEMBER_ID,
  role: 'child',
};

const baseInput: CreateTaskInput = { title: 'Prullenbak buiten zetten' };

beforeEach(() => {
  selectRows.clear();
  insertRows.current = [];
  insertCalls.count = 0;
  publish.mockClear();
});

describe('createTask', () => {
  it('refuses a principal without task:write', async () => {
    const result = await createTask(childPrincipal, baseInput);

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(insertCalls.count).toBe(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it('refuses an assigneeMemberId scoped to another family', async () => {
    // The fake `member` table has no row at all — modelling `getMember`
    // returning null (either the id does not exist, or it exists in another
    // family — `getMember` re-checks `row.familyId === familyId` itself).
    selectRows.set(memberTable, []);

    const result = await createTask(adultPrincipal, {
      ...baseInput,
      assigneeMemberId: ASSIGNEE_ID,
    });

    expect(result).toEqual({ ok: false, error: 'memberNotFound' });
    expect(insertCalls.count).toBe(0);
  });

  it('creates the task on the happy path, publishing a realtime event', async () => {
    insertRows.current = [{ id: 'new-task-id' }];

    const result = await createTask(adultPrincipal, baseInput);

    expect(result).toEqual({ ok: true, taskId: 'new-task-id' });
    expect(insertCalls.count).toBe(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: FAMILY_ID,
        type: 'task.upserted',
        entity: { id: 'new-task-id' },
      }),
      expect.anything()
    );
  });
});
