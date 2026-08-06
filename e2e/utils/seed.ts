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
  members: { displayName: string; role: string; color: string; sortOrder: number }[]
): Promise<SeededMember[]> {
  const seeded: SeededMember[] = [];

  for (const member of members) {
    const { rows } = await client.query<{ id: string }>(
      `insert into member (family_id, display_name, role, color, reward_horizon, sort_order)
       values ($1, $2, $3, $4, 'instant', $5)
       returning id`,
      [familyId, member.displayName, member.role, member.color, member.sortOrder]
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
