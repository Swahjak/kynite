/**
 * The PWA/offline surface (docs/architecture.md §6, milestone M11).
 *
 * Lives in `components/` rather than in a slice for the same reason
 * `@/components/realtime` does: it is browser-side infrastructure shared by
 * both route trees, not a feature with data of its own. The one exception is
 * `sw-strategy.ts` and `reload-gate.ts`, which are pure and are also imported
 * by `src/app/sw.ts` (bundled by esbuild, outside the React graph entirely).
 */

export {
  APP_NETWORK_TIMEOUT_SECONDS,
  CACHE,
  HUB_NETWORK_TIMEOUT_SECONDS,
  HUB_SHELL_MAX_AGE_SECONDS,
  LOCALES,
  isDataRequest,
  isHubUrl,
  isImmutableAsset,
  isNeverCached,
  isShareUrl,
  strategyFor,
  type CacheStrategy,
} from './sw-strategy';

export {
  IDLE_BEFORE_RELOAD_MS,
  MAX_DEFERRAL_MS,
  NIGHTLY_WINDOW,
  RELOAD_HUB_MESSAGE,
  idleMs,
  isNightly,
  reloadReason,
  shouldReloadHub,
  type ReloadGateInput,
  type ReloadReason,
} from './reload-gate';

export {
  SNAPSHOT_DB_NAME,
  SNAPSHOT_MAX_AGE_MS,
  clearSnapshot,
  isFresh,
  readSnapshot,
  saveSnapshot,
  type Snapshot,
  type SnapshotKey,
} from './schedule-cache';

export {
  CLEAR_TIMEOUT_MS,
  USER_CACHE_NAMES,
  USER_DATABASE_NAMES,
  clearUserCaches,
  clearUserCachesWithin,
} from './clear-user-caches';

export { OfflineIndicator, isOfflineStatus } from './offline-indicator';
export { SERVICE_WORKER_URL, ServiceWorkerRegistrar } from './service-worker-registrar';
export { RELOAD_CHECK_INTERVAL_MS, HubReloadController } from './hub-reload-controller';
export { useMirroredHubState, type MirroredPayload } from './hub-state-mirror';
