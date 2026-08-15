/**
 * Public surface of the ICS-subscription slice (docs/architecture.md §2).
 * Cross-module imports go through this file only.
 *
 * The counterpart to the Google slice for calendars nobody in the household
 * owns: a school's holidays, a sports club's fixtures — anything published as
 * an ICS/webcal feed. Read-only by construction, and stored as ordinary events
 * on an ordinary `calendar` row, which is why no view in the app knows this
 * slice exists.
 *
 * Like the other slice barrels this re-exports the slice's client component
 * alongside `server-only` reads: fine for a route file, fatal for another
 * slice's server module. Anything that needs only the table takes it from
 * `@/server/db/schema`.
 */

export { icsSubscription, type IcsSubscription } from './schema';

export {
  DEFAULT_FEED_COLOR,
  FEED_COLORS,
  feedColorHex,
  feedColorOf,
  isFeedColor,
  type FeedColor,
} from './domain/color';

export {
  checkFeedUrl,
  hostnameAsAddress,
  isBlockedAddress,
  looksLikeCalendar,
  type UrlCheck,
  type UrlRejection,
} from './domain/url';

export {
  UNTITLED,
  parseDuration,
  parseIcs,
  parseLine,
  resolveTimeZone,
  unescapeText,
  unfold,
  type ContentLine,
  type ParsedFeed,
  type ParsedFeedEvent,
} from './domain/parse';

export {
  FETCH_TIMEOUT_MS,
  MAX_FEED_BYTES,
  MAX_REDIRECTS,
  fetchFeed,
  type FetchFailure,
  type FetchOptions,
  type FetchResult,
} from './fetch';

export {
  DEFAULT_FEED_TIMEZONE,
  ingestFeed,
  listRefreshableSubscriptionIds,
  refreshSubscription,
  type RefreshFailure,
  type RefreshOutcome,
} from './refresh';

export {
  ICS_QUEUE,
  ICS_QUEUE_DEFINITIONS,
  icsQueueName,
  refreshSingletonKey,
  type IcsQueueDefinition,
  type IcsQueueName,
  type RefreshSubscriptionJob,
} from './queues';

export {
  createIcsQueues,
  enqueueSubscriptionRefresh,
  registerIcsJobs,
  runIcsRefresh,
} from './jobs';

export { getSubscription, listSubscriptions, type SubscriptionView } from './queries';

export { loadSubscriptionsPage, type SubscriptionsPageData } from './page-data';

export {
  addSubscriptionAction,
  refreshSubscriptionAction,
  removeSubscriptionAction,
  setSubscriptionEnabledAction,
} from './actions';

export { actionFailure, idleState, type ActionState } from './action-state';

export { IcsSubscriptionsPanel } from './ui/ics-subscriptions-panel';
