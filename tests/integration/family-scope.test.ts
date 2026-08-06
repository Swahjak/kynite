import { randomUUID } from 'node:crypto';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { is, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * `familyId` is not decoration: it is the single predicate that scopes every
 * query (and, later, RLS), and deleting a family must take the entire household
 * with it. This seeds one row in *every* family-scoped table, deletes the
 * family, and then walks the schema objects to prove nothing survived — so a
 * table added in a later milestone without a cascading `family_id` fails here
 * rather than leaking rows forever.
 */
describe.skipIf(!databaseUrl)('family scoping (integration)', () => {
  const { pool, db } = createTestDb();

  /** Every table in the barrel that carries `family_id`. */
  const familyScoped = (Object.values(schema) as unknown[])
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => getTableConfig(table))
    .filter((table) => table.columns.some((column) => column.name === 'family_id'))
    .map((table) => table.name);

  let household: Household;
  let bystander: Household;

  beforeAll(async () => {
    household = await seedHousehold(db, 'Doomed');
    bystander = await seedHousehold(db, 'Bystander');

    const familyId = household.familyId;

    const [device] = await db
      .insert(schema.device)
      .values({ familyId, name: 'Keukenhub', kind: 'hub' })
      .returning();
    await db.insert(schema.deviceSession).values({
      deviceId: device.id,
      tokenHash: `hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const [account] = await db
      .insert(schema.googleAccount)
      .values({
        familyId,
        ownerMemberId: household.parentId,
        googleUserId: `google-${randomUUID()}`,
        email: 'doomed@example.test',
      })
      .returning();
    const [calendar] = await db
      .insert(schema.calendar)
      .values({ familyId, googleAccountId: account.id, googleCalendarId: 'primary', summary: 'S' })
      .returning();
    const [event] = await db
      .insert(schema.event)
      .values({
        familyId,
        calendarId: calendar.id,
        googleEventId: `evt-${randomUUID()}`,
        title: 'Zwemles',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3_600_000),
      })
      .returning();

    const [reward] = await db
      .insert(schema.reward)
      .values({ familyId, title: 'Ijsje', costStars: 3, category: 'treat' })
      .returning();
    await db.insert(schema.redemption).values({
      familyId,
      memberId: household.childId,
      rewardId: reward.id,
      costStars: 3,
      createdEventId: event.id,
    });

    const [routine] = await db
      .insert(schema.routine)
      .values({
        familyId,
        ownerMemberId: household.childId,
        title: 'Ochtend',
        schedule: { rrule: 'FREQ=DAILY' },
      })
      .returning();
    const [step] = await db
      .insert(schema.routineStep)
      .values({ routineId: routine.id, title: 'Aankleden' })
      .returning();
    await db.insert(schema.completion).values({
      familyId,
      memberId: household.childId,
      routineId: routine.id,
      routineStepId: step.id,
      occurrenceDate: '2026-03-02',
      source: 'hub',
      clientId: `outbox-${randomUUID()}`,
    });
    await db.insert(schema.starLedger).values({
      familyId,
      memberId: household.childId,
      amount: 1,
      reason: 'routine',
    });

    await db.insert(schema.timer).values({
      familyId,
      memberId: household.childId,
      routineId: routine.id,
      routineStepId: step.id,
      label: 'Aankleden',
      durationSeconds: 300,
      warningLeadSeconds: 300,
      clientId: `outbox-${randomUUID()}`,
    });

    await db.insert(schema.shareLink).values({
      familyId,
      tokenHash: `hash-${randomUUID()}`,
      role: 'viewer',
      scope: { memberIds: [household.childId], surfaces: ['calendar'] },
      label: 'Oppas',
    });
    await db.insert(schema.pushSubscription).values({
      familyId,
      memberId: household.parentId,
      deviceId: device.id,
      endpoint: `https://push.example.test/${randomUUID()}`,
      p256dh: 'key',
      auth: 'auth',
    });
    await db.insert(schema.eventLog).values({
      familyId,
      type: 'completion.created',
      payload: {
        v: 1,
        id: '1',
        familyId,
        type: 'completion.created',
        at: new Date().toISOString(),
        actor: { source: 'hub' },
        entity: { id: step.id },
      },
    });
  });

  afterAll(async () => {
    await db.delete(schema.family).where(sql`id = ${bystander.familyId}`);
    await pool.end();
  });

  it('covers every family-scoped table in this fixture', async () => {
    for (const table of familyScoped) {
      const result = await db.execute(
        sql`select count(*)::int as count from ${sql.identifier(table)} where family_id = ${household.familyId}`
      );
      expect(
        (result.rows[0] as { count: number }).count,
        `${table} has no fixture row — the cascade assertion below would be vacuous`
      ).toBeGreaterThan(0);
    }
  });

  it('takes the whole household with the family, and only that household', async () => {
    const bystanderBefore = await db.execute(
      sql`select count(*)::int as count from "member" where family_id = ${bystander.familyId}`
    );

    await db.delete(schema.family).where(sql`id = ${household.familyId}`);

    for (const table of familyScoped) {
      const result = await db.execute(
        sql`select count(*)::int as count from ${sql.identifier(table)} where family_id = ${household.familyId}`
      );
      expect((result.rows[0] as { count: number }).count, `${table} kept orphan rows`).toBe(0);
    }

    // Children of family-scoped parents go too, without carrying family_id.
    const orphanSessions = await db.execute(
      sql`select count(*)::int as count from "device_session"
          where device_id not in (select id from "device")`
    );
    const orphanSteps = await db.execute(
      sql`select count(*)::int as count from "routine_step"
          where routine_id not in (select id from "routine")`
    );
    expect((orphanSessions.rows[0] as { count: number }).count).toBe(0);
    expect((orphanSteps.rows[0] as { count: number }).count).toBe(0);

    const bystanderAfter = await db.execute(
      sql`select count(*)::int as count from "member" where family_id = ${bystander.familyId}`
    );
    expect((bystanderAfter.rows[0] as { count: number }).count).toBe(
      (bystanderBefore.rows[0] as { count: number }).count
    );
  });
});
