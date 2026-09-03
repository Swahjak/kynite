import { beforeEach, describe, expect, it, vi } from 'vitest';
import { member as memberTable } from '@/server/db/schema';

/**
 * `principalForMcpUser` — the MCP route's token-subject → `Principal` mapping
 * (M-D). Same discipline as `tests/unit/calendar/write-seam.test.ts`: a fully
 * mocked `getDb()` keyed by table identity, no real database.
 */

const selectRows = vi.hoisted(() => new Map<unknown, unknown[]>());

// `principalForMcpUser` awaits `.where(...)` directly (no `.limit()` — every
// live row for the user id is read, not just the first) so the mock's
// `where()` has to be awaitable on its own.
vi.mock('@/server/db', () => ({
  getDb: () => ({
    select: () => ({
      from: (table: unknown) => ({
        where: async () => selectRows.get(table) ?? [],
      }),
    }),
  }),
}));

// `@/server/mcp-auth` imports `@/modules/family`, whose barrel re-exports
// client components — which drags next-intl's client navigation into a plain
// Node run (see `tests/unit/calendar/write-seam.test.ts` for the same fix).
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

const { principalForMcpUser, grantedScopesOf, hasAllScopes, hasAnyScope, slideRateLimitWindow } =
  await import('@/server/mcp-auth');

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_FAMILY_ID = '33333333-3333-4333-8333-333333333333';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_MEMBER_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = 'user_abc123';

beforeEach(() => {
  selectRows.clear();
});

describe('principalForMcpUser', () => {
  it('maps a token subject with a member row to a member Principal', async () => {
    selectRows.set(memberTable, [
      { id: MEMBER_ID, familyId: FAMILY_ID, userId: USER_ID, role: 'adult' },
    ]);

    const result = await principalForMcpUser(USER_ID);

    expect(result).toEqual({
      ok: true,
      principal: { kind: 'member', familyId: FAMILY_ID, memberId: MEMBER_ID, role: 'adult' },
    });
  });

  it('preserves the member role (child) rather than assuming adult', async () => {
    selectRows.set(memberTable, [
      { id: MEMBER_ID, familyId: FAMILY_ID, userId: USER_ID, role: 'child' },
    ]);

    const result = await principalForMcpUser(USER_ID);

    expect(result).toEqual({
      ok: true,
      principal: { kind: 'member', familyId: FAMILY_ID, memberId: MEMBER_ID, role: 'child' },
    });
  });

  it('refuses a user id with no member row', async () => {
    selectRows.set(memberTable, []);

    const result = await principalForMcpUser(USER_ID);

    expect(result).toEqual({ ok: false, reason: 'noMember' });
  });

  it('refuses a user id with a live member row in more than one family, rather than binding nondeterministically', async () => {
    selectRows.set(memberTable, [
      { id: MEMBER_ID, familyId: FAMILY_ID, userId: USER_ID, role: 'adult' },
      { id: OTHER_MEMBER_ID, familyId: OTHER_FAMILY_ID, userId: USER_ID, role: 'adult' },
    ]);

    const result = await principalForMcpUser(USER_ID);

    expect(result).toEqual({ ok: false, reason: 'multipleFamilies' });
  });
});

describe('grantedScopesOf / hasAllScopes / hasAnyScope', () => {
  it('parses the space-delimited scope claim', () => {
    const scopes = grantedScopesOf({ scope: 'kynite:calendar.read kynite:tasks.write' });
    expect(scopes).toEqual(new Set(['kynite:calendar.read', 'kynite:tasks.write']));
  });

  it('returns an empty set for a missing scope claim', () => {
    expect(grantedScopesOf({})).toEqual(new Set());
  });

  it('hasAllScopes requires every scope', () => {
    const scopes = new Set(['kynite:calendar.read']);
    expect(hasAllScopes(scopes, ['kynite:calendar.read'])).toBe(true);
    expect(hasAllScopes(scopes, ['kynite:calendar.read', 'kynite:calendar.write'])).toBe(false);
  });

  it('hasAnyScope requires at least one scope', () => {
    const scopes = new Set(['kynite:tasks.read']);
    expect(hasAnyScope(scopes, ['kynite:calendar.read', 'kynite:tasks.read'])).toBe(true);
    expect(hasAnyScope(scopes, ['kynite:calendar.read', 'kynite:calendar.write'])).toBe(false);
  });
});

describe('slideRateLimitWindow', () => {
  it('allows requests under the max and keeps their timestamps', () => {
    const { result, kept } = slideRateLimitWindow([1_000, 2_000], 3_000, 60_000, 3);
    expect(result).toEqual({ limited: false });
    expect(kept).toEqual([1_000, 2_000, 3_000]);
  });

  it('limits once the window is at max, with a Retry-After derived from the oldest timestamp', () => {
    const { result, kept } = slideRateLimitWindow([0, 1_000, 2_000], 2_500, 60_000, 3);
    expect(result).toEqual({ limited: true, retryAfterSeconds: 58 });
    // The window is unchanged — a refused request is not itself recorded.
    expect(kept).toEqual([0, 1_000, 2_000]);
  });

  it('drops timestamps that have aged out of the window before counting', () => {
    // Two timestamps are 61s old (outside a 60s window) and should not count
    // toward the max, so a third request at `now` is allowed.
    const { result, kept } = slideRateLimitWindow([0, 1_000], 61_000, 60_000, 2);
    expect(result).toEqual({ limited: false });
    expect(kept).toEqual([61_000]);
  });
});
