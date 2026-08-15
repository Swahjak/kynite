import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * N6 (review fix): tokens must never land in Postgres as plaintext. The unit
 * suite (`tests/unit/google/token-crypto.test.ts`) proves `encryptToken`
 * produces a `v1:`-prefixed envelope; this proves the *linking flow* actually
 * calls it before the row is written — reading the raw `access_token` column
 * back from a real database, not a value the test computed itself.
 *
 * `@/modules/google/linking` is imported dynamically because it pulls in
 * `@/server/db`, which reads `DATABASE_URL` on first use.
 */
describe.skipIf(!databaseUrl)('google linking (integration)', () => {
  const { pool, db } = createTestDb();

  let household: Household;
  let linking: typeof import('@/modules/google/linking');

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
    process.env.GOOGLE_CLIENT_ID ??= 'client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET ??= 'client-secret';
    process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');

    linking = await import('@/modules/google/linking');

    household = await seedHousehold(db, 'GoogleLinking');
  });

  afterAll(async () => {
    await db.delete(schema.family).where(eq(schema.family.id, household.familyId));
    await pool.end();
  });

  it('stores access_token and refresh_token as v1:-prefixed ciphertext, never plaintext', async () => {
    const plainAccessToken = 'ya29.a0AfExamplePlaintextAccessToken';
    const plainRefreshToken = '1//0gExamplePlaintextRefreshToken';

    const { account, relinked } = await linking.linkGoogleAccount({
      familyId: household.familyId,
      memberId: household.parentId,
      identity: { googleUserId: `google-${randomUUID()}`, email: 'parent@example.test' },
      tokens: {
        accessToken: plainAccessToken,
        refreshToken: plainRefreshToken,
        expiresAt: new Date(Date.now() + 3600_000),
        scopes: ['https://www.googleapis.com/auth/calendar'],
        idToken: null,
      },
    });

    // A brand-new identity is a first link, not a repair — the flag that
    // decides whether discovery may switch the primary calendar on.
    expect(relinked).toBe(false);

    // The raw row, straight from the database — not the value `linking`
    // returned in memory, which could theoretically differ from what was
    // persisted.
    const [row] = await db
      .select()
      .from(schema.googleAccount)
      .where(eq(schema.googleAccount.id, account.id));

    expect(row.accessToken).not.toBeNull();
    expect(row.accessToken).not.toBe(plainAccessToken);
    expect(row.accessToken!.startsWith('v1:')).toBe(true);
    expect(row.accessToken).not.toContain(plainAccessToken);

    expect(row.refreshToken).not.toBeNull();
    expect(row.refreshToken).not.toBe(plainRefreshToken);
    expect(row.refreshToken!.startsWith('v1:')).toBe(true);
    expect(row.refreshToken).not.toContain(plainRefreshToken);
  });

  it('keeps re-linking (the reauth-repair path) encrypted too', async () => {
    const googleUserId = `google-${randomUUID()}`;
    const identity = { googleUserId, email: 'reauth@example.test' };

    const first = await linking.linkGoogleAccount({
      familyId: household.familyId,
      memberId: household.parentId,
      identity,
      tokens: {
        accessToken: 'first-plaintext-token',
        refreshToken: 'first-plaintext-refresh',
        expiresAt: new Date(Date.now() + 3600_000),
        scopes: [],
        idToken: null,
      },
    });

    const second = await linking.linkGoogleAccount({
      familyId: household.familyId,
      memberId: household.parentId,
      identity,
      tokens: {
        accessToken: 'second-plaintext-token',
        refreshToken: 'second-plaintext-refresh',
        expiresAt: new Date(Date.now() + 3600_000),
        scopes: [],
        idToken: null,
      },
    });

    const [row] = await db
      .select()
      .from(schema.googleAccount)
      .where(eq(schema.googleAccount.id, second.account.id));

    expect(row.accessToken!.startsWith('v1:')).toBe(true);
    expect(row.accessToken).not.toContain('second-plaintext-token');

    // The same identity twice is an update, and it says so: the callback reads
    // this to keep a reconnect from re-enabling calendars the parent removed.
    expect(first.relinked).toBe(false);
    expect(second.relinked).toBe(true);
    expect(second.account.id).toBe(first.account.id);
  });
});
