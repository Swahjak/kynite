import { describe, expect, it } from 'vitest';
import {
  DARK_FROM_HOUR,
  DARK_UNTIL_HOUR,
  HUB_THEME_MODES,
  isDarkHour,
  parseHubThemeMode,
  resolveHubTheme,
} from '@/components/hub/hub-theme';

/**
 * The kiosk's theme rule (M12), as a pure decision.
 *
 * The thing worth pinning is not "dark mode exists" — a screenshot shows that.
 * It is that a device *expressing* a preference always beats the clock, and
 * that a device expressing *none* still ends up dark at night. Those are two
 * different states in the `matchMedia` API (`prefers-color-scheme: dark`
 * matching false, versus `no-preference` matching true), and collapsing them
 * into one boolean is the bug this file exists to prevent: a cheap kiosk tablet
 * that reports nothing would be pinned to light forever, glowing in a dark
 * kitchen at midnight.
 */

describe('hub theme resolution', () => {
  it('honours an explicit pin regardless of anything else', () => {
    for (const systemPrefersDark of [true, false, null]) {
      for (const hour of [3, 12, 23]) {
        expect(resolveHubTheme({ mode: 'light', systemPrefersDark, hour })).toBe('light');
        expect(resolveHubTheme({ mode: 'dark', systemPrefersDark, hour })).toBe('dark');
      }
    }
  });

  it('follows the device when the device has an opinion — even against the clock', () => {
    // A tablet with a scheduled night mode has already answered the question.
    expect(resolveHubTheme({ mode: 'auto', systemPrefersDark: true, hour: 12 })).toBe('dark');
    expect(resolveHubTheme({ mode: 'auto', systemPrefersDark: false, hour: 23 })).toBe('light');
  });

  it('falls back to the clock only when the device expresses no preference', () => {
    expect(resolveHubTheme({ mode: 'auto', systemPrefersDark: null, hour: 12 })).toBe('light');
    expect(resolveHubTheme({ mode: 'auto', systemPrefersDark: null, hour: 23 })).toBe('dark');
    expect(resolveHubTheme({ mode: 'auto', systemPrefersDark: null, hour: 3 })).toBe('dark');
  });

  it('wraps the dark window across midnight', () => {
    expect(isDarkHour(DARK_FROM_HOUR)).toBe(true);
    expect(isDarkHour(DARK_FROM_HOUR - 1)).toBe(false);
    expect(isDarkHour(0)).toBe(true);
    expect(isDarkHour(DARK_UNTIL_HOUR)).toBe(false);
    expect(isDarkHour(DARK_UNTIL_HOUR - 1)).toBe(true);
  });

  it('treats an unknown stored mode as auto rather than throwing', () => {
    // A wall tablet must boot. A corrupted localStorage value is not a reason
    // for a blank screen.
    expect(parseHubThemeMode(null)).toBe('auto');
    expect(parseHubThemeMode('')).toBe('auto');
    expect(parseHubThemeMode('sepia')).toBe('auto');
    for (const mode of HUB_THEME_MODES) expect(parseHubThemeMode(mode)).toBe(mode);
  });
});
