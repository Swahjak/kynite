/**
 * RFC 5545 reading, for feeds we did not write.
 *
 * **Why this is hand-rolled rather than `node-ical` / `ical.js`.** Both of those
 * libraries' headline feature is the one thing this codebase must not do:
 * expanding a recurring VEVENT into instances. `docs/architecture.md` §3 stores
 * an event as a *series* — RRULE/RDATE/EXDATE kept verbatim, expanded per view
 * window by `modules/calendar/domain/expand.ts` — and that model is what makes
 * custody weeks expressible and what every view, share link and hub board
 * already reads. Handing it a pre-expanded list would mean either materialising
 * a year of rows per feed (and re-materialising them forever, which is the
 * rolling-window bug this design avoids) or building a second read path beside
 * the one that exists.
 *
 * What is left once expansion is somebody else's job is small and closed:
 * unfold the lines, split parameters from values, and hand the recurrence lines
 * through **untouched** — exactly what `modules/google/domain/recurrence.ts`
 * already does for Google's `recurrence[]` array. The RRULE engine
 * (`modules/calendar/domain/rrule.ts`) is likewise already ours and already
 * hand-rolled, for the reason its own header gives.
 *
 * So this file parses *structure*, never semantics of recurrence, and the two
 * date helpers it needs come from the calendar slice's pure domain rather than
 * being re-derived here.
 */

import { parseDateTimeValue } from '@/modules/calendar/domain/rrule';
import { isValidTimeZone } from '@/modules/calendar/domain/zone';

/** One VEVENT, in the shape an `event` row wants. */
export type ParsedFeedEvent = {
  /** The feed's own `UID`. */
  uid: string;
  /**
   * The row identity: the UID, or `UID::<RECURRENCE-ID>` for an override
   * instance — a feed may carry both the master and several exceptions under
   * one UID, and they are different rows.
   */
  sourceUid: string;
  /** Set on an override instance: the UID of the series it belongs to. */
  overrideOf: string | null;
  /** The slot an override replaces (its `RECURRENCE-ID`), as an instant. */
  recurrenceOriginalStart: Date | null;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  /** Exclusive for an all-day event, exactly as the Google mapper stores it. */
  endsAt: Date;
  allDay: boolean;
  tz: string;
  /** The RRULE *value*, property name stripped, multiples `\n`-joined. */
  rrule: string | null;
  /** Whole `RDATE…` / `EXDATE…` lines, verbatim — `expand.ts` reads them as-is. */
  rdates: string[];
  exdates: string[];
};

export type ParsedFeed = {
  /** `X-WR-CALNAME`, when the publisher set one — the default subscription name. */
  name: string | null;
  /** `X-WR-TIMEZONE`, when it names a zone this runtime knows. */
  timeZone: string | null;
  events: ParsedFeedEvent[];
};

export type ParseOptions = {
  /** The zone a floating (zoneless) DTSTART is read in. */
  defaultTimeZone: string;
  /** Ceiling on events taken from one feed — a guard, not a policy. */
  maxEvents?: number;
};

const DEFAULT_MAX_EVENTS = 5_000;

/**
 * An untitled VEVENT is legal and the `title` column is NOT NULL, so name it —
 * with the same string `modules/google/domain/mapping.ts` uses, because the two
 * import paths must not produce two different words for the same absence.
 */
export const UNTITLED = '(no title)';

const MS_PER_DAY = 86_400_000;

/**
 * The Windows zone names Exchange-published feeds use instead of IANA ones.
 *
 * Only the handful a Dutch household actually meets. Anything unmapped falls
 * back to the feed's own `X-WR-TIMEZONE` and then to the family zone, which is
 * a *visible* hour-off at worst rather than a crash — and far better than
 * dropping the event.
 */
const WINDOWS_ZONES: Record<string, string> = {
  'w. europe standard time': 'Europe/Amsterdam',
  'romance standard time': 'Europe/Paris',
  'central europe standard time': 'Europe/Budapest',
  'central european standard time': 'Europe/Warsaw',
  'gmt standard time': 'Europe/London',
  utc: 'UTC',
};

/** A TZID as an IANA zone this runtime can resolve, or null. */
export function resolveTimeZone(tzid: string | undefined | null): string | null {
  const value = tzid?.trim();
  if (!value) return null;
  if (isValidTimeZone(value)) return value;

  const mapped = WINDOWS_ZONES[value.toLowerCase()];
  return mapped && isValidTimeZone(mapped) ? mapped : null;
}

/* ---------------------------------------------------------------------------
 * Lexing
 * ------------------------------------------------------------------------ */

/**
 * RFC 5545 §3.1 line unfolding: a line beginning with a space or tab continues
 * the previous one, and the whitespace is not part of the value. Publishers
 * fold at 75 octets, so any DESCRIPTION longer than a sentence arrives folded.
 */
export function unfold(text: string): string[] {
  const lines: string[] = [];

  for (const raw of text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/)) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += raw.slice(1);
      continue;
    }
    lines.push(raw);
  }

  return lines.filter((line) => line.trim() !== '');
}

export type ContentLine = {
  name: string;
  params: Record<string, string>;
  value: string;
  /** The unfolded line, byte-identical — what RDATE/EXDATE are stored as. */
  raw: string;
};

/**
 * `DTSTART;TZID=Europe/Amsterdam:20260302T083000` → name, params, value.
 *
 * The scanner tracks quoting because a parameter value may itself contain a
 * colon (`TZID="(UTC+01:00) Amsterdam"`), and splitting on the first colon
 * would then cut the line in the wrong place — the classic ICS parsing bug.
 */
export function parseLine(raw: string): ContentLine | null {
  let quoted = false;
  let colon = -1;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === '"') quoted = !quoted;
    else if (char === ':' && !quoted) {
      colon = index;
      break;
    }
  }

  if (colon === -1) return null;

  const header = raw.slice(0, colon);
  const value = raw.slice(colon + 1);

  const segments = splitParams(header);
  const name = segments[0]?.trim().toUpperCase();
  if (!name) return null;

  const params: Record<string, string> = {};
  for (const segment of segments.slice(1)) {
    const equals = segment.indexOf('=');
    if (equals === -1) continue;
    const key = segment.slice(0, equals).trim().toUpperCase();
    const parameter = segment.slice(equals + 1).trim();
    params[key] =
      parameter.startsWith('"') && parameter.endsWith('"') ? parameter.slice(1, -1) : parameter;
  }

  return { name, params, value, raw };
}

/** Split a header on `;`, ignoring separators inside a quoted parameter. */
function splitParams(header: string): string[] {
  const segments: string[] = [];
  let current = '';
  let quoted = false;

  for (const char of header) {
    if (char === '"') {
      quoted = !quoted;
      current += char;
    } else if (char === ';' && !quoted) {
      segments.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  segments.push(current);
  return segments;
}

/** RFC 5545 §3.3.11 TEXT unescaping — `\n`, `\,`, `\;`, `\\`. */
export function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, char: string) =>
    char === 'n' || char === 'N' ? '\n' : char
  );
}

/* ---------------------------------------------------------------------------
 * Dates
 * ------------------------------------------------------------------------ */

/** `20260302` → that calendar day's UTC midnight (M05's all-day convention). */
function parseDateValue(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0));
}

type ParsedMoment = { instant: Date; allDay: boolean; tz: string | null };

/**
 * One DTSTART/DTEND/RECURRENCE-ID value.
 *
 * All three forms RFC 5545 allows, and each stored the way the rest of the app
 * already stores it:
 *
 * - `VALUE=DATE` (`20260302`) → a UTC midnight carrying no zone, so `allDay`
 *   bucketing in `expand.ts` reads it as the date it says.
 * - `…Z` → an instant, zone irrelevant.
 * - floating or `TZID=` → read as wall time in that zone, via the same
 *   `fromWall` the recurrence engine walks on.
 */
function parseMoment(line: ContentLine, fallbackTimeZone: string): ParsedMoment | null {
  const value = line.value.trim();
  const isDate = line.params.VALUE?.toUpperCase() === 'DATE' || /^\d{8}$/.test(value);

  if (isDate) {
    const instant = parseDateValue(value);
    return instant ? { instant, allDay: true, tz: null } : null;
  }

  const zone = resolveTimeZone(line.params.TZID) ?? fallbackTimeZone;
  const instant = parseDateTimeValue(value, zone);
  if (!instant || Number.isNaN(instant.getTime())) return null;

  // A `…Z` value is an instant in its own right; anything else was read as wall
  // time and the zone it was read in is the one the row must remember.
  return { instant, allDay: false, tz: value.endsWith('Z') ? null : zone };
}

/** RFC 5545 DURATION (`P2DT3H10M`) in milliseconds. Null when unparseable. */
export function parseDuration(value: string): number | null {
  const match = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    value.trim().toUpperCase()
  );
  if (!match) return null;

  const [, sign, weeks, days, hours, minutes, seconds] = match;
  if (!weeks && !days && !hours && !minutes && !seconds) return null;

  const total =
    (Number(weeks ?? 0) * 7 + Number(days ?? 0)) * MS_PER_DAY +
    Number(hours ?? 0) * 3_600_000 +
    Number(minutes ?? 0) * 60_000 +
    Number(seconds ?? 0) * 1_000;

  return sign === '-' ? -total : total;
}

/* ---------------------------------------------------------------------------
 * Parsing
 * ------------------------------------------------------------------------ */

/**
 * A whole feed → the events it publishes.
 *
 * Tolerant by construction: a VEVENT we cannot make sense of (no UID, no
 * DTSTART, an unparseable date) is skipped, not thrown on. A school's export
 * with one malformed entry must still put the other two hundred on the wall —
 * and the alternative, a refresh that fails wholesale, would look to a parent
 * exactly like the school having deleted its calendar.
 */
export function parseIcs(text: string, options: ParseOptions): ParsedFeed {
  const maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
  const lines = unfold(text);

  let name: string | null = null;
  let feedTimeZone: string | null = null;
  const events: ParsedFeedEvent[] = [];

  /** The VEVENT being read, or null when we are between them. */
  let current: ContentLine[] | null = null;
  /**
   * Depth inside a sub-component of the current VEVENT (a VALARM, mostly).
   * Its properties must never be read as the event's own: a VALARM carries its
   * own DESCRIPTION and DURATION, and folding those into the event is how a
   * reminder's text ends up as the appointment's title.
   */
  let nested = 0;
  /** True while inside a VTIMEZONE, whose DTSTARTs are not events. */
  let inTimezone = false;

  for (const raw of lines) {
    const line = parseLine(raw);
    if (!line) continue;

    if (line.name === 'BEGIN') {
      const component = line.value.trim().toUpperCase();
      if (component === 'VTIMEZONE') inTimezone = true;
      else if (current) nested += 1;
      else if (component === 'VEVENT' && !inTimezone) current = [];
      continue;
    }

    if (line.name === 'END') {
      const component = line.value.trim().toUpperCase();
      if (component === 'VTIMEZONE') inTimezone = false;
      else if (nested > 0) nested -= 1;
      else if (component === 'VEVENT' && current) {
        const parsed = toEvent(current, feedTimeZone ?? options.defaultTimeZone);
        if (parsed && events.length < maxEvents) events.push(parsed);
        current = null;
      }
      continue;
    }

    if (inTimezone) continue;

    if (current) {
      if (nested === 0) current.push(line);
      continue;
    }

    // Calendar-level properties, read only outside any component.
    if (line.name === 'X-WR-CALNAME') name = unescapeText(line.value).trim() || null;
    if (line.name === 'X-WR-TIMEZONE') feedTimeZone = resolveTimeZone(line.value);
  }

  return { name, timeZone: feedTimeZone, events };
}

function first(lines: ContentLine[], name: string): ContentLine | undefined {
  return lines.find((line) => line.name === name);
}

function toEvent(lines: ContentLine[], fallbackTimeZone: string): ParsedFeedEvent | null {
  // A cancelled entry is a tombstone in the feed. Nothing local ever pushed it
  // anywhere, so it is simply not an event — and leaving it out means the
  // pruning pass in `../refresh.ts` deletes any row we imported before.
  if (first(lines, 'STATUS')?.value.trim().toUpperCase() === 'CANCELLED') return null;

  const uid = first(lines, 'UID')?.value.trim();
  const dtstart = first(lines, 'DTSTART');
  if (!uid || !dtstart) return null;

  const start = parseMoment(dtstart, fallbackTimeZone);
  if (!start) return null;

  const dtend = first(lines, 'DTEND');
  const duration = first(lines, 'DURATION');
  const end = resolveEnd(start, dtend, duration, fallbackTimeZone);

  const recurrenceId = first(lines, 'RECURRENCE-ID');
  const override = recurrenceId ? parseMoment(recurrenceId, fallbackTimeZone) : null;

  const rrules: string[] = [];
  const rdates: string[] = [];
  const exdates: string[] = [];
  for (const line of lines) {
    if (line.name === 'RRULE') rrules.push(line.value.trim());
    else if (line.name === 'RDATE') rdates.push(line.raw.trim());
    else if (line.name === 'EXDATE') exdates.push(line.raw.trim());
  }

  const summary = first(lines, 'SUMMARY');
  const description = first(lines, 'DESCRIPTION');
  const location = first(lines, 'LOCATION');

  return {
    uid,
    sourceUid: override ? `${uid}::${override.instant.toISOString()}` : uid,
    overrideOf: override ? uid : null,
    recurrenceOriginalStart: override?.instant ?? null,
    title: text(summary) ?? UNTITLED,
    description: text(description),
    location: text(location),
    startsAt: start.instant,
    endsAt: end,
    allDay: start.allDay,
    tz: start.tz ?? fallbackTimeZone,
    rrule: rrules.length > 0 ? rrules.join('\n') : null,
    rdates,
    exdates,
  };
}

function text(line: ContentLine | undefined): string | null {
  if (!line) return null;
  const value = unescapeText(line.value).trim();
  return value === '' ? null : value;
}

/**
 * The end of an event that may have stated one, implied one, or neither.
 *
 * RFC 5545's own defaults, and they differ by type: a DATE-valued DTSTART with
 * nothing else lasts one day (and the end stays *exclusive*, matching how the
 * Google mapper stores an all-day event, so `dayKeysOf` renders one day rather
 * than two); a DATE-TIME one lasts zero. An end that lands before its start
 * (a publisher bug, seen in the wild) is clamped to the start rather than
 * inverted, so the row can never claim a negative duration.
 */
function resolveEnd(
  start: ParsedMoment,
  dtend: ContentLine | undefined,
  duration: ContentLine | undefined,
  fallbackTimeZone: string
): Date {
  if (dtend) {
    const end = parseMoment(dtend, fallbackTimeZone);
    if (end) return new Date(Math.max(end.instant.getTime(), start.instant.getTime()));
  }

  if (duration) {
    const span = parseDuration(duration.value);
    if (span !== null) return new Date(start.instant.getTime() + Math.max(0, span));
  }

  return new Date(start.instant.getTime() + (start.allDay ? MS_PER_DAY : 0));
}
