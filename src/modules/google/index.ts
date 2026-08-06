/**
 * Public surface of the Google slice (docs/architecture.md §2).
 * Cross-module imports go through this file only.
 */

export {
  GOOGLE_SCOPES,
  GoogleNotConfiguredError,
  OAUTH_CALLBACK_PATH,
  OAUTH_NONCE_COOKIE,
  WEBHOOK_PATH,
  channelTokenFor,
  googleConfig,
  isGoogleConfigured,
  missingGoogleConfig,
} from './config';

export {
  TOKEN_CIPHER_VERSION,
  TokenCryptoError,
  decryptToken,
  encryptToken,
  isEncryptedToken,
  parseEncryptionKey,
  safeEqual,
} from './crypto';

export { GoogleApiError, GoogleAuthError } from './domain/errors';
export { createEchoRegistry, type EchoRegistry } from './domain/echo';
export { googleEventIdFor } from './domain/ids';
export { resolveConflict, type ConflictWinner } from './domain/lww';
export {
  DEFAULT_TIMEZONE,
  fromGoogleEvent,
  isTombstone,
  toAllDayDate,
  toGoogleEvent,
  type WritableEvent,
} from './domain/mapping';
export {
  isRecurring,
  parseRecurrence,
  serializeRecurrence,
  type Recurrence,
} from './domain/recurrence';
export {
  pushEvent,
  type PushResult,
  type PushStore,
  type PushableEvent,
} from './domain/push-engine';
export { syncCalendar, type SyncResult } from './domain/sync-engine';
export {
  decideNotification,
  readNotification,
  type ChannelNotification,
  type ChannelRegistration,
  type NotificationDecision,
} from './domain/webhook';
export type {
  CalendarSyncState,
  Emitter,
  GoogleCalendarApi,
  GoogleCalendarResource,
  GoogleEventResource,
  GoogleEventWrite,
  MappedEvent,
  StoredEvent,
  SyncStore,
} from './domain/types';

export {
  QUEUE,
  QUEUE_DEFINITIONS,
  queueName,
  syncSingletonKey,
  type PushEventJob,
  type QueueDefinition,
  type QueueName,
  type SyncCalendarJob,
} from './queues';

export {
  CALENDAR_VISIBILITIES,
  GOOGLE_ACCOUNT_STATUSES,
  calendar,
  calendarVisibility,
  googleAccount,
  googleAccountStatus,
  type Calendar,
  type CalendarVisibility,
  type GoogleAccount,
  type GoogleAccountStatus,
} from './schema';

export { createGoogleCalendarApi, type AccessTokenProvider } from './api';
export {
  authorizationUrl,
  createOAuthState,
  exchangeCode,
  fetchIdentity,
  refreshAccessToken,
  verifyOAuthState,
  type GoogleIdentity,
  type OAuthState,
  type TokenResponse,
} from './oauth';

export {
  findAccountByGoogleUserId,
  findCalendarByChannelId,
  listFamilyCalendars,
  listLinkedAccounts,
  listReauthRequiredAccounts,
  type LinkedAccount,
} from './queries';

export { bootstrapAccount, linkGoogleAccount, unlinkGoogleAccount } from './linking';
export { renewExpiringChannels, stopChannel, watchCalendar } from './channels';
export {
  apiForAccount,
  discoverCalendars,
  listSyncableCalendars,
  pushEventById,
  syncCalendarById,
} from './sync';
export {
  GoogleReauthRequiredError,
  getAccessToken,
  markReauthRequired,
  refreshExpiringTokens,
} from './tokens';
export {
  createGoogleQueues,
  enqueueCalendarSync,
  // Not called anywhere yet — wired in M06, which adds the event-write
  // Server Actions that push a local edit to Google. Kept exported now so
  // that work is a call site, not a new export.
  enqueueEventPush,
  registerGoogleJobs,
} from './jobs';

export { setCalendarSyncAction, syncNowAction, unlinkGoogleAccountAction } from './actions';

export { actionFailure, idleState, type ActionState } from './action-state';

export { GoogleAccountsPanel } from './ui/google-accounts-panel';
export { GoogleReauthBanner } from './ui/google-reauth-banner';
