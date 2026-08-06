import { getTableConfig, PgTable, type PgColumn } from 'drizzle-orm/pg-core';
import { is } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '@/server/db/schema';

/**
 * Structural assertions over the drizzle schema *objects* — not over the
 * generated SQL text. Rationale: these are the M04 hard invariants, and a test
 * that greps a migration file passes for a schema that no longer produces it.
 * The database-level behaviour of the same invariants is proven against a real
 * Postgres in `tests/integration/`.
 */

const tables = (Object.values(schema) as unknown[])
  .filter((value): value is PgTable => is(value, PgTable))
  .map((table) => getTableConfig(table));

function tableNamed(name: string) {
  const table = tables.find((candidate) => candidate.name === name);
  expect(table, `table "${name}" is missing from the schema barrel`).toBeDefined();
  return table!;
}

function columnNames(name: string): string[] {
  return tableNamed(name).columns.map((column) => column.name);
}

/** Index/unique-constraint column lists, keyed by index name. */
function indexColumns(tableName: string): Map<string, string[]> {
  const table = tableNamed(tableName);
  const entries = new Map<string, string[]>();

  for (const index of table.indexes) {
    entries.set(
      index.config.name!,
      index.config.columns.map((column) => (column as PgColumn).name)
    );
  }
  for (const constraint of table.uniqueConstraints) {
    entries.set(
      constraint.name!,
      constraint.columns.map((column) => column.name)
    );
  }

  return entries;
}

function uniqueIndexNames(tableName: string): string[] {
  const table = tableNamed(tableName);
  return [
    ...table.indexes.filter((index) => index.config.unique).map((index) => index.config.name!),
    ...table.uniqueConstraints.map((constraint) => constraint.name!),
  ];
}

/**
 * Tables that legitimately carry no `family_id`, each with the reason it is not
 * family-scoped. Anything not listed here must carry the column — the whole
 * point is that one predicate scopes every query (and, later, RLS).
 */
const NOT_FAMILY_SCOPED: Record<string, string> = {
  // better-auth owns these; a user exists before any household does.
  user: 'auth identity, pre-household',
  session: 'auth session — carries activeFamilyId as a scope *pointer*, not ownership',
  account: 'auth provider identity, hangs off user',
  verification: 'auth token store, keyed by identifier',
  // The scope root itself.
  family: 'is the scope',
  // Children of a family-scoped parent: scoped transitively, deleted by cascade.
  routine_step: 'scoped through routine',
  device_session: 'scoped through device',
};

describe('schema-wide invariants', () => {
  it('exposes every slice through the barrel', () => {
    expect(tables.map((table) => table.name).sort()).toEqual(
      [
        'account',
        'calendar',
        'completion',
        'device',
        'device_session',
        'event',
        'event_log',
        'family',
        'google_account',
        'member',
        'push_subscription',
        'redemption',
        'reward',
        'routine',
        'routine_step',
        'session',
        'share_link',
        'star_ledger',
        'timer',
        'user',
        'verification',
      ].sort()
    );
  });

  it('carries family_id on every family-scoped table', () => {
    const missing = tables
      .filter((table) => !table.columns.some((column) => column.name === 'family_id'))
      .map((table) => table.name)
      .filter((name) => !(name in NOT_FAMILY_SCOPED));

    expect(missing, 'these tables need a family_id (or an entry in NOT_FAMILY_SCOPED)').toEqual([]);
  });

  it('keeps the family_id exemption list honest', () => {
    for (const name of Object.keys(NOT_FAMILY_SCOPED)) {
      const table = tables.find((candidate) => candidate.name === name);
      expect(table, `stale exemption for a table that no longer exists: ${name}`).toBeDefined();
      expect(
        table!.columns.some((column) => column.name === 'family_id'),
        `${name} now has family_id — drop its exemption`
      ).toBe(false);
    }
  });

  it('makes every family_id a cascading foreign key to family', () => {
    for (const table of tables) {
      if (!table.columns.some((column) => column.name === 'family_id')) continue;

      const reference = table.foreignKeys
        .map((key) => key.reference())
        .find((ref) => ref.columns.some((column) => column.name === 'family_id'));

      expect(reference, `${table.name}.family_id is not a foreign key`).toBeDefined();
      expect(reference!.foreignTable, `${table.name}.family_id points elsewhere`).toBe(
        schema.family
      );
    }
  });
});

describe('event', () => {
  it('indexes (familyId, startsAt) — the calendar read predicate', () => {
    expect(indexColumns('event').get('event_family_starts_at_idx')).toEqual([
      'family_id',
      'starts_at',
    ]);
  });

  it('is unique on (calendarId, googleEventId) — one row per Google event', () => {
    expect(indexColumns('event').get('event_calendar_google_event_unique')).toEqual([
      'calendar_id',
      'google_event_id',
    ]);
    expect(uniqueIndexNames('event')).toContain('event_calendar_google_event_unique');
  });

  it('stores recurrence verbatim, with an override parent and sync metadata', () => {
    expect(columnNames('event')).toEqual(
      expect.arrayContaining([
        'rrule',
        'rdates',
        'exdates',
        'recurrence_parent_id',
        'etag',
        'updated_at_remote',
        'deleted_at',
        'version',
        'tz',
      ])
    );
  });
});

describe('completion', () => {
  it('is unique on (memberId, routineStepId, occurrenceDate)', () => {
    expect(indexColumns('completion').get('completion_member_step_date_unique')).toEqual([
      'member_id',
      'routine_step_id',
      'occurrence_date',
    ]);
    expect(uniqueIndexNames('completion')).toContain('completion_member_step_date_unique');
  });

  it('is unique on clientId — the offline outbox idempotency key', () => {
    expect(indexColumns('completion').get('completion_client_id_unique')).toEqual(['client_id']);
    expect(uniqueIndexNames('completion')).toContain('completion_client_id_unique');
  });
});

describe('star_ledger', () => {
  it('declares CHECK (amount > 0) — no star removal, ever', () => {
    const checks = tableNamed('star_ledger').checks;
    expect(checks.map((check) => check.name)).toContain('star_ledger_amount_positive');
  });

  it('is append-only: no updated_at column exists to update', () => {
    expect(columnNames('star_ledger')).not.toContain('updated_at');
  });

  it('indexes (familyId, memberId, createdAt)', () => {
    expect(indexColumns('star_ledger').get('star_ledger_family_member_created_idx')).toEqual([
      'family_id',
      'member_id',
      'created_at',
    ]);
  });
});

describe('event_log', () => {
  it('uses a bigserial primary key — the cursor has to be ordered', () => {
    const id = tableNamed('event_log').columns.find((column) => column.name === 'id');

    expect(id?.primary).toBe(true);
    expect(id?.getSQLType()).toBe('bigserial');
  });

  it('indexes (familyId, id) — the replay predicate', () => {
    expect(indexColumns('event_log').get('event_log_family_id_id_idx')).toEqual([
      'family_id',
      'id',
    ]);
  });
});

describe('uniqueness required by sync and sharing', () => {
  it.each([
    ['google_account', 'google_account_family_google_user_unique', ['family_id', 'google_user_id']],
    [
      'calendar',
      'calendar_google_account_calendar_unique',
      ['google_account_id', 'google_calendar_id'],
    ],
    ['share_link', 'share_link_token_hash_unique', ['token_hash']],
    ['push_subscription', 'push_subscription_endpoint_unique', ['endpoint']],
    ['device_session', 'device_session_token_hash_unique', ['token_hash']],
  ])('%s is unique on %s', (table, indexName, columns) => {
    expect(indexColumns(table).get(indexName)).toEqual(columns);
    expect(uniqueIndexNames(table)).toContain(indexName);
  });
});
