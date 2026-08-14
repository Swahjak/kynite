import type { FormattingLocale } from '@/i18n/formatting-locale';

/**
 * The pure half of `DateField`/`TimeField` (`date-field.tsx`, `time-field.tsx`):
 * every conversion between the **wire** value a form submits (ISO `yyyy-MM-dd`,
 * 24-hour `HH:mm`) and the **display** text a parent reads and types, in the
 * household's own convention (`src/i18n/formatting-locale.ts`).
 *
 * It lives apart from the components because this is where the behaviour worth
 * testing is — round-trips, lenient input, the 12/24-hour split — and because
 * a `<input type="date">` gave us none of it: a native picker renders in the
 * *browser's* UI locale, which is how an en-US Chrome in a `nl-NL` household
 * ended up showing `08/21/2026` and `2:30 PM` in a Dutch dialog. There is no
 * API to override that, so the field is rebuilt as a text input and this
 * module is the part that has to be right.
 *
 * Nothing here throws: an unparseable string is `null`, and the caller keeps
 * the field in its error state rather than emitting a half-read value.
 */

/** Digit order the locale writes a date in. */
export type DateOrder = 'dmy' | 'mdy';

export type DatePattern = {
  order: DateOrder;
  separator: string;
  /** Pattern hint shown as the input's placeholder, in the locale's language. */
  placeholder: string;
};

const DATE_PATTERNS: Record<FormattingLocale, DatePattern> = {
  // Dutch writes dashes and spells the year `jjjj` (jaar), not `yyyy`.
  'nl-NL': { order: 'dmy', separator: '-', placeholder: 'dd-mm-jjjj' },
  'en-GB': { order: 'dmy', separator: '/', placeholder: 'dd/mm/yyyy' },
  'en-US': { order: 'mdy', separator: '/', placeholder: 'mm/dd/yyyy' },
};

export function datePatternFor(locale: FormattingLocale): DatePattern {
  return DATE_PATTERNS[locale] ?? DATE_PATTERNS['nl-NL'];
}

/** `en-US` is the only convention here that reads clocks in 12-hour form. */
export function uses12Hour(locale: FormattingLocale): boolean {
  return locale === 'en-US';
}

export function timePlaceholderFor(locale: FormattingLocale): string {
  if (uses12Hour(locale)) return 'hh:mm AM';
  // `uu` = uur, the Dutch pattern letter for an hour.
  return locale === 'nl-NL' ? 'uu:mm' : 'hh:mm';
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, '0');

/** Is this a real calendar day (rejects `2026-02-30`, `2026-13-01`)? */
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * A wire date (`yyyy-MM-dd`) → the text the household reads. An empty or
 * malformed value formats as `''` so a field with no value shows its
 * placeholder rather than `NaN-NaN-NaN`.
 */
export function formatDateValue(value: string, locale: FormattingLocale): string {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return '';
  const [, year, month, day] = match;
  if (!isRealDate(Number(year), Number(month), Number(day))) return '';
  const { order, separator } = datePatternFor(locale);
  const parts = order === 'dmy' ? [day, month, year] : [month, day, year];
  return parts.join(separator);
}

/**
 * Two-digit years, the way every other date field on the web resolves them:
 * `00`–`69` → 2000s, `70`–`99` → 1900s. Birthdays are the reason this exists
 * at all (`member-dialog`), and a parent born in `82` means 1982.
 */
function expandYear(raw: string): number {
  const year = Number(raw);
  if (raw.length <= 2) return year <= 69 ? 2000 + year : 1900 + year;
  return year;
}

/**
 * Text a parent typed → a wire date, or `null` when it isn't one.
 *
 * Deliberately lenient about *shape* and strict about *meaning*: separators
 * (`-`, `/`, `.`, spaces) are interchangeable, single-digit day/month and
 * two-digit years are fine, and a run of 6 or 8 digits with no separators at
 * all (`21082026`) is accepted — those are all the same intent typed faster.
 * An impossible day is not: `31-02-2026` is `null`, never silently rolled
 * forward to March 3rd.
 *
 * ISO `yyyy-MM-dd` is always accepted regardless of locale — it is
 * unambiguous (nothing writes a 4-digit day), it is the value the form is
 * already carrying, and it keeps a pasted-in wire value from reading as an
 * error.
 */
export function parseDateInput(text: string, locale: FormattingLocale): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const iso = ISO_DATE.exec(trimmed);
  if (iso) {
    const [, year, month, day] = iso;
    return isRealDate(Number(year), Number(month), Number(day)) ? trimmed : null;
  }

  const { order } = datePatternFor(locale);

  let first: string;
  let second: string;
  let third: string;

  const separated = trimmed.split(/[^0-9]+/).filter(Boolean);
  if (separated.length === 3) {
    [first, second, third] = separated;
    if (first.length > 2 || second.length > 2) return null;
    // A year is written in full or in two digits — `202` is a typo, not a year.
    if (third.length !== 2 && third.length !== 4) return null;
  } else if (separated.length === 1 && /^\d+$/.test(trimmed)) {
    // `21082026` / `210826` — no separators, fixed-width fields.
    if (trimmed.length !== 6 && trimmed.length !== 8) return null;
    first = trimmed.slice(0, 2);
    second = trimmed.slice(2, 4);
    third = trimmed.slice(4);
  } else {
    return null;
  }

  const day = order === 'dmy' ? Number(first) : Number(second);
  const month = order === 'dmy' ? Number(second) : Number(first);
  const year = expandYear(third);

  if (!isRealDate(year, month, day)) return null;
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

/**
 * A wire time (`HH:mm`, 24-hour) → the text the household reads: `14:30` in
 * `nl-NL`/`en-GB`, `2:30 PM` in `en-US`. Built by hand rather than through
 * `Intl.DateTimeFormat` because recent ICU versions put a narrow no-break
 * space before `PM`, which a parent then cannot retype.
 */
export function formatTimeValue(value: string, locale: FormattingLocale): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return '';

  if (!uses12Hour(locale)) return `${pad(hour)}:${pad(minute)}`;

  const suffix = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${pad(minute)} ${suffix}`;
}

/**
 * Text a parent typed → a wire time (`HH:mm`), or `null`.
 *
 * `930`, `9:30`, `09.30` and `9 30` are the same time; so are `2:30 pm`,
 * `230 PM` and `2:30p`. A meridiem is honoured in every locale, not just
 * `en-US` — an `en-GB` parent who types `9pm` meant 21:00, and refusing that
 * would be pedantry, not correctness. Without a meridiem the digits are read
 * as a 24-hour clock in every locale, which is the only reading that can't
 * silently be twelve hours wrong.
 */
export function parseTimeInput(text: string): string | null {
  let rest = text.trim().toLowerCase();
  if (!rest) return null;

  let meridiem: 'am' | 'pm' | null = null;
  const suffix = /\s*([ap])\.?m?\.?$/.exec(rest);
  if (suffix) {
    meridiem = suffix[1] === 'a' ? 'am' : 'pm';
    rest = rest.slice(0, suffix.index).trim();
  }

  // Any non-digit run between the digits is a separator: `.`, `:`, ` `.
  const digits = rest.split(/[^0-9]+/).filter(Boolean);
  let hour: number;
  let minute: number;

  if (digits.length === 2) {
    if (digits[0].length > 2 || digits[1].length !== 2) return null;
    hour = Number(digits[0]);
    minute = Number(digits[1]);
  } else if (digits.length === 1 && digits[0] === rest.replace(/\D/g, '')) {
    const compact = digits[0];
    if (compact.length <= 2) {
      // A bare hour: `9`, `09`, `21`.
      hour = Number(compact);
      minute = 0;
    } else if (compact.length === 3 || compact.length === 4) {
      hour = Number(compact.slice(0, compact.length - 2));
      minute = Number(compact.slice(-2));
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'am' && hour === 12) hour = 0;
    else if (meridiem === 'pm' && hour !== 12) hour += 12;
  }

  if (hour > 23 || minute > 59) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

const WIRE_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/** Splits a `datetime-local` wire value into its date and time halves. */
export function splitDateTimeValue(value: string): { date: string; time: string } {
  const match = WIRE_DATE_TIME.exec(value.trim());
  if (!match) return { date: '', time: '' };
  return { date: match[1], time: match[2] };
}

/** The inverse: both halves present → `yyyy-MM-ddTHH:mm`, otherwise `''`. */
export function joinDateTimeValue(date: string, time: string): string {
  if (!date || !time) return '';
  return `${date}T${time}`;
}
