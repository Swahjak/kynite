import 'server-only';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/server/db';
// Tables from the schema assembly point — the same note as `./refresh.ts`.
import { calendar, event } from '@/server/db/schema';
import { feedColorOf, type FeedColor } from './domain/color';
import { redactFeedUrl } from './domain/url';
import { icsSubscription } from './schema';

/** Reads for the feed-subscription slice (docs/architecture.md §2 rule 3). */

/** One subscription as the settings list renders it. */
export type SubscriptionView = {
  id: string;
  calendarId: string;
  name: string;
  /**
   * The feed URL **masked** — host plus a four-character tail, never the token.
   *
   * A subscription URL is a bearer credential: Social Schools' `hash` +
   * `userId` open a school's agenda with no login, and Magister's own docs
   * treat rotating the link as the way to revoke access. This view is an RSC
   * payload rendered on a wall tablet, so the whole URL has no business in it —
   * what the row has to answer is "which feed is this", and the host plus a
   * tail answers that. A parent who needs the link again gets it where they got
   * it the first time: from the school's own app.
   */
  urlLabel: string;
  /** The guided preset it was added through (`domain/presets.ts`), if any. */
  presetId: string | null;
  /** A palette entry, resolved from the calendar's stored hex. */
  color: FeedColor;
  enabled: boolean;
  /** Epoch milliseconds — a `Date` reaches a client component as a string. */
  lastSyncedAt: number | null;
  /** A translation key under `ics.errors`, or null when the last fetch worked. */
  lastError: string | null;
  lastErrorAt: number | null;
  /** Live events currently imported — the number the delete dialog states. */
  eventCount: number;
};

export async function listSubscriptions(familyId: string): Promise<SubscriptionView[]> {
  const db = getDb();

  const [rows, counts] = await Promise.all([
    db
      .select({ subscription: icsSubscription, calendar })
      .from(icsSubscription)
      .innerJoin(calendar, eq(icsSubscription.calendarId, calendar.id))
      .where(eq(icsSubscription.familyId, familyId))
      .orderBy(asc(calendar.summary)),
    countFeedEvents(familyId),
  ]);

  return rows.map(({ subscription, calendar: row }) => ({
    id: subscription.id,
    calendarId: row.id,
    name: row.summary,
    urlLabel: redactFeedUrl(subscription.url),
    presetId: subscription.presetId,
    color: feedColorOf(row.color),
    enabled: row.syncEnabled,
    lastSyncedAt: subscription.lastSyncedAt?.getTime() ?? null,
    lastError: subscription.lastError,
    lastErrorAt: subscription.lastErrorAt?.getTime() ?? null,
    eventCount: counts.get(row.id) ?? 0,
  }));
}

/**
 * Live event counts per calendar, in one grouped query — the same shape (and
 * the same reason) as `modules/google/queries.ts`'s `countEventsByCalendar`:
 * the number is only ever read as "how much disappears if I remove this", and
 * the page renders every subscription at once.
 */
async function countFeedEvents(familyId: string): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({ calendarId: event.calendarId, total: count() })
    .from(event)
    .innerJoin(icsSubscription, eq(icsSubscription.calendarId, event.calendarId))
    .where(and(eq(event.familyId, familyId), isNull(event.deletedAt)))
    .groupBy(event.calendarId);

  const byCalendar = new Map<string, number>();
  for (const row of rows) {
    if (row.calendarId) byCalendar.set(row.calendarId, Number(row.total));
  }
  return byCalendar;
}

/** One subscription, family-scoped — the read behind every mutation here. */
export async function getSubscription(familyId: string, subscriptionId: string) {
  const [row] = await getDb()
    .select({ subscription: icsSubscription, calendar })
    .from(icsSubscription)
    .innerJoin(calendar, eq(icsSubscription.calendarId, calendar.id))
    .where(and(eq(icsSubscription.id, subscriptionId), eq(icsSubscription.familyId, familyId)))
    .limit(1);

  return row ?? null;
}
