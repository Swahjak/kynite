import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '@/server/db/columns';
import { family } from '@/modules/family/schema';
import { calendar } from '@/modules/google/schema';

/** docs/architecture.md §3 "Calendar events" — the read-only feed half. */

/**
 * A subscribed ICS/webcal feed: the school's `vakanties`, the sports club's
 * matches, anything a third party *publishes* rather than shares.
 *
 * **The subscription does not own its events — a `calendar` row does.** This is
 * the whole design, and it is the reason this table is as thin as it is. Every
 * loader, view, filter, share-link scope and hub board in the app already reads
 * "events, joined to their calendar" (`modules/calendar/queries.ts`), and the
 * `calendar` table has held rows Google is not behind since M23's household
 * calendar. So a subscription creates one calendar row, its events hang off
 * `event.calendar_id` like any other, and *nothing per-view had to change* —
 * colour, visibility, the private/busy-only rule, the read-only marker and the
 * caregiver scope all work because they were never Google-specific.
 *
 * What that leaves here is exactly the facts a feed has and a calendar does not:
 * where to fetch it, what the last fetch returned, and why the last one failed.
 * Deliberately *absent*:
 *
 * - **name and colour** — they are `calendar.summary` and `calendar.color`, the
 *   columns the settings list and the provenance dot already read. A second
 *   copy here would be a second answer to "what is this agenda called".
 * - **an enabled flag** — `calendar.sync_enabled` is what the event query
 *   filters on and what the Google switch already means; a subscription-level
 *   duplicate could disagree with it, and the row that renders would win.
 *
 * `calendar_id` is unique and cascades: removing the calendar removes the
 * subscription, and removing the subscription (the settings action) deletes the
 * calendar, which takes its events with it. One deletion path, whichever end a
 * parent pulls.
 */
export const icsSubscription = pgTable(
  'ics_subscription',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    /** The calendar this feed fills. One per subscription, and it owns the events. */
    calendarId: uuid('calendar_id')
      .notNull()
      .references(() => calendar.id, { onDelete: 'cascade' }),
    /**
     * The https URL we fetch, already normalised (`domain/url.ts` rewrites
     * `webcal://`). Stored as the parent gave it, minus that rewrite, so the
     * settings list can show them what they pasted.
     */
    url: text('url').notNull(),
    /**
     * Which guided preset this feed was added through (`domain/presets.ts`), or
     * null for a link a parent found themselves.
     *
     * Stored rather than derived, and text rather than an enum, for the same
     * reason: it is a record of *what the parent was told*, not a property of
     * the URL. Deriving it from the host would fail for Parro (whose URL format
     * the vendor never documents) and would silently change meaning the day a
     * platform moves domain. What it buys: the settings row can re-show that
     * platform's click path when the feed breaks, and the add flow can warn
     * that this household already follows this platform — which is the only
     * cheap defence against the duplicate-UID problem described in
     * `domain/presets.ts`. An unknown value is simply ignored by `findPreset`,
     * so retiring a preset never orphans a row.
     */
    presetId: text('preset_id'),
    /**
     * Conditional-GET tokens from the last successful fetch. A school feed is
     * regenerated nightly and served with both; sending them back turns the
     * hourly refresh into a 304 for most families most of the time.
     */
    etag: text('etag'),
    lastModified: text('last_modified'),
    /** Last fetch that produced events (or a 304). Null = never succeeded. */
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    /**
     * Why the last refresh failed, as a translation key (`errors.*` in the
     * `ics` message namespace) — not a raw exception. A failing feed keeps its
     * events: a school whose server is down for an afternoon must not empty the
     * family's holiday list, so the error is a *label on the row*, and the last
     * good events stay exactly where they are.
     */
    lastError: text('last_error'),
    lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('ics_subscription_calendar_unique').on(table.calendarId),
    // Subscribing to the same feed twice would import every event twice, into
    // two calendars a parent then has to tell apart by name alone.
    uniqueIndex('ics_subscription_family_url_unique').on(table.familyId, table.url),
    index('ics_subscription_family_id_idx').on(table.familyId),
  ]
);

export type IcsSubscription = typeof icsSubscription.$inferSelect;
