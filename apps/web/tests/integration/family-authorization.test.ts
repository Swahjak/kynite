import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * Action-level authorization (M03 review carry-forward, closed in M04).
 *
 * `tests/unit/permissions.test.ts` proves the §7 matrix and
 * `tests/unit/server-action-authorization.test.ts` proves every action calls
 * the chokepoint. Neither proves that a *running* action, resolving a real
 * principal from a real database, actually refuses. That is what this does:
 * the only fakes are the framework seams (session cookie, revalidation,
 * locale) — `can()`, `getPrincipal()`, the queries and the writes are real.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: { activeFamilyId?: string; memberId?: string } } | null,
}));

vi.mock('@/server/db', () => ({
  getDb: () => stubs.db,
}));

vi.mock('@/server/auth', () => ({
  getAuth: () => ({ api: { getSession: async () => stubs.session } }),
}));

// `cookies()` is mocked alongside `headers()` since M12: `getPrincipal()` falls
// back to the kiosk cookie when there is no account session, so every suite
// that resolves a principal now touches the jar. An empty one means "no paired
// device", which is what these suites assume.
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'nl' }));
// `@/i18n/navigation` pulls next-intl's client navigation (and `next/navigation`)
// into a plain Node run; only `redirect` matters here, and it throws like the
// real one so a redirecting action can never look like a successful return.
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

const { createMemberAction, deleteMemberAction, updateMemberAction } =
  await import('@/modules/family/actions');

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const childInput = {
  displayName: 'Nieuw kind',
  role: 'child',
  color: 'green',
  rewardHorizon: 'instant',
};

describe.skipIf(!databaseUrl)('family action authorization (integration)', () => {
  const { pool, db } = createTestDb();
  const { family, member } = schema;

  let ours: Household;
  let theirs: Household;
  let adultId: string;

  beforeAll(async () => {
    stubs.db = db;
    ours = await seedHousehold(db, 'Ours');
    theirs = await seedHousehold(db, 'Theirs');

    const [adult] = await db
      .insert(member)
      .values({
        familyId: ours.familyId,
        displayName: 'Mark',
        role: 'adult',
        color: 'blue',
        sortOrder: 3,
      })
      .returning();
    adultId = adult.id;
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, ours.familyId));
    await db.delete(family).where(eq(family.id, theirs.familyId));
    await pool.end();
  });

  beforeEach(() => {
    stubs.session = null;
  });

  /** Signs in as a member of a household, the way the session cookie would. */
  function signInAs(familyId: string, memberId: string) {
    stubs.session = { session: { activeFamilyId: familyId, memberId } };
  }

  function countMembers(familyId: string) {
    return db
      .select()
      .from(member)
      .where(eq(member.familyId, familyId))
      .then((rows) => rows.length);
  }

  it('lets the owner create a member (the harness is not denying everything)', async () => {
    signInAs(ours.familyId, ours.parentId);
    const before = await countMembers(ours.familyId);

    const result = await createMemberAction(
      { status: 'idle' },
      form({ ...childInput, displayName: 'Toegestaan' })
    );

    expect(result).toEqual({ status: 'idle' });
    expect(await countMembers(ours.familyId)).toBe(before + 1);
  });

  it('denies an adult creating a member — member:manage is owner-only', async () => {
    signInAs(ours.familyId, adultId);
    const before = await countMembers(ours.familyId);

    const result = await createMemberAction({ status: 'idle' }, form(childInput));

    expect(result).toEqual({ status: 'error', error: 'forbidden' });
    expect(await countMembers(ours.familyId), 'nothing may be written').toBe(before);
  });

  it('denies a child creating a member', async () => {
    signInAs(ours.familyId, ours.childId);
    const before = await countMembers(ours.familyId);

    const result = await createMemberAction({ status: 'idle' }, form(childInput));

    expect(result).toEqual({ status: 'error', error: 'forbidden' });
    expect(await countMembers(ours.familyId)).toBe(before);
  });

  it('denies a caller with no session at all', async () => {
    const before = await countMembers(ours.familyId);

    const result = await createMemberAction({ status: 'idle' }, form(childInput));

    expect(result).toEqual({ status: 'error', error: 'forbidden' });
    expect(await countMembers(ours.familyId)).toBe(before);
  });

  it('denies a session pointing at a member of another family', async () => {
    // A tampered cookie: our family id, their member id.
    stubs.session = { session: { activeFamilyId: ours.familyId, memberId: theirs.parentId } };

    const result = await createMemberAction({ status: 'idle' }, form(childInput));

    expect(result).toEqual({ status: 'error', error: 'forbidden' });
  });

  it('does not update a forged cross-family memberId', async () => {
    signInAs(ours.familyId, ours.parentId);

    const result = await updateMemberAction(
      { status: 'idle' },
      form({
        ...childInput,
        displayName: 'Overgenomen',
        memberId: theirs.childId,
      })
    );

    expect(result).toEqual({ status: 'error', error: 'memberNotFound' });

    const [victim] = await db.select().from(member).where(eq(member.id, theirs.childId));
    expect(victim.displayName).toBe('Bram');
    expect(victim.familyId).toBe(theirs.familyId);
  });

  it('does not delete a forged cross-family memberId', async () => {
    signInAs(ours.familyId, ours.parentId);

    const result = await deleteMemberAction({ status: 'idle' }, form({ memberId: theirs.childId }));

    expect(result).toEqual({ status: 'error', error: 'memberNotFound' });

    const survivors = await db.select().from(member).where(eq(member.id, theirs.childId));
    expect(survivors).toHaveLength(1);
  });

  it('denies an adult updating or deleting a member of their own family', async () => {
    signInAs(ours.familyId, adultId);

    const updated = await updateMemberAction(
      { status: 'idle' },
      form({ ...childInput, displayName: 'Hernoemd', memberId: ours.childId })
    );
    const deleted = await deleteMemberAction({ status: 'idle' }, form({ memberId: ours.childId }));

    expect(updated).toEqual({ status: 'error', error: 'forbidden' });
    expect(deleted).toEqual({ status: 'error', error: 'forbidden' });

    const [untouched] = await db
      .select()
      .from(member)
      .where(and(eq(member.id, ours.childId), eq(member.familyId, ours.familyId)));
    expect(untouched.displayName).toBe('Bram');
  });

  it('refuses to remove the owner, even for the owner', async () => {
    signInAs(ours.familyId, ours.parentId);

    const result = await deleteMemberAction({ status: 'idle' }, form({ memberId: ours.parentId }));

    expect(result).toEqual({ status: 'error', error: 'cannotRemoveOwner' });
    const survivors = await db.select().from(member).where(eq(member.id, ours.parentId));
    expect(survivors).toHaveLength(1);
  });

  /**
   * Custom avatars (M20), through the running action and into the column.
   *
   * `tests/unit/avatar-svg.test.ts` proves what the validator answers.
   * These prove the answer is *load-bearing*: that the accepted data URI
   * survives the round trip byte-for-byte (`avatar_url` is `text`, so there is
   * no length to truncate against and no migration to make), and that a
   * rejected one leaves the row exactly as it was rather than being stored,
   * stripped or blanked.
   */
  describe('custom avatar uploads', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#D0C6AC"/></svg>';
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;

    async function avatarOf(memberId: string): Promise<string | null> {
      const [row] = await db.select().from(member).where(eq(member.id, memberId));
      return row.avatarUrl;
    }

    it('stores a validated data URI unchanged, and swaps back to a preset', async () => {
      signInAs(ours.familyId, ours.parentId);

      const uploaded = await updateMemberAction(
        { status: 'idle' },
        form({ ...childInput, displayName: 'Bram', memberId: ours.childId, avatarUrl: dataUri })
      );

      expect(uploaded).toEqual({ status: 'idle' });
      expect(await avatarOf(ours.childId)).toBe(dataUri);

      // Going back to a built-in avatar is the same field taking a different
      // value — there is no upload to clear first.
      const preset = await updateMemberAction(
        { status: 'idle' },
        form({
          ...childInput,
          displayName: 'Bram',
          memberId: ours.childId,
          avatarUrl: '/avatars/fox.svg',
        })
      );

      expect(preset).toEqual({ status: 'idle' });
      expect(await avatarOf(ours.childId)).toBe('/avatars/fox.svg');
    });

    it.each([
      [
        'a script element',
        `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>fetch("//evil.example")</script></svg>', 'utf8').toString('base64')}`,
      ],
      [
        'an event handler',
        `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>', 'utf8').toString('base64')}`,
      ],
      [
        'an oversized payload',
        `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><desc>${'a'.repeat(21 * 1024)}</desc></svg>`, 'utf8').toString('base64')}`,
      ],
      ['a bare http URL', 'https://evil.example/avatar.svg'],
    ])('refuses %s and writes nothing', async (_label, avatarUrl) => {
      signInAs(ours.familyId, ours.parentId);
      const before = await avatarOf(ours.childId);

      const result = await updateMemberAction(
        { status: 'idle' },
        form({ ...childInput, displayName: 'Bram', memberId: ours.childId, avatarUrl })
      );

      expect(result).toEqual({ status: 'error', error: 'invalidInput' });
      expect(await avatarOf(ours.childId)).toBe(before);
    });
  });
});
