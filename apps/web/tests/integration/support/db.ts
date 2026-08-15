import { randomUUID } from 'node:crypto';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { expect } from 'vitest';
import * as schema from '@/server/db/schema';

/**
 * Shared plumbing for the integration suites.
 *
 * They run against a real Postgres 17 (`pnpm e2e:setup` brings one up on 5435)
 * because the invariants under test are *database* invariants — a check
 * constraint, a partial unique index, a view. They skip cleanly when
 * `DATABASE_URL` is absent so the unit gate stays runnable without Docker.
 */
export const databaseUrl = process.env.DATABASE_URL;

export type TestDb = NodePgDatabase<typeof schema>;

export function createTestDb(): { pool: Pool; db: TestDb } {
  const pool = new Pool({ connectionString: databaseUrl });
  return { pool, db: drizzle(pool, { schema }) };
}

/**
 * drizzle wraps driver errors ("Failed query: …") and puts the constraint name
 * on the cause, so assert against the whole cause chain.
 */
export async function expectRejection(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
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

export type Household = {
  familyId: string;
  parentId: string;
  childId: string;
  siblingId: string;
};

/** A family with one parent and two children. Removed by `dropHousehold`. */
export async function seedHousehold(db: TestDb, label: string): Promise<Household> {
  const suffix = randomUUID().slice(0, 8);

  const [family] = await db
    .insert(schema.family)
    .values({ name: `${label} ${suffix}` })
    .returning();

  const [parent, child, sibling] = await db
    .insert(schema.member)
    .values([
      { familyId: family.id, displayName: 'Sarah', role: 'owner', color: 'purple', sortOrder: 0 },
      { familyId: family.id, displayName: 'Bram', role: 'child', color: 'orange', sortOrder: 1 },
      { familyId: family.id, displayName: 'Fenna', role: 'child', color: 'teal', sortOrder: 2 },
    ])
    .returning();

  return {
    familyId: family.id,
    parentId: parent.id,
    childId: child.id,
    siblingId: sibling.id,
  };
}
