/**
 * Kiosk-only, large-format components (docs/architecture.md §2 `components/hub`).
 *
 * Everything here assumes a wall display: 6-foot type, 48px targets, no
 * pointer, no keyboard, and a session that belongs to a *device* rather than to
 * a person. Nothing in this tree may render on the parent app.
 */

export {
  DARK_FROM_HOUR,
  DARK_UNTIL_HOUR,
  HUB_THEME_MODES,
  HUB_THEME_STORAGE_KEY,
  isDarkHour,
  parseHubThemeMode,
  resolveHubTheme,
  type HubThemeMode,
  type ResolvedHubTheme,
} from './hub-theme';

export { useHubTheme } from './use-hub-theme';

export {
  DEVICE_HEARTBEAT_INTERVAL_MS,
  DEVICE_SESSION_ENDPOINT,
  DeviceSessionWatcher,
} from './device-session-watcher';

export { AmbientClock, type AmbientClockProps } from './ambient-clock';
export { ChildLauncher, type HubChild } from './child-launcher';
export { ChildTabs } from './child-tabs';
export { HubRail } from './hub-rail';
export { HUB_IDLE_TIMEOUT_MS, IdleReturn } from './idle-return';
export { HubSettings } from './hub-settings';
export { SettingsWatcher } from './settings-watcher';
export { KioskShell } from './kiosk-shell';
