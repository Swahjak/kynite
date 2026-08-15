import { Client } from 'pg';

import { test as familyTest } from './family';

/**
 * A test that never runs concurrently with another copy of *itself* (M17).
 *
 * Two visual specs seed **fixed** uuids on purpose: the praise line a completed
 * step shows is `hash(memberId:stepId:occurrenceDate)` (`domain/praise.ts`), so
 * random ids would give different words on every run and the baseline would
 * flap. Fixed ids are globally unique rows, though, which is fine while each
 * test owns its own id prefix — and stops being fine under `--repeat-each=2`,
 * where two copies of the same test run in different workers, each deleting the
 * other's rows before re-inserting its own.
 *
 * The two obvious fixes both fail. Randomising the ids changes the praise, which
 * is the thing the baseline exists to pin. `test.describe.configure({ mode:
 * 'serial' })` orders tests *within* a group in one worker; it does not stop
 * Playwright running two repetitions of that group concurrently.
 *
 * A Postgres advisory lock does work, because the two colliding copies already
 * share the one thing that can arbitrate between them: the database. The key is
 * the test's own title path, so this serialises a test against its repeats and
 * against nothing else — every other spec still runs fully parallel.
 */

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://kynite:kynite@localhost:5435/kynite_test';

export const test = familyTest.extend<{ exclusive: void }>({
  exclusive: [
    // eslint-disable-next-line no-empty-pattern -- Playwright's fixture signature
    async ({}, use, testInfo) => {
      const key = testInfo.titlePath.join(' > ');
      // A dedicated connection: an advisory lock is held by the *session*, so
      // it has to outlive any pooled query the test makes in between.
      const client = new Client({ connectionString: DATABASE_URL });
      await client.connect();
      await client.query('select pg_advisory_lock(hashtext($1))', [key]);

      try {
        await use();
      } finally {
        await client.query('select pg_advisory_unlock(hashtext($1))', [key]);
        await client.end();
      }
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
