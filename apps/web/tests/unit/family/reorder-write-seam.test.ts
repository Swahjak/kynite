import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '@/modules/family';
import { member as memberTable } from '@/server/db/schema';

/**
 * `reorderMember` / `setMemberOrder` — the M1 write seams for adjustable
 * member order. Same discipline and fake-`getDb()` style as
 * `tests/unit/tasks/write-seam.test.ts` and
 * `tests/unit/calendar/write-seam.test.ts`: `can()` runs *inside* the seam
 * against whatever `Principal` is passed in, so nothing here touches a
 * session or a real database.
 *
 * `eq`/`and` from `drizzle-orm` are replaced with capturing stand-ins (kept
 * otherwise real) so a `where()` call's target member id can be recovered by
 * column identity — the fake `db` below is keyed by call order and content,
 * not by re-implementing a query planner.
 */

type EqClause = { __eq: true; column: unknown; value: unknown };
type AndClause = { __and: true; clauses: unknown[] };

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (column: unknown, value: unknown): EqClause => ({ __eq: true, column, value }),
    and: (...clauses: unknown[]): AndClause => ({ __and: true, clauses }),
  };
});

function memberIdFromWhere(whereArg: unknown): string | undefined {
  const clauses = (whereArg as AndClause).__and ? (whereArg as AndClause).clauses : [whereArg];
  const idClause = clauses.find(
    (clause): clause is EqClause =>
      (clause as EqClause).__eq === true && (clause as EqClause).column === memberTable.id
  );
  return idClause?.value as string | undefined;
}

const rows = vi.hoisted(() => ({ current: [] as { id: string; sortOrder: number }[] }));
const updateCalls = vi.hoisted(() => [] as { memberId: string | undefined; sortOrder: number }[]);
const transactionCalls = vi.hoisted(() => ({ count: 0 }));
const selectCalls = vi.hoisted(() => ({ count: 0 }));

function makeFakeDb(): unknown {
  return {
    select: () => {
      selectCalls.count += 1;
      return {
        from: () => ({
          where: () => ({
            orderBy: () => rows.current,
            then: (resolve: (value: unknown) => void) => resolve(rows.current),
          }),
        }),
      };
    },
    update: () => ({
      set: (values: { sortOrder: number }) => ({
        where: (whereArg: unknown) => {
          updateCalls.push({ memberId: memberIdFromWhere(whereArg), sortOrder: values.sortOrder });
        },
      }),
    }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      transactionCalls.count += 1;
      return fn(makeFakeDb());
    },
  };
}

vi.mock('@/server/db', () => ({ getDb: () => makeFakeDb() }));

const can = vi.hoisted(() => vi.fn(() => true));
vi.mock('@/modules/family/authorize', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/family/authorize')>();
  return { ...actual, can };
});

const publish = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/modules/realtime', () => ({ publish }));

const { reorderMember, setMemberOrder } = await import('@/modules/family/write');

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';

const ownerPrincipal: Principal = {
  kind: 'member',
  familyId: FAMILY_ID,
  memberId: MEMBER_ID,
  role: 'owner',
};

const ROW_A = { id: 'aaaaaaaa-1111-4111-8111-111111111111', sortOrder: 0 };
const ROW_B = { id: 'bbbbbbbb-2222-4222-8222-222222222222', sortOrder: 1 };
const ROW_C = { id: 'cccccccc-3333-4333-8333-333333333333', sortOrder: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  can.mockReturnValue(true);
  rows.current = [ROW_A, ROW_B, ROW_C];
  updateCalls.length = 0;
  transactionCalls.count = 0;
  selectCalls.count = 0;
});

describe('reorderMember', () => {
  it('refuses a principal without member:manage, without touching the db', async () => {
    can.mockReturnValue(false);

    const result = await reorderMember(ownerPrincipal, { memberId: ROW_B.id, direction: 'up' });

    expect(result).toEqual({ status: 'error', error: 'forbidden' });
    expect(selectCalls.count).toBe(0);
    expect(transactionCalls.count).toBe(0);
  });

  it('refuses a member that does not belong to this family', async () => {
    const result = await reorderMember(ownerPrincipal, {
      memberId: '99999999-9999-4999-8999-999999999999',
      direction: 'up',
    });

    expect(result).toEqual({ status: 'error', error: 'memberNotFound' });
    expect(transactionCalls.count).toBe(0);
  });

  it('is a no-op at the top of the list', async () => {
    const result = await reorderMember(ownerPrincipal, { memberId: ROW_A.id, direction: 'up' });

    expect(result).toEqual({ status: 'idle' });
    expect(transactionCalls.count).toBe(0);
    expect(updateCalls).toHaveLength(0);
  });

  it('is a no-op at the bottom of the list', async () => {
    const result = await reorderMember(ownerPrincipal, { memberId: ROW_C.id, direction: 'down' });

    expect(result).toEqual({ status: 'idle' });
    expect(transactionCalls.count).toBe(0);
    expect(updateCalls).toHaveLength(0);
  });

  it('swaps a member up with its neighbour and renumbers only the two of them', async () => {
    const result = await reorderMember(ownerPrincipal, { memberId: ROW_B.id, direction: 'up' });

    expect(result).toEqual({ status: 'idle' });
    expect(transactionCalls.count).toBe(1);
    expect(updateCalls).toEqual(
      expect.arrayContaining([
        { memberId: ROW_B.id, sortOrder: 0 },
        { memberId: ROW_A.id, sortOrder: 1 },
      ])
    );
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls.some((call) => call.memberId === ROW_C.id)).toBe(false);
  });

  it('swaps a member down with its neighbour', async () => {
    const result = await reorderMember(ownerPrincipal, { memberId: ROW_B.id, direction: 'down' });

    expect(result).toEqual({ status: 'idle' });
    expect(updateCalls).toEqual(
      expect.arrayContaining([
        { memberId: ROW_B.id, sortOrder: 2 },
        { memberId: ROW_C.id, sortOrder: 1 },
      ])
    );
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls.some((call) => call.memberId === ROW_A.id)).toBe(false);
  });
});

describe('setMemberOrder', () => {
  it('refuses a principal without member:manage', async () => {
    can.mockReturnValue(false);

    const result = await setMemberOrder(ownerPrincipal, {
      orderedIds: [ROW_A.id, ROW_B.id, ROW_C.id],
    });

    expect(result).toEqual({ status: 'error', error: 'forbidden' });
    expect(transactionCalls.count).toBe(0);
  });

  it('applies the new order, renumbering 0..n-1', async () => {
    const result = await setMemberOrder(ownerPrincipal, {
      orderedIds: [ROW_C.id, ROW_A.id, ROW_B.id],
    });

    expect(result).toEqual({ status: 'idle' });
    expect(transactionCalls.count).toBe(1);
    expect(updateCalls).toEqual([
      { memberId: ROW_C.id, sortOrder: 0 },
      { memberId: ROW_A.id, sortOrder: 1 },
      { memberId: ROW_B.id, sortOrder: 2 },
    ]);
  });

  it.each([
    ['a foreign id', [ROW_A.id, ROW_B.id, '99999999-9999-4999-8999-999999999999']],
    ['a duplicate id', [ROW_A.id, ROW_A.id, ROW_B.id]],
    ['a missing id', [ROW_A.id, ROW_B.id]],
    ['an extra id beyond the family', [ROW_A.id, ROW_B.id, ROW_C.id, ROW_A.id]],
  ])('refuses %s and writes nothing', async (_label, orderedIds) => {
    const result = await setMemberOrder(ownerPrincipal, { orderedIds });

    expect(result).toEqual({ status: 'error', error: 'invalidInput' });
    expect(transactionCalls.count).toBe(0);
  });
});
