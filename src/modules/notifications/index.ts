/**
 * Public surface of the notifications slice (docs/architecture.md §2, §6, §8).
 * Cross-module imports go through this file only.
 *
 * Like the other feature barrels this re-exports a *client* component
 * (`PushOptIn`) alongside `server-only` reads: fine for a route file, fatal
 * for another slice's server module. Anything that needs only a table takes it
 * from `@/server/db/schema`; anything that needs only the pure policy
 * deep-imports `domain/` (the sanctioned exception in `eslint.config.mjs`).
 */

export {
  notificationPreference,
  pushSubscription,
  reminderDispatch,
  type NotificationPreference,
  type PushSubscription,
  type ReminderDispatch,
} from './schema';

export {
  DEFAULT_VAPID_SUBJECT,
  PushNotConfiguredError,
  assertPushConfigured,
  isPushConfigured,
  missingPushConfig,
  pushPublicKey,
  type PushConfig,
} from './config';

export {
  GONE_STATUS_CODES,
  MAX_CONSECUTIVE_FAILURES,
  nextSubscriptionState,
  outcomeForStatus,
  type DeliveryOutcome,
  type SubscriptionAction,
  type SubscriptionState,
} from './domain/delivery';

export {
  LOOK_AHEAD_MS,
  dueReminders,
  minutesUntil,
  type DueReminder,
  type ScannableRoutine,
} from './domain/reminder-window';

export {
  QUEUE,
  QUEUE_DEFINITIONS,
  queueName,
  reminderKey,
  type PushPayload,
  type PushSendJob,
  type QueueDefinition,
  type QueueName,
  type ReminderDispatchJob,
} from './queues';

export {
  PushEndpointConflictError,
  applyDeliveryOutcome,
  claimReminderDispatch,
  countActiveSubscriptions,
  deletePushSubscriptionByEndpoint,
  DEFAULT_NOTIFICATION_PREFERENCES,
  getFamilyLocale,
  getNotificationPreferences,
  getPushSubscription,
  getReminderRoutine,
  listActiveSubscriptions,
  listRedemptionRecipients,
  listScannableFamilies,
  trimReminderDispatch,
  upsertNotificationPreferences,
  upsertPushSubscription,
  type NotificationPreferences,
  type ScannableFamily,
  type SubscriptionUpsert,
} from './queries';

export { redemptionRequestPayload, reminderPayload, resolveLocale } from './copy';

export {
  sendToSubscription,
  webPushTransport,
  type PushAttempt,
  type PushTarget,
  type PushTransport,
} from './send';

export {
  createNotificationQueues,
  enqueuePushSend,
  enqueueReminderDispatch,
  fanOutPush,
  notifyRedemptionRequested,
  registerNotificationJobs,
  runPushSend,
  runReminderDispatch,
  runRemindersScan,
} from './jobs';

export { loadNotificationsPage, type NotificationsPageData } from './page-data';

export {
  PUSH_SUBSCRIBE_ENDPOINT,
  PushOptIn,
  decodeVapidKey,
  type PushOptInProps,
} from './ui/push-opt-in';

export { NotificationPreferencesForm } from './ui/notification-preferences-form';

export { actionFailure, idleState, type ActionState } from './action-state';

export { updateNotificationPreferencesAction } from './actions';
