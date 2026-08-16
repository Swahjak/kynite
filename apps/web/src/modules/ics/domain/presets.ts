import type { eventType } from '@/server/db/enums';

/**
 * The guided-add catalogue: the handful of platforms a Dutch family's school
 * agenda actually comes from, and where in each one the link is hiding.
 *
 * The problem this solves is not validation, it is *findability*. Every feed in
 * here is a real, vendor-documented subscription URL, and every one of them is
 * behind a click path a parent will not guess: Social Schools only reveals the
 * URL in the **web** app (the iOS app subscribes Apple Calendar silently and
 * never shows it), Zermelo refuses to generate one for a parent account at all,
 * Somtoday's school can switch the option off. Those three sentences are the
 * whole value of this file; the code around them is small on purpose.
 *
 * Shape and style copied from `modules/rewards/domain/economy.ts`'s
 * `REWARD_PRESETS`: a `readonly` array of records whose `key` is a translation
 * key, with no literal copy here — every label, step and caveat lives in
 * `messages/{nl,en}.json` under `ics.presets.<key>`.
 *
 * **What is deliberately absent.**
 *
 * - *Klasbord* and *SchouderCom*: both dead at the domain level (klasbord.nl
 *   returns a bare 404, schoudercom.nl now redirects to a lapsed-domain
 *   auction). A preset for either would send a parent hunting through an app
 *   that no longer exists.
 * - *A national holidays feed of any kind.* Two reasons, and the second is the
 *   decisive one. First, Rijksoverheid publishes five school years of official
 *   vakantie data with no authentication at all — and **no ICS**; it is a JSON
 *   API (`opendata.rijksoverheid.nl/v1/infotypes/schoolholidays`), so
 *   subscribing to it would mean *generating* a calendar rather than fetching
 *   one, a second ingest path this slice does not have. Second, and this is why
 *   the obvious substitute (Google's public "Feestdagen in Nederland" ICS) is
 *   not here either: **the app already has this data.** `modules/holidays`
 *   computes the eleven Dutch public holidays and `modules/calendar`'s loader
 *   already puts them on every board as read-only all-day events, and
 *   `holidays/domain/school-holidays.ts` carries the Rijksoverheid vakantie
 *   table itself. A preset here would put a second Koningsdag next to the one
 *   Kynite draws. The genuine gap is in *that* table — it covers regio zuid
 *   only and runs out after 2027/2028 — and the fix for it is to extend or
 *   generate that table from the JSON API, not to subscribe a family to a feed.
 * - *A member picker*. The verified Social Schools feed is school-wide —
 *   Zomervakantie, Eerste schooldag, Herfstvakantie — with no per-child or
 *   per-class item in it. Those events belong to the household, not to Mila, so
 *   attributing the calendar to one child would be wrong for every event in it.
 *
 * **The duplicate-UID problem, stated rather than solved.** Social Schools
 * embeds the subscriber in the UID
 * (`SocialSchools-<schoolId>-U-<userId>-R-<role>-E-<eventId>`). Two parents in
 * one household who each add *their own* link therefore import the same
 * Zomervakantie twice under two different UIDs, onto two different calendars,
 * and nothing in the ingest can tell they are the same day off. Deduplicating
 * on (summary, start, end) was considered and refused: two genuinely different
 * schools legitimately share "Studiedag" on the same date, and silently hiding
 * one household's real event is a worse failure than showing a holiday twice.
 * What is done instead is cheap and honest — `presetAlreadyAdded` warns at add
 * time that this household already follows this platform, at the one moment a
 * parent can decide to use the other parent's feed instead. See
 * `addWarnings` below.
 */

type EventType = (typeof eventType.enumValues)[number];

/**
 * Basisschool or voortgezet onderwijs. `vo` is a badge in the picker rather
 * than a filter: the VO feeds carry a caveat a parent must read before pasting
 * (a rolling two- or three-week window, lessons only), and a label is the
 * cheapest place to put "this is not the same kind of agenda".
 */
export type FeedPresetLevel = 'po' | 'vo';

export type FeedPreset = {
  /** Translation key under `ics.presets`, and the value stored on the row. */
  key: string;
  level: FeedPresetLevel;
  /**
   * Hosts the vendor's feed is served from. **Empty means "unverified", and an
   * unverified host list must not reject anything** — Parro's URL format is
   * documented nowhere, and a guess here would refuse the one link that works.
   */
  hosts: readonly string[];
  /** Path the endpoint lives under, when the vendor's endpoint is a fixed one. */
  pathPrefix?: string;
  /**
   * Query parameters that carry the subscriber's identity. Their absence is the
   * signature of a half-copied link, which is the single most common way this
   * form is going to be filled in wrongly.
   */
  requiredParams?: readonly string[];
  /**
   * What kind of thing this feed's events are (`calendar.default_type`, M23).
   * Events themselves keep `event_type` null and inherit it, so one setting
   * colours the whole agenda.
   */
  defaultType: EventType;
  /** The vendor's own instructions, for the parent who wants the screenshots. */
  helpUrl?: string;
};

export const FEED_PRESETS: readonly FeedPreset[] = [
  {
    key: 'socialSchools',
    level: 'po',
    hosts: ['api.socialschools.eu'],
    pathPrefix: '/api/v1/icalfeed',
    // `hash` is the credential and `userId` identifies whose agenda it is;
    // `roleTypeId` is present in every observed link but is not what makes the
    // link work, so it is not required here.
    requiredParams: ['schoolId', 'userId', 'hash'],
    defaultType: 'school',
    helpUrl:
      'https://help-socialschools.ovivio.com/hc/nl/articles/14084048527761-Abonneer-je-op-je-Social-Schools-agenda',
  },
  {
    key: 'parro',
    level: 'po',
    // The vendor documents the click path in detail and the URL format not at
    // all. Rejecting on a guessed host would be a bug, not a safeguard.
    hosts: [],
    defaultType: 'school',
    helpUrl: 'https://parnassys.zendesk.com/hc/nl/articles/9460836524434',
  },
  {
    key: 'magister',
    level: 'vo',
    hosts: [],
    defaultType: 'school',
    helpUrl: 'https://service.magister.nl/support/solutions/articles/101000454924-agenda-delen',
  },
  {
    key: 'somtoday',
    level: 'vo',
    hosts: [],
    defaultType: 'school',
    helpUrl: 'https://somtoday-servicedesk.zendesk.com/hc/nl/articles/6925153339025',
  },
  {
    key: 'zermelo',
    level: 'vo',
    hosts: [],
    defaultType: 'school',
    helpUrl:
      'https://support.zermelo.nl/guides/leerling-ouder/leerling/webapp-leerling/ical-link-voor-je-agenda',
  },
] as const;

/** The catalogue entry for a stored/submitted id, or null when there is none. */
export function findPreset(key: string | null | undefined): FeedPreset | null {
  if (!key) return null;
  return FEED_PRESETS.find((entry) => entry.key === key) ?? null;
}

/** Why a link does not match the platform the parent said it came from. */
export type PresetUrlRejection = 'presetHost' | 'presetIncomplete';

export type PresetUrlCheck = { ok: true } | { ok: false; error: PresetUrlRejection };

/**
 * Does this link look like the platform it was pasted under?
 *
 * Runs **after** `checkFeedUrl`, on the normalised `URL` — so `webcal://` has
 * already become `https://` and the SSRF rules have already had their say. This
 * check exists to turn two silent failures into a sentence a parent can act on:
 * pasting the wrong link entirely, and copying only the visible half of a long
 * one. It is a hint, not a security control; a preset with no verified host
 * shape checks nothing at all rather than guessing.
 */
export function checkPresetUrl(preset: FeedPreset, url: URL): PresetUrlCheck {
  if (preset.hosts.length > 0 && !preset.hosts.includes(url.hostname.toLowerCase())) {
    return { ok: false, error: 'presetHost' };
  }

  if (preset.pathPrefix && !url.pathname.startsWith(preset.pathPrefix)) {
    return { ok: false, error: 'presetHost' };
  }

  for (const param of preset.requiredParams ?? []) {
    const value = url.searchParams.get(param);
    if (value === null || value.trim() === '') {
      return { ok: false, error: 'presetIncomplete' };
    }
  }

  return { ok: true };
}

/** Something worth saying about a subscription that was nonetheless created. */
export type AddWarning = 'emptyFeed' | 'presetAlreadyAdded';

/**
 * What to say after a feed was added successfully but suspiciously.
 *
 * `emptyFeed` is the one that matters. A dead feed does not 404 — the
 * abandoned schoolvakanties mirrors return HTTP 200, `text/calendar`, and a
 * valid VCALENDAR with zero VEVENTs. `looksLikeCalendar` accepts it and
 * `refresh.ts` treats an empty feed as legitimate, which is right as a
 * steady-state rule (a school's calendar really is empty over the summer) and
 * wrong at the moment of adding: a parent who has just pasted a link and been
 * shown a green tick has no way to learn that nothing arrived. So the rule
 * stays where it is and the *add* says so out loud, at the one moment the
 * parent still has the school's page open.
 *
 * Pure, and separate from the action, so both branches are a unit test rather
 * than an integration one.
 */
export function addWarnings(params: {
  eventCount: number;
  presetAlreadySubscribed: boolean;
}): AddWarning[] {
  const warnings: AddWarning[] = [];
  if (params.eventCount === 0) warnings.push('emptyFeed');
  if (params.presetAlreadySubscribed) warnings.push('presetAlreadyAdded');
  return warnings;
}
