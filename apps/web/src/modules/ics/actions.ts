'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { assertCan, type Principal } from '@/modules/family';
import { publish } from '@/modules/realtime';
import { getDb } from '@/server/db';
// Tables from the schema assembly point, not a slice barrel: a barrel
// re-exports client components, which must not enter a server mutation module.
import { calendar } from '@/server/db/schema';
import {
  actionFailure as failure,
  addedState,
  idleState,
  type ActionState,
  type AddSubscriptionState,
} from './action-state';
import { FEED_COLORS, feedColorHex } from './domain/color';
import { addWarnings, checkPresetUrl, findPreset } from './domain/presets';
import { checkFeedUrl } from './domain/url';
import { parseIcs } from './domain/parse';
import { fetchFeed } from './fetch';
import { enqueueSubscriptionRefresh } from './jobs';
import { DEFAULT_FEED_TIMEZONE, ingestFeed, refreshSubscription } from './refresh';
import { getSubscription } from './queries';
import { icsSubscription } from './schema';

/**
 * Mutations for calendar subscriptions (M25).
 *
 * Every action opens with `assertCan('ics:manage')` before any database
 * identifier is referenced — the §7 chokepoint, audited structurally by
 * `tests/unit/server-action-authorization.test.ts`. The capability grades
 * `allow` for owner and adult and `deny` for everyone else, so unlike the
 * Google actions there is no per-row ownership narrowing to do: what scopes a
 * subscription is the family it belongs to, and every read below carries
 * `familyId` in its `where`.
 */

const uuid = z.uuid();

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/**
 * The realtime `actor`. `ics:manage` denies every non-member column, so only a
 * member can reach these actions — but the principal type does not know that,
 * and inventing a `memberId` for a shape that has none would be worse than
 * naming the fallback.
 */
function actorOf(principal: Principal): { memberId?: string; source: 'mobile' | 'job' } {
  return principal.kind === 'member'
    ? { memberId: principal.memberId, source: 'mobile' }
    : { source: 'job' };
}

/** Every surface a subscribed feed's events appear on. */
async function revalidateFeeds(): Promise<void> {
  const locale = await getLocale();
  revalidatePath(`/${locale}/settings/subscriptions`);
  revalidatePath(`/${locale}/settings`);
  revalidatePath(`/${locale}/calendar`);
  revalidatePath(`/${locale}/today`);
  revalidatePath(`/${locale}/hub`);
}

const addSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  name: z.string().trim().max(120),
  color: z.enum(FEED_COLORS),
  /**
   * Which guided preset the parent came through, or '' for a link they found
   * themselves. Not an enum: an id that has since been retired must be treated
   * as "no preset" rather than as invalid input, which is what `findPreset`
   * already does.
   */
  presetId: z.string().trim().max(64),
});

/**
 * Subscribe to a feed — and prove it is one before saying yes.
 *
 * **The feed is fetched synchronously, here, on the parent's submit.** A
 * background-only import would accept a typo'd link with a green tick and fail
 * silently an hour later, on a settings page nobody has open; the one moment a
 * parent can actually fix a wrong URL is the moment they typed it. So the same
 * hardened fetcher the job uses runs first, its failure becomes the form's
 * error message, and the subscription row is only created once a real
 * `BEGIN:VCALENDAR` has come back. The events from that very fetch are then
 * stored directly (`ingestFeed`), so subscribing costs the publisher exactly
 * one request rather than two.
 *
 * **A green tick is not the same as a working feed**, which is why this returns
 * `added` with warnings rather than `idle`. A feed that answers 200 with an
 * empty VCALENDAR is a real and common failure (see `domain/presets.ts`), and
 * the moment a parent still has the school's page open is the only moment they
 * can do anything about it.
 *
 * **The URL never leaves this function whole.** It goes into the row and into
 * `fetchFeed`; it is not logged, and nothing derived from it reaches the client
 * except `redactFeedUrl`'s host-plus-tail (`queries.ts`). A Social Schools link
 * is a bearer credential for a school's agenda.
 */
export async function addSubscriptionAction(
  _previous: AddSubscriptionState,
  formData: FormData
): Promise<AddSubscriptionState> {
  const principal = await assertCan('ics:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const parsed = addSchema.safeParse({
    url: read(formData, 'url'),
    name: read(formData, 'name'),
    color: read(formData, 'color') || 'blue',
    presetId: read(formData, 'presetId'),
  });
  if (!parsed.success) return failure('invalidInput');

  const checked = checkFeedUrl(parsed.data.url);
  if (!checked.ok) return failure(checked.error);

  // The preset check runs on the *normalised* URL, so `webcal://` has already
  // become `https://` — a parent pastes what the school app gives them, and
  // that is very often the webcal form.
  const preset = findPreset(parsed.data.presetId);
  if (preset) {
    const shape = checkPresetUrl(preset, checked.url);
    if (!shape.ok) return failure(shape.error);
  }

  const url = checked.url.toString();
  const db = getDb();

  const [existing] = await db
    .select({ id: icsSubscription.id })
    .from(icsSubscription)
    .where(and(eq(icsSubscription.familyId, principal.familyId), eq(icsSubscription.url, url)))
    .limit(1);
  if (existing) return failure('duplicate');

  // Two parents each subscribing to *their own* Social Schools link import the
  // same Zomervakantie under two different UIDs, because the UID embeds the
  // subscriber. Nothing downstream can tell those apart, and deduplicating on
  // (title, start) would hide genuinely distinct events — so this is a warning
  // at the one moment a parent can choose to use the other link instead.
  const alreadyOnThisPlatform = preset
    ? await db
        .select({ id: icsSubscription.id })
        .from(icsSubscription)
        .where(
          and(
            eq(icsSubscription.familyId, principal.familyId),
            eq(icsSubscription.presetId, preset.key)
          )
        )
        .limit(1)
    : [];

  const result = await fetchFeed(url);
  if (!result.ok) return failure(result.error);
  // A first fetch cannot be conditional — there is nothing to be conditional
  // on — so a 304 here would mean the publisher ignored the request entirely.
  if (!result.body) return failure('notCalendar');

  // The name, in the order a parent would expect: what they typed, else what
  // the publisher calls its own calendar, else the host it came from — never a
  // blank row in the settings list.
  const feed = parseIcs(result.body, { defaultTimeZone: DEFAULT_FEED_TIMEZONE });
  const name = parsed.data.name || feed.name || checked.url.hostname;

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(calendar)
      .values({
        familyId: principal.familyId,
        summary: name,
        color: feedColorHex(parsed.data.color),
        timeZone: feed.timeZone,
        // Read-only, and this is the column every existing surface already
        // reads for that: the event form's destination list, the chip's
        // `editable` flag and the DnD guard all key off it (M18/M23), so a
        // subscribed event is untouchable everywhere without a line of
        // per-view work.
        writable: false,
        syncEnabled: true,
        // What the preset knows and a URL cannot: a Social Schools feed is a
        // school agenda. Events keep `event_type` null and inherit this (M23),
        // and the calendars list on `/settings` stays the place to change it.
        ...(preset ? { defaultType: preset.defaultType } : {}),
      })
      .returning();

    const [subscription] = await tx
      .insert(icsSubscription)
      .values({
        familyId: principal.familyId,
        calendarId: row.id,
        url,
        presetId: preset?.key ?? null,
      })
      .returning();

    return { calendarId: row.id, subscriptionId: subscription.id };
  });

  const { imported } = await ingestFeed({
    subscriptionId: created.subscriptionId,
    familyId: principal.familyId,
    calendarId: created.calendarId,
    body: result.body,
    etag: result.etag,
    lastModified: result.lastModified,
    defaultTimeZone: feed.timeZone,
  });

  await publish({
    familyId: principal.familyId,
    type: 'settings.updated',
    entity: { id: created.calendarId },
    actor: actorOf(principal),
    patch: { subscriptionId: created.subscriptionId },
  }).catch(() => {});

  await revalidateFeeds();
  return addedState(
    addWarnings({
      eventCount: imported,
      presetAlreadySubscribed: alreadyOnThisPlatform.length > 0,
    })
  );
}

/** "Vernieuw nu": one feed, fetched on the spot rather than at the next hour. */
export async function refreshSubscriptionAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('ics:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const subscriptionId = read(formData, 'subscriptionId');
  if (!uuid.safeParse(subscriptionId).success) return failure('invalidInput');

  const row = await getSubscription(principal.familyId, subscriptionId);
  if (!row) return failure('subscriptionNotFound');

  const outcome = await refreshSubscription(row.subscription.id);

  await revalidateFeeds();
  // The failure is already on the row (and rendered under the subscription),
  // but returning it as well is what puts it next to the button that was just
  // pressed — a parent fixing a broken link should not have to notice that a
  // line further down the card changed.
  return outcome.status === 'failed' ? failure(outcome.error) : idleState;
}

/**
 * Pause or resume a feed.
 *
 * `calendar.sync_enabled` is the switch, which is the same column the Google
 * toggle flips and the same one `listEvents` filters on — so a paused feed
 * disappears from every board immediately.
 *
 * Unlike the Google toggle, pausing here does **not** delete the imported
 * events. It can afford not to: a feed is fully re-derivable from its URL, the
 * events are already invisible while paused, and keeping them makes resuming
 * instant instead of a round trip to a school's server. (The Google switch
 * deletes because a mute that leaves a colleague's diary on the wall is the bug
 * it was fixing — a different problem, since nothing here can be un-hidden by a
 * racing sync pass.)
 */
export async function setSubscriptionEnabledAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('ics:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const subscriptionId = read(formData, 'subscriptionId');
  const enabled = read(formData, 'enabled') === 'true';
  if (!uuid.safeParse(subscriptionId).success) return failure('invalidInput');

  const row = await getSubscription(principal.familyId, subscriptionId);
  if (!row) return failure('subscriptionNotFound');

  await getDb()
    .update(calendar)
    .set({ syncEnabled: enabled, updatedAt: new Date() })
    .where(eq(calendar.id, row.calendar.id));

  if (enabled) await enqueueSubscriptionRefresh(row.subscription.id).catch(() => null);

  await publish({
    familyId: principal.familyId,
    type: 'settings.updated',
    entity: { id: row.calendar.id },
    actor: actorOf(principal),
    patch: { subscriptionId: row.subscription.id, enabled },
  }).catch(() => {});

  await revalidateFeeds();
  return idleState;
}

/**
 * Unsubscribe: the calendar row goes, and its events with it.
 *
 * The delete targets the **calendar**, not the subscription, and the direction
 * matters. `ics_subscription.calendar_id` cascades from it and so does
 * `event.calendar_id`, so one statement removes the feed, its events and its
 * place in every calendar list — with no orphan calendar left behind for a
 * parent to wonder about. The confirmation in the UI states the event count
 * first, read from the same query that renders the row.
 */
export async function removeSubscriptionAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('ics:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const subscriptionId = read(formData, 'subscriptionId');
  if (!uuid.safeParse(subscriptionId).success) return failure('invalidInput');

  const row = await getSubscription(principal.familyId, subscriptionId);
  if (!row) return failure('subscriptionNotFound');

  await getDb()
    .delete(calendar)
    .where(and(eq(calendar.id, row.calendar.id), eq(calendar.familyId, principal.familyId)));

  await publish({
    familyId: principal.familyId,
    type: 'settings.updated',
    entity: { id: row.calendar.id },
    actor: actorOf(principal),
    patch: { subscriptionId: row.subscription.id, removed: true },
  }).catch(() => {});

  await revalidateFeeds();
  return idleState;
}
