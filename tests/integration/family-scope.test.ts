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
  /**
   * The doomed household's own child rows, captured at seed time.
   *
   * The orphan assertions below used to be unscoped (`device_session where
   * device_id not in (select id from device)`), which reads the *entire*
   * shared integration database — so a row left behind by any of the thirty
   * other integration files running concurrently against the same
   * `DATABASE_URL` failed this file. The cascade this test is about is this
   * family's, so the query is now this family's too. (M17 carry-forward from
   * M16.)
   */
  let doomedDeviceId: string;
  let doomedRoutineStepId: string;
  /** The login behind the doomed household's `former_member` tombstone. */
  const doomedUserId = randomUUID();

  beforeAll(async () => {
    household = await seedHousehold(db, 'Doomed');
    bystander = await seedHousehold(db, 'Bystander');

    const familyId = household.familyId;

    // M19 (F4). The tombstone a removed member leaves behind is family-scoped
    // like everything else: once the household is gone there is nothing left to
    // have been removed from, so it must not outlive the cascade either.
    await db.insert(schema.user).values({
      id: doomedUserId,
      name: 'Verwijderd',
      email: `removed-${doomedUserId.slice(0, 8)}@kynite.test`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(schema.formerMember).values({ familyId, userId: doomedUserId });

    const [device] = await db
      .insert(schema.device)
      .values({ familyId, name: 'Keukenhub', kind: 'hub' })
      .returning();
    doomedDeviceId = device.id;
    await db.insert(schema.deviceSession).values({
      deviceId: device.id,
      tokenHash: `hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    // M12. A pending pairing code names the family that minted it, so deleting
    // the family must take it with them — a code that outlived its household
    // would pair a tablet to nothing.
    await db.insert(schema.devicePairingCode).values({
      familyId,
      codeHash: `pairing-${randomUUID()}`,
      deviceName: 'Halhub',
      kind: 'hub',
      expiresAt: new Date(Date.now() + 600_000),
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
    doomedRoutineStepId = step.id;
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
    // M14. An invite is a live credential for *this* household; if it outlived
    // the family it would be a token pointing at a member row that no longer
    // exists — the cascade is what makes "delete the family" mean it.
    await db.insert(schema.memberInvite).values({
      familyId,
      memberId: household.parentId,
      tokenHash: `invite-${randomUUID()}`,
      email: `papa-${randomUUID().slice(0, 8)}@kynite.test`,
      invitedByMemberId: household.parentId,
      expiresAt: new Date(Date.now() + 604_800_000),
    });
    // M16: FR28's per-calendar colour, and the per-member notification
    // switches. Both hang off `family_id` like everything else here.
    await db.insert(schema.calendarDisplay).values({
      familyId,
      calendarId: calendar.id,
      category: 'purple',
    });
    await db.insert(schema.notificationPreference).values({
      familyId,
      memberId: household.parentId,
      routineReminders: false,
      redemptionRequests: true,
    });
    await db.insert(schema.pushSubscription).values({
      familyId,
      memberId: household.parentId,
      deviceId: device.id,
      endpoint: `https://push.example.test/${randomUUID()}`,
      p256dh: 'key',
      auth: 'auth',
    });
    await db.insert(schema.reminderDispatch).values({
      familyId,
      routineId: routine.id,
      occurrenceDate: '2026-03-02',
      memberId: household.childId,
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
    // Both households, not just the bystander. If the cascade test fails or is
    // skipped (`-t`, `.only`, a shuffled run), the doomed family used to leak
    // into the shared database forever — and a leaked household is exactly
    // what breaks the next file that counts rows it does not own. Deleting an
    // already-deleted family is a no-op.
    await db.delete(schema.family).where(sql`id = ${household.familyId}`);
    await db.delete(schema.family).where(sql`id = ${bystander.familyId}`);
    // The tombstone's login is not family-scoped and so survives the cascade
    // by design; it is this file's to clean up.
    await db.delete(schema.user).where(sql`id = ${doomedUserId}`);
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
      sql`select count(*)::int as count from "device_session" where device_id = ${doomedDeviceId}`
    );
    const orphanSteps = await db.execute(
      sql`select count(*)::int as count from "routine_step" where id = ${doomedRoutineStepId}`
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
