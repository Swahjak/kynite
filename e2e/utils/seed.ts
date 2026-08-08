import { createHash, randomBytes } from 'node:crypto';
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
    /**
     * `instant` (ages ~4–7) or `savings` (ages ~8–12) — the per-child setting
     * that decides which reward UI the hub renders (M08). Defaults to
     * `instant`, matching the column default.
     */
    rewardHorizon?: 'instant' | 'savings';
  }[]
): Promise<SeededMember[]> {
  const seeded: SeededMember[] = [];

  for (const member of members) {
    const { rows } = await client.query<{ id: string }>(
      `insert into member (family_id, id, display_name, role, color, reward_horizon, sort_order)
       values ($1, coalesce($2::uuid, gen_random_uuid()), $3, $4, $5, $7, $6)
       returning id`,
      [
        familyId,
        member.id ?? null,
        member.displayName,
        member.role,
        member.color,
        member.sortOrder,
        member.rewardHorizon ?? 'instant',
      ]
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
  /**
   * M13. The share view's busy-only assertion needs a detail field *other* than
   * the title to prove is withheld — a redacted event that still leaked
   * "Kantoor Amsterdam" would pass a title-only check.
   */
  location?: string | null;
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
         exdates, pending_sync_at, location
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
        event.location ?? null,
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

/**
 * Sets the household's language (M16).
 *
 * The wall display follows `family.locale` rather than the URL — a kiosk has
 * no person behind it to hold a preference of its own, so `requireHubDevice`
 * sends a hub on the wrong prefix to the family's. A spec that wants an
 * English board therefore has to say so about the *household*, not only about
 * the address it types.
 */
export async function setFamilyLocale(
  client: Client,
  familyId: string,
  locale: 'nl' | 'en'
): Promise<void> {
  await client.query(`update family set locale = $2, updated_at = now() where id = $1`, [
    familyId,
    locale,
  ]);
}

/**
 * Sets the household's default hub board (PRD FR28, M16) — the same field
 * `setCalendarDisplayAction`'s sibling action writes, needed here so a visual
 * spec can pin the agenda board without going through the settings UI.
 */
export async function setHubDefaultView(
  client: Client,
  familyId: string,
  view: 'day' | 'agenda'
): Promise<void> {
  await client.query(`update family set hub_default_view = $2, updated_at = now() where id = $1`, [
    familyId,
    view,
  ]);
}

/** The owner member sign-up created, so seeded events can be assigned to them. */
export async function ownerMemberOf(client: Client, familyId: string): Promise<SeededMember> {
  const { rows } = await client.query<{ id: string; display_name: string; color: string }>(
    `select id, display_name, color from member where family_id = $1 and role = 'owner' limit 1`,
    [familyId]
  );

  return { id: rows[0].id, displayName: rows[0].display_name, color: rows[0].color };
}

export type SeededMemberRow = { id: string; displayName: string; userId: string | null };

/**
 * Look a member up by name (M14).
 *
 * The invite spec cannot know the second parent's member id up front: the owner
 * creates them through the roster UI, which is the point — the flow under test
 * is "claim a row somebody else made". Reading it back by display name is how
 * the spec gets a handle on the row it then asserts about.
 */
export async function memberByDisplayName(
  client: Client,
  familyId: string,
  displayName: string
): Promise<SeededMemberRow | null> {
  const { rows } = await client.query<{ id: string; display_name: string; user_id: string | null }>(
    `select id, display_name, user_id from member where family_id = $1 and display_name = $2 limit 1`,
    [familyId, displayName]
  );

  const row = rows[0];
  return row ? { id: row.id, displayName: row.display_name, userId: row.user_id } : null;
}

/** How far out the invite for `memberId` expires — used to age one out. */
export async function expireInvite(client: Client, memberId: string): Promise<void> {
  await client.query(
    `update member_invite set expires_at = now() - interval '1 minute'
     where member_id = $1 and claimed_at is null and revoked_at is null`,
    [memberId]
  );
}

/**
 * Set a member's avatar/colour directly, standing in for an owner who filled
 * these in before (or while) an invite for that member is outstanding (F10).
 *
 * The invite flow's step 2 must be shown regardless — see the
 * `profileCompletedAt` column in `modules/family/schema.ts` and the e2e
 * assertion in `family/invite.spec.ts` this exists for.
 */
export async function presetAvatar(client: Client, memberId: string, avatarUrl: string) {
  await client.query(`update member set avatar_url = $2 where id = $1`, [memberId, avatarUrl]);
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
  /**
   * The `routine.schedule` jsonb. Either a recurring `{ rrule, … }` or M20's
   * one-off `{ kind: 'once', date, … }` — a dated chore rather than a rhythm.
   */
  schedule: {
    rrule?: string;
    timeOfDay?: string;
    graceDays?: number;
    kind?: 'recurring' | 'once';
    date?: string;
  };
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

/* -------------------------------------------------------------------------- */
/* rewards (M08)                                                              */
/* -------------------------------------------------------------------------- */

export type SeedReward = {
  /** A fixed id, for the same determinism reason as `seedMembers`. */
  id?: string;
  title: string;
  costStars: number;
  category: 'privilege' | 'experience' | 'treat';
  icon?: string;
  /** Empty (the default) puts the reward on every child's shelf. */
  availableToMemberIds?: string[];
  active?: boolean;
};

export type SeededReward = { id: string; title: string; costStars: number };

/**
 * A reward catalogue, seeded directly.
 *
 * The store specs need a shelf with a *known* spread of prices around a known
 * balance — one affordable, one just out of reach, one already asked for — and
 * authoring that through the parent dialog would be a dozen interactions per
 * spec that assert nothing about the store.
 */
export async function seedRewards(
  client: Client,
  familyId: string,
  rewards: SeedReward[]
): Promise<SeededReward[]> {
  const seeded: SeededReward[] = [];

  for (const [index, reward] of rewards.entries()) {
    const { rows } = await client.query<{ id: string }>(
      `insert into reward (
         family_id, id, title, icon, cost_stars, category,
         available_to_member_ids, active, sort_order
       )
       values ($1, coalesce($2::uuid, gen_random_uuid()), $3, $4, $5, $6, $7, $8, $9)
       returning id`,
      [
        familyId,
        reward.id ?? null,
        reward.title,
        reward.icon ?? 'redeem',
        reward.costStars,
        reward.category,
        reward.availableToMemberIds ?? [],
        reward.active ?? true,
        index,
      ]
    );
    seeded.push({ id: rows[0].id, title: reward.title, costStars: reward.costStars });
  }

  return seeded;
}

/**
 * Stars in the ledger, as the completion path would have written them.
 *
 * Always an insert, never an update: the table is append-only, and a seed
 * helper that could rewrite a row would be the first exception to a rule the
 * whole product rests on.
 */
export async function seedStars(
  client: Client,
  familyId: string,
  memberId: string,
  entries: {
    amount: number;
    reason?: string;
    note?: string;
    /**
     * When the star was awarded. The visual specs pin this so the star chart's
     * week window (seven bars ending on a pinned `?date=`) contains the same
     * awards on every run — a ledger written at `now()` would fall outside a
     * fixed window and render seven empty bars.
     */
    createdAt?: string;
  }[]
): Promise<void> {
  for (const entry of entries) {
    await client.query(
      `insert into star_ledger (family_id, member_id, amount, reason, note, created_at)
       values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()))`,
      [
        familyId,
        memberId,
        entry.amount,
        entry.reason ?? 'routine',
        entry.note ?? null,
        entry.createdAt ?? null,
      ]
    );
  }
}

export async function seedRedemptions(
  client: Client,
  familyId: string,
  memberId: string,
  entries: { rewardId: string; costStars: number; status?: string }[]
): Promise<string[]> {
  const ids: string[] = [];

  for (const entry of entries) {
    const { rows } = await client.query<{ id: string }>(
      `insert into redemption (family_id, member_id, reward_id, cost_stars, status, client_id)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        familyId,
        memberId,
        entry.rewardId,
        entry.costStars,
        entry.status ?? 'requested',
        `seed:${memberId}:${entry.rewardId}:${entry.status ?? 'requested'}`,
      ]
    );
    ids.push(rows[0].id);
  }

  return ids;
}

export async function readRedemptions(client: Client, familyId: string) {
  const { rows } = await client.query(
    `select id, member_id, reward_id, cost_stars, status, client_id
       from redemption where family_id = $1 order by requested_at`,
    [familyId]
  );
  return rows;
}

export async function readStarBalance(client: Client, memberId: string) {
  const { rows } = await client.query<{
    earned_stars: string;
    spent_stars: string;
    available_stars: string;
  }>(
    `select earned_stars, spent_stars, available_stars from member_star_balance where member_id = $1`,
    [memberId]
  );

  const row = rows[0];
  return {
    earned: Number(row?.earned_stars ?? 0),
    spent: Number(row?.spent_stars ?? 0),
    available: Number(row?.available_stars ?? 0),
  };
}

export type SeedTimer = {
  id?: string;
  label: string;
  durationSeconds: number;
  /**
   * When the countdown started, as a Postgres expression relative to `now()`
   * (e.g. `'30 seconds'` = started 30s ago). Relative on purpose: a timer
   * seeded at a fixed instant would be long over by the time a spec loads the
   * page, and the whole point is to catch the hub mid-countdown.
   */
  startedSecondsAgo?: number;
  /**
   * An absolute start instant, for specs that pin the board's clock with
   * `?now=`. Takes precedence over `startedSecondsAgo`: a start derived from
   * the *real* clock and rendered at a *pinned* one lands a fraction of a
   * second either side of the boundary and flips the last digit between runs.
   */
  startedAt?: string;
  memberId?: string | null;
  warningLeadSeconds?: number | null;
  stoppedSecondsAgo?: number | null;
};

export type SeededTimer = { id: string; label: string };

/**
 * Timers, seeded directly with a server-relative start.
 *
 * Starting one through the Controller UI would work, but the specs that matter
 * need a countdown that is *already* partway through — which no UI can author
 * without waiting in real time.
 */
export async function seedTimers(
  client: Client,
  familyId: string,
  timers: SeedTimer[]
): Promise<SeededTimer[]> {
  const seeded: SeededTimer[] = [];

  for (const timer of timers) {
    const { rows } = await client.query<{ id: string }>(
      `insert into timer (
         id, family_id, member_id, label, duration_seconds,
         started_at, stopped_at, warning_lead_seconds
       )
       values (
         coalesce($7::uuid, gen_random_uuid()), $1, $2, $3, $4,
         coalesce($9::timestamptz, now() - make_interval(secs => $5::int)),
         case when $6::int is null then null else now() - make_interval(secs => $6::int) end,
         $8
       )
       returning id`,
      [
        familyId,
        timer.memberId ?? null,
        timer.label,
        timer.durationSeconds,
        timer.startedSecondsAgo ?? 0,
        timer.stoppedSecondsAgo ?? null,
        timer.id ?? null,
        timer.warningLeadSeconds === undefined ? 300 : timer.warningLeadSeconds,
        timer.startedAt ?? null,
      ]
    );

    seeded.push({ id: rows[0].id, label: timer.label });
  }

  return seeded;
}

export async function readTimers(client: Client, familyId: string) {
  const { rows } = await client.query(
    `select id, label, duration_seconds, started_at, stopped_at, member_id, routine_step_id
       from timer where family_id = $1 order by started_at`,
    [familyId]
  );
  return rows;
}

/**
 * A share link, straight in the database (M17).
 *
 * The minting *flow* is under test once, through the settings UI, in
 * `tests/share/share-link.spec.ts`. Every other spec that just needs a link to
 * open — the share surface's axe sweep, a visual baseline — gets it from here
 * instead, so an unrelated break in the sharing settings page cannot fail them
 * and so a share spec does not have to establish an account session first.
 *
 * The hash is computed exactly as `@/lib/share-token` computes it, including
 * the `share:` domain separator; a row hashed any other way would simply never
 * resolve.
 */
export async function seedShareLink(
  client: Client,
  familyId: string,
  options: {
    role?: 'viewer' | 'contributor';
    label?: string;
    scope?: Record<string, unknown>;
    expiresAt?: string | null;
  } = {}
): Promise<{ token: string; id: string }> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(`share:${token}`).digest('hex');

  const { rows } = await client.query<{ id: string }>(
    `insert into share_link (family_id, token_hash, role, scope, label, expires_at)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [
      familyId,
      tokenHash,
      options.role ?? 'viewer',
      JSON.stringify(options.scope ?? {}),
      options.label ?? 'Oma',
      options.expiresAt ?? null,
    ]
  );

  return { token, id: rows[0].id };
}
