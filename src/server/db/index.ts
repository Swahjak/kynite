import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '@/server/env';
import * as schema from './schema';

type Database = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let instance: Database | undefined;

/**
 * Lazily constructs the pool so importing this module (e.g. during
 * `next build`) never touches the environment.
 */
export function getDb(): Database {
  if (!instance) {
    pool = new Pool({ connectionString: env.DATABASE_URL });
    instance = drizzle(pool, { schema });
  }
  return instance;
}

export const db: Database = new Proxy({} as Database, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getDb(), prop) as unknown;
  },
});

export type { Database };
