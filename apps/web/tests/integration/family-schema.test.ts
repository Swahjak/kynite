import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@/server/db/schema';

/**
 * Integration tests against a real Postgres (`pnpm e2e:setup` brings one up on
 * 5435). They skip cleanly when `DATABASE_URL` is absent, so the unit gate stays
 * runnable without Docker.
 */
const databaseUrl = process.env.DATABASE_URL;

/** drizzle wraps driver errors ("Failed query: …"); the constraint name is on the cause. */
async function expectRejection(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  let thrown: unknown;
  try {
    await promise;
  } catch (error) {
    thrown = error;
  }

  expect(thrown, 'expected the query to be rejected').toBeDefined();

  const chain: string[] = [];
  for (let error = thrown; error instanceof Error; error = error.cause) {
    chain.push(error.message);
  }

  expect(chain.join('\n')).toMatch(pattern);
}

describe.skipIf(!databaseUrl)('family schema (integration)', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  const { family, member, user } = schema;

  const suffix = randomUUID().slice(0, 8);
  let familyId: string;
  let userId: string;

  beforeAll(async () => {
    userId = `test-user-${suffix}`;
    await db.insert(user).values({
      id: userId,
      name: 'Sarah',
      email: `sarah-${suffix}@example.test`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const [created] = await db
      .insert(family)
      .values({ name: `Test family ${suffix}` })
      .returning();
    familyId = created.id;
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, familyId));
    await db.delete(user).where(eq(user.id, userId));
    await pool.end();
  });

  it('defaults a family to the Dutch household setup', async () => {
    const [row] = await db.select().from(family).where(eq(family.id, familyId));

    expect(row.locale).toBe('nl');
    expect(row.timezone).toBe('Europe/Amsterdam');
    expect(row.weekStartsOn).toBe(1);
  });

  it('stores an owner member linked to the auth user', async () => {
    const [owner] = await db
      .insert(member)
      .values({
        familyId,
        userId,
        displayName: 'Sarah',
        role: 'owner',
        color: 'purple',
        rewardHorizon: 'savings',
        sortOrder: 0,
      })
      .returning();

    expect(owner.role).toBe('owner');
    expect(owner.userId).toBe(userId);
  });

  it('creates children with no login at all (userId null)', async () => {
    const children = await db
      .insert(member)
      .values([
        {
          familyId,
          displayName: 'Bram',
          role: 'child',
          color: 'orange',
          rewardHorizon: 'instant',
          birthDate: '2019-04-02',
          sortOrder: 1,
        },
        {
          familyId,
          displayName: 'Fenna',
          role: 'child',
          color: 'teal',
          rewardHorizon: 'savings',
          sortOrder: 2,
        },
      ])
      .returning();

    expect(children.map((child) => child.userId)).toEqual([null, null]);
    expect(children[0].avatarUrl).toBeNull();
    expect(children[0].birthDate).toBe('2019-04-02');

    // The partial unique index must not treat two logins-less members as a clash.
    const loginless = await db
      .select()
      .from(member)
      .where(and(eq(member.familyId, familyId), isNull(member.userId)));
    expect(loginless).toHaveLength(2);
  });

  it('orders the roster by sortOrder', async () => {
    const roster = await db
      .select({ name: member.displayName })
      .from(member)
      .where(eq(member.familyId, familyId))
      .orderBy(member.sortOrder);

    expect(roster.map((row) => row.name)).toEqual(['Sarah', 'Bram', 'Fenna']);
  });

  it('lets one login claim exactly one member per family', async () => {
    await expectRejection(
      db.insert(member).values({
        familyId,
        userId,
        displayName: 'Sarah again',
        role: 'adult',
        color: 'blue',
        rewardHorizon: 'savings',
        sortOrder: 9,
      }),
      /member_family_user_unique/
    );
  });

  it('rejects a color outside the eight-color palette', async () => {
    await expectRejection(
      db.execute(
        sql`insert into "member" ("family_id", "display_name", "role", "color")
            values (${familyId}, 'Chartreuse', 'child', 'chartreuse')`
      ),
      /member_color/
    );
  });

  it('carries the session scope columns better-auth writes', async () => {
    const [owner] = await db
      .select()
      .from(member)
      .where(and(eq(member.familyId, familyId), eq(member.role, 'owner')));

    const sessionId = `test-session-${suffix}`;
    await db.insert(schema.session).values({
      id: sessionId,
      token: `token-${suffix}`,
      userId,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      activeFamilyId: familyId,
      memberId: owner.id,
    });

    const [row] = await db.select().from(schema.session).where(eq(schema.session.id, sessionId));

    expect(row.activeFamilyId).toBe(familyId);
    expect(row.memberId).toBe(owner.id);

    await db.delete(schema.session).where(eq(schema.session.id, sessionId));
  });

  it('removes the whole household when the family goes', async () => {
    const [doomed] = await db
      .insert(family)
      .values({ name: `Doomed ${suffix}` })
      .returning();
    await db.insert(member).values({
      familyId: doomed.id,
      displayName: 'Ghost',
      role: 'child',
      color: 'red',
      rewardHorizon: 'instant',
    });

    await db.delete(family).where(eq(family.id, doomed.id));

    const survivors = await db.select().from(member).where(eq(member.familyId, doomed.id));
    expect(survivors).toHaveLength(0);
  });
});
