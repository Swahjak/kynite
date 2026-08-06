import { Client } from 'pg';

/**
 * Direct-to-database seeding for the calendar specs.
 *
 * The events these specs need — a recurring custody series, a private-calendar
 * event, one already marked `pendingSyncAt` — either cannot be authored through
 * the UI at all or would take a dozen interactions each. Seeding them as rows
 * keeps the specs about what they actually assert. The *session* is still real:
 * every spec signs up through the UI first, and seeding attaches to the family
 * that sign-up created.
 */

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://kynite:kynite@localhost:5435/kynite_test';

export async function withDb<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export type SeededMember = { id: string; displayName: string; color: string };

/** Children/second parent, in board order. The owner already exists from sign-up. */
export async function seedMembers(
  client: Client,
  familyId: string,
  members: {
    displayName: string;
    role: string;
    color: string;
    sortOrder: number;
    /**
     * A fixed id. Only the visual specs need one: anything derived from an id
     * (M07 seeds each praise line from `member:step:date`) would otherwise
     * change on every run and make the snapshot flap.
     */
    id?: string;
  }[]
): Promise<SeededMember[]> {
  const seeded: SeededMember[] = [];

  for (const member of members) {
    const { rows } = await client.query<{ id: string }>(
      `insert into member (family_id, id, display_name, role, color, reward_horizon, sort_order)
       values ($1, coalesce($2::uuid, gen_random_uuid()), $3, $4, $5, 'instant', $6)
       returning id`,
      [familyId, member.id ?? null, member.displayName, member.role, member.color, member.sortOrder]
    );
    seeded.push({ id: rows[0].id, displayName: member.displayName, color: member.color });
  }

  return seeded;
}

export type SeedEvent = {
  title: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  ownerMemberId?: string | null;
  attendeeMemberIds?: string[];
  eventType?: string;
  category?: string | null;
  rrule?: string | null;
  exdates?: string[];
  calendarId?: string | null;
  pendingSync?: boolean;
  tz?: string;
};

export async function seedEvents(
  client: Client,
  familyId: string,
  events: SeedEvent[]
): Promise<string[]> {
  const ids: string[] = [];

  for (const event of events) {
    const { rows } = await client.query<{ id: string }>(
      `insert into event (
         family_id, calendar_id, title, starts_at, ends_at, all_day, tz,
         owner_member_id, attendee_member_ids, event_type, category, rrule,
         exdates, pending_sync_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       returning id`,
      [
        familyId,
        event.calendarId ?? null,
        event.title,
        event.startsAt,
        event.endsAt,
        event.allDay ?? false,
        event.tz ?? 'Europe/Amsterdam',
        event.ownerMemberId ?? null,
        event.attendeeMemberIds ?? [],
        event.eventType ?? 'appointment',
        event.category ?? null,
        event.rrule ?? null,
        event.exdates ?? [],
        event.pendingSync ? new Date().toISOString() : null,
      ]
    );
    ids.push(rows[0].id);
  }

  return ids;
}

/**
 * A Google account + calendar, without any Google contact.
 *
 * The rows are what the read path joins against — `visibility`, `writable`,
 * `color` — and none of that needs a real OAuth link to be exercised. Tokens
 * are left null: nothing in a read touches them.
 */
export async function seedCalendar(
  client: Client,
  familyId: string,
  ownerMemberId: string,
  options: {
    summary: string;
    visibility?: 'family' | 'private';
    writable?: boolean;
    color?: string;
  }
): Promise<string> {
  const suffix = Math.random().toString(36).slice(2, 10);

  const { rows: accountRows } = await client.query<{ id: string }>(
    `insert into google_account (family_id, owner_member_id, google_user_id, email, status)
     values ($1, $2, $3, $4, 'active')
     returning id`,
    [familyId, ownerMemberId, `e2e-${suffix}`, `e2e-${suffix}@example.test`]
  );

  const { rows } = await client.query<{ id: string }>(
    `insert into calendar (
       family_id, google_account_id, google_calendar_id, summary, color,
       time_zone, visibility, writable, sync_enabled
     )
     values ($1, $2, $3, $4, $5, 'Europe/Amsterdam', $6, $7, true)
     returning id`,
    [
      familyId,
      accountRows[0].id,
      `cal-${suffix}@group.calendar.google.com`,
      options.summary,
      options.color ?? '#3b82f6',
      options.visibility ?? 'family',
      options.writable ?? true,
    ]
  );

  return rows[0].id;
}

/** The owner member sign-up created, so seeded events can be assigned to them. */
export async function ownerMemberOf(client: Client, familyId: string): Promise<SeededMember> {
  const { rows } = await client.query<{ id: string; display_name: string; color: string }>(
    `select id, display_name, color from member where family_id = $1 and role = 'owner' limit 1`,
    [familyId]
  );

  return { id: rows[0].id, displayName: rows[0].display_name, color: rows[0].color };
}

/** `pending_sync_at` as the push path would set it — for asserting the pip. */
export async function markPendingSync(client: Client, eventId: string): Promise<void> {
  await client.query(`update event set pending_sync_at = now() where id = $1`, [eventId]);
}

export async function readEvent(client: Client, eventId: string) {
  const { rows } = await client.query(
    `select id, title, starts_at, ends_at, version, rrule, exdates,
            recurrence_parent_id, pending_sync_at, deleted_at, category
       from event where id = $1`,
    [eventId]
  );
  return rows[0];
}

export async function childrenOf(client: Client, parentId: string) {
  const { rows } = await client.query(
    `select id, title, starts_at, ends_at, rrule from event
      where recurrence_parent_id = $1 order by starts_at`,
    [parentId]
  );
  return rows;
}

export type SeedRoutine = {
  /** A fixed id, for the same determinism reason as `seedMembers`. */
  id?: string;
  title: string;
  ownerMemberId: string;
  /** `{ rrule, timeOfDay, graceDays }` — the `routine.schedule` jsonb. */
  schedule: { rrule: string; timeOfDay?: string; graceDays?: number };
  icon?: string;
  starsPerCompletion?: number;
  rewardEnabled?: boolean;
  fadedAt?: string | null;
  /** The series' DTSTART. Backdate it so past occurrences exist at all. */
  createdAt?: string;
  steps: { title: string; timerSeconds?: number | null; id?: string }[];
};

export type SeededRoutine = { id: string; title: string; stepIds: string[] };

/**
 * A routine with its steps, seeded directly.
 *
 * The hub specs need routines whose *occurrences are in the past* (to exercise
 * the grace/dimmed state) and whose DTSTART predates them. Neither is authorable
 * through the builder UI, which only ever creates a routine starting now — so
 * seeding rows is what keeps those specs about the state under test.
 */
export async function seedRoutines(
  client: Client,
  familyId: string,
  routines: SeedRoutine[]
): Promise<SeededRoutine[]> {
  const seeded: SeededRoutine[] = [];

  for (const [index, routine] of routines.entries()) {
    const { rows } = await client.query<{ id: string }>(
      `insert into routine (
         family_id, id, owner_member_id, title, icon, schedule,
         stars_per_completion, reward_enabled, faded_at, sort_order, created_at
       )
       values (
         $1, coalesce($11::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9,
         coalesce($10::timestamptz, now())
       )
       returning id`,
      [
        familyId,
        routine.ownerMemberId,
        routine.title,
        routine.icon ?? 'task_alt',
        JSON.stringify(routine.schedule),
        routine.starsPerCompletion ?? 1,
        routine.rewardEnabled ?? true,
        routine.fadedAt ?? null,
        index,
        routine.createdAt ?? null,
        routine.id ?? null,
      ]
    );

    const stepIds: string[] = [];
    for (const [order, step] of routine.steps.entries()) {
      const { rows: stepRows } = await client.query<{ id: string }>(
        `insert into routine_step (id, routine_id, title, timer_seconds, sort_order)
         values (coalesce($5::uuid, gen_random_uuid()), $1, $2, $3, $4) returning id`,
        [rows[0].id, step.title, step.timerSeconds ?? null, order, step.id ?? null]
      );
      stepIds.push(stepRows[0].id);
    }

    seeded.push({ id: rows[0].id, title: routine.title, stepIds });
  }

  return seeded;
}

/** Completions for a member, as the hub would have written them. */
export async function seedCompletions(
  client: Client,
  familyId: string,
  memberId: string,
  entries: { routineId: string; routineStepId: string; occurrenceDate: string }[]
): Promise<void> {
  for (const entry of entries) {
    await client.query(
      `insert into completion (
         family_id, member_id, routine_id, routine_step_id,
         occurrence_date, source, client_id
       )
       values ($1, $2, $3, $4, $5, 'hub', $6)
       on conflict do nothing`,
      [
        familyId,
        memberId,
        entry.routineId,
        entry.routineStepId,
        entry.occurrenceDate,
        `seed:${memberId}:${entry.routineStepId}:${entry.occurrenceDate}`,
      ]
    );
  }
}

export async function readCompletions(client: Client, familyId: string) {
  const { rows } = await client.query(
    `select routine_step_id, occurrence_date, source, client_id
       from completion where family_id = $1 order by created_at`,
    [familyId]
  );
  return rows;
}

export async function readStarLedger(client: Client, familyId: string) {
  const { rows } = await client.query(
    `select amount, reason, routine_id from star_ledger where family_id = $1 order by created_at`,
    [familyId]
  );
  return rows;
}

export async function readRoutineSteps(client: Client, routineId: string) {
  const { rows } = await client.query<{ title: string; sort_order: number }>(
    `select title, sort_order from routine_step where routine_id = $1 order by sort_order`,
    [routineId]
  );
  return rows;
}
