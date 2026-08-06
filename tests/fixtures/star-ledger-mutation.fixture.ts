/**
 * Fixture for `tests/unit/append-only-star-ledger.test.ts`.
 *
 * Every way a star could be rewritten or erased, one of each. This file is
 * never imported by the application and lives under `tests/fixtures`, which the
 * ESLint config ignores and the scanner never walks — it is only ever fed to
 * `scanForLedgerMutations()` by hand, to prove the scan is not vacuous.
 */

import { sql } from 'drizzle-orm';
import { starLedger } from '@/server/db/schema';

type FakeDb = {
  update: (table: unknown) => { set: (values: unknown) => unknown };
  delete: (table: unknown) => unknown;
  insert: (table: unknown) => unknown;
};

/** 1. Rewriting an award through the drizzle builder. */
export function rewriteAward(db: FakeDb) {
  return db.update(starLedger).set({ amount: 1 });
}

/** 2. Erasing an award through the drizzle builder. */
export function eraseAward(db: FakeDb) {
  return db.delete(starLedger);
}

/** 3. Raw SQL update, split across lines the way prettier would format it. */
export const rawRewrite = sql`
  update star_ledger
     set note = 'nothing to see here'
   where amount > 3
`;

/** 4. Raw SQL delete. */
export const rawErase = sql`delete from star_ledger where reason = 'surprise'`;

/** 5. The blunt instrument. */
export const rawTruncate = sql`truncate table star_ledger`;

/** Not a violation: appending is the only thing this table is for. */
export function award(db: FakeDb) {
  return db.insert(starLedger);
}
