#!/usr/bin/env node
/**
 * Run pending SQL migrations, then exit.
 *
 * This is the release step the container entrypoint runs before `server.js`
 * (M18: "migrations run before the new build starts"). It deliberately uses
 * `drizzle-orm`'s own migrator rather than `drizzle-kit`:
 *
 * - `drizzle-kit` is a devDependency and a build tool. Shipping it into the
 *   runtime image would drag esbuild, a TypeScript compiler and
 *   `drizzle.config.ts` (which reads `.env.local`) into production for the sake
 *   of one command.
 * - The migrator is part of the same `drizzle-orm` version the app was built
 *   against, so the code that applies a migration and the code that queries the
 *   result can never disagree about the journal format.
 *
 * It reads `drizzle/` — the generated `.sql` files plus `meta/_journal.json`.
 * Applying an already-applied migration is a no-op: drizzle's
 * `__drizzle_migrations` table is the record of what ran, so the entrypoint can
 * run this on every container start (and every replica) without guarding it.
 *
 * In the container it lives at `/app/migrator/migrate.mjs` next to its own
 * two-package `node_modules` (see `Dockerfile`), because Next's standalone
 * trace bundles `drizzle-orm` into the server chunks rather than emitting it as
 * a resolvable package. `../drizzle` resolves the same in both layouts.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[migrate] DATABASE_URL is required');
  process.exit(1);
}

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle');

// One connection, no pooling behaviour worth having: this process does one
// thing and then dies.
const pool = new Pool({ connectionString, max: 1 });

try {
  await migrate(drizzle(pool), { migrationsFolder });
  console.log('[migrate] up to date');
} catch (error) {
  console.error('[migrate] failed', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
