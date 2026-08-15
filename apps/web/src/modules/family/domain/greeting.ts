/**
 * Time-of-day greeting (M18).
 *
 * Pure, so the boundaries are a test rather than an opinion. The two cuts are
 * 12:00 and 18:00, which is where Dutch and English agree
 * (morgen/middag/avond, morning/afternoon/evening) — and the late hours fold
 * back into "evening" rather than growing a fourth "night" bucket: a parent
 * looking at the family board at 01:00 is still finishing their evening, and a
 * greeting that told them otherwise would be the app having an opinion about
 * their bedtime.
 */

export type GreetingSlot = 'morning' | 'afternoon' | 'evening';

export const AFTERNOON_FROM_HOUR = 12;
export const EVENING_FROM_HOUR = 18;

/** `hour` is 0–23 **in the household's own timezone**, never the server's. */
export function greetingSlotFor(hour: number): GreetingSlot {
  if (hour >= EVENING_FROM_HOUR) return 'evening';
  if (hour >= AFTERNOON_FROM_HOUR) return 'afternoon';
  // Before midnight-to-noon includes the small hours, deliberately (see above).
  return hour < 5 ? 'evening' : 'morning';
}

/**
 * The name a greeting uses: the first word of a display name.
 *
 * "Sofie de Vries" → "Sofie". A member whose display name is already one word
 * is unchanged, and a blank one yields an empty string, which the caller reads
 * as "no greeting" rather than rendering "Goedemorgen, ".
 */
export function firstNameOf(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? '';
}

/** The hour of `instant` as it reads on a clock in `timeZone`. */
export function hourIn(instant: Date, timeZone: string): number {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).format(instant);

  const hour = Number.parseInt(formatted, 10);
  // `24` is a legal `hour12: false` rendering of midnight in some ICU builds.
  return Number.isFinite(hour) ? hour % 24 : 0;
}
