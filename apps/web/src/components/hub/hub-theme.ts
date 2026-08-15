/**
 * The kiosk's theme resolution (M12), as pure functions so the rule is
 * testable without a browser.
 *
 * A wall tablet is unlike a phone: nobody carries it to bed, and nobody opens
 * a settings app to flip it. It is also the one screen in the house that is
 * *on* at 22:00 in a dark kitchen, which is exactly when a light board is
 * unpleasant. So the default is `auto`, and `auto` means:
 *
 *  1. the device's own `prefers-color-scheme`, when the OS expresses one — a
 *     tablet with a scheduled night mode has already answered the question,
 *     and second-guessing it is how you end up with a dark board at noon;
 *  2. otherwise a clock rule — dark from `DARK_FROM_HOUR` until
 *     `DARK_UNTIL_HOUR`. Cheap kiosk tablets frequently report no preference
 *     at all, and "no preference" must not silently mean "light forever".
 *
 * A parent can pin `light` or `dark` from the hub settings corner; the choice
 * is per-device (localStorage), because which room a screen is in is a
 * property of the screen, not of the household.
 */

export const HUB_THEME_STORAGE_KEY = 'kynite.hub.theme';

export const HUB_THEME_MODES = ['auto', 'light', 'dark'] as const;

export type HubThemeMode = (typeof HUB_THEME_MODES)[number];

export type ResolvedHubTheme = 'light' | 'dark';

/** 20:00 — after dinner, before anyone is reading the board for tomorrow. */
export const DARK_FROM_HOUR = 20;
/** 06:00 — the morning routine starts on a light board. */
export const DARK_UNTIL_HOUR = 6;

export function parseHubThemeMode(value: string | null | undefined): HubThemeMode {
  return HUB_THEME_MODES.includes(value as HubThemeMode) ? (value as HubThemeMode) : 'auto';
}

/** The clock half of `auto`. Wraps midnight, hence the `||`. */
export function isDarkHour(hour: number): boolean {
  return hour >= DARK_FROM_HOUR || hour < DARK_UNTIL_HOUR;
}

export function resolveHubTheme(input: {
  mode: HubThemeMode;
  /** `null` when the device expresses no preference — not the same as light. */
  systemPrefersDark: boolean | null;
  hour: number;
}): ResolvedHubTheme {
  if (input.mode !== 'auto') return input.mode;
  if (input.systemPrefersDark !== null) return input.systemPrefersDark ? 'dark' : 'light';
  return isDarkHour(input.hour) ? 'dark' : 'light';
}
