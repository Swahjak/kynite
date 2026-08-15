import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * B3 review carry-forward: `resolveInput` (src/modules/calendar/actions.ts)
 * re-scopes `ownerMemberId`/`attendeeMemberIds` through `getMember(familyId, id)`
 * so a form-supplied id that names a *real* member of another family is
 * rejected rather than silently attached to this family's event. The code fix
 * landed but its test did not — this proves it against a real database, the
 * same "framework seams faked, everything else real" harness as
 * `family-authorization.test.ts`.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: { activeFamilyId?: string; memberId?: string } } | null,
}));

vi.mock('@/server/db', () => ({
  getDb: () => stubs.db,
}));

vi.mock('@/server/auth', () => ({
  getAuth: () => ({ api: { getSession: async () => stubs.session } }),
}));

// `cookies()` is mocked alongside `headers()` since M12: `getPrincipal()` falls
// back to the kiosk cookie when there is no account session, so every suite
// that resolves a principal now touches the jar. An empty one means "no paired
// device", which is what these suites assume.
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'nl' }));
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

const { createEventAction, updateEventAction } = await import('@/modules/calendar/actions');

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) data.append(key, item);
    } else {
      data.append(key, value);
    }
  }
  return data;
}

const baseEventInput = {
  title: 'Tandarts',
  description: '',
  location: '',
  startsAt: '2026-03-11T08:00',
  endsAt: '2026-03-11T09:00',
  allDay: 'false',
  eventType: 'other',
  calendarId: '',
  recurrence: 'none',
};

describe.skipIf(!databaseUrl)('event action authorization (integration)', () => {
  const { pool, db } = createTestDb();
  const { family, event } = schema;

  let ours: Household;
  let theirs: Household;

  beforeAll(async () => {
    stubs.db = db;
    ours = await seedHousehold(db, 'Ours');
    theirs = await seedHousehold(db, 'Theirs');
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, ours.familyId));
    await db.delete(family).where(eq(family.id, theirs.familyId));
    await pool.end();
  });

  beforeEach(() => {
    stubs.session = null;
  });

  function signInAs(familyId: string, memberId: string) {
    stubs.session = { session: { activeFamilyId: familyId, memberId } };
  }

  function countEvents(familyId: string) {
    return db
      .select()
      .from(event)
      .where(eq(event.familyId, familyId))
      .then((rows) => rows.length);
  }

  it('lets the owner create an event (the harness is not denying everything)', async () => {
    signInAs(ours.familyId, ours.parentId);
    const before = await countEvents(ours.familyId);

    const result = await createEventAction(
      { status: 'idle' },
      form({ ...baseEventInput, title: 'Toegestaan' })
    );

    expect(result).toEqual({ status: 'idle' });
    expect(await countEvents(ours.familyId)).toBe(before + 1);
  });

  it('does not create an event with a forged cross-family ownerMemberId', async () => {
    signInAs(ours.familyId, ours.parentId);
    const before = await countEvents(ours.familyId);

    const result = await createEventAction(
      { status: 'idle' },
      form({ ...baseEventInput, ownerMemberId: theirs.parentId })
    );

    expect(result).toEqual({ status: 'error', error: 'memberNotFound' });
    expect(await countEvents(ours.familyId), 'no event may be written').toBe(before);
  });

  it('does not create an event with a forged cross-family attendeeMemberIds entry', async () => {
    signInAs(ours.familyId, ours.parentId);
    const before = await countEvents(ours.familyId);

    const result = await createEventAction(
      { status: 'idle' },
      form({ ...baseEventInput, attendeeMemberIds: [ours.childId, theirs.childId] })
    );

    expect(result).toEqual({ status: 'error', error: 'memberNotFound' });
    expect(await countEvents(ours.familyId), 'no event may be written').toBe(before);
  });

  it('does not update an event with a forged cross-family ownerMemberId', async () => {
    signInAs(ours.familyId, ours.parentId);

    const [created] = await db
      .insert(event)
      .values({
        familyId: ours.familyId,
        title: 'Origineel',
        startsAt: new Date('2026-03-11T08:00:00.000Z'),
        endsAt: new Date('2026-03-11T09:00:00.000Z'),
        ownerMemberId: ours.parentId,
      })
      .returning();

    const result = await updateEventAction(
      { status: 'idle' },
      form({
        ...baseEventInput,
        eventId: created.id,
        title: 'Overgenomen',
        ownerMemberId: theirs.parentId,
      })
    );

    expect(result).toEqual({ status: 'error', error: 'memberNotFound' });

    const [victim] = await db.select().from(event).where(eq(event.id, created.id));
    expect(victim.title).toBe('Origineel');
    expect(victim.ownerMemberId).toBe(ours.parentId);
  });

  it('does not update an event with a forged cross-family attendeeMemberIds entry', async () => {
    signInAs(ours.familyId, ours.parentId);

    const [created] = await db
      .insert(event)
      .values({
        familyId: ours.familyId,
        title: 'Origineel',
        startsAt: new Date('2026-03-11T08:00:00.000Z'),
        endsAt: new Date('2026-03-11T09:00:00.000Z'),
        attendeeMemberIds: [ours.childId],
      })
      .returning();

    const result = await updateEventAction(
      { status: 'idle' },
      form({
        ...baseEventInput,
        eventId: created.id,
        title: 'Overgenomen',
        attendeeMemberIds: [ours.childId, theirs.childId],
      })
    );

    expect(result).toEqual({ status: 'error', error: 'memberNotFound' });

    const [victim] = await db
      .select()
      .from(event)
      .where(and(eq(event.id, created.id), eq(event.familyId, ours.familyId)));
    expect(victim.title).toBe('Origineel');
    expect(victim.attendeeMemberIds).toEqual([ours.childId]);
  });
});
