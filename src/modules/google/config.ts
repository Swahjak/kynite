import { createHmac } from 'node:crypto';
import { env } from '@/server/env';
import { parseEncryptionKey } from './crypto';

/**
 * Google integration configuration (docs/architecture.md §5).
 *
 * An install with no Google credentials is a working install with linking
 * switched off — every entry point asks `isGoogleConfigured()` first and the
 * settings UI explains what is missing. That keeps `pnpm build`, the unit gate
 * and the e2e run free of third-party secrets.
 */

/**
 * §5: `calendar` (read/write) is required because we manage the *calendar
 * list*, which `calendar.events` alone cannot do. `openid email profile`
 * identifies the linked account.
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
] as const;

export const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
export const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/** The OAuth callback and the push-channel address both hang off §10's public origin. */
export const OAUTH_CALLBACK_PATH = '/api/google/oauth/callback';
export const WEBHOOK_PATH = '/api/webhooks/google-calendar';

/**
 * httpOnly cookie mirroring the OAuth `state` nonce. Lives here rather than in
 * the route file because both routes need it and Next.js validates the export
 * shape of `route.ts` — an extra const export there is a build error.
 */
export const OAUTH_NONCE_COOKIE = 'kynite_google_oauth';

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  webhookAddress: string;
  encryptionKey: Buffer;
};

/** Everything that is missing, as env var names — rendered by the settings UI. */
export function missingGoogleConfig(): string[] {
  const missing: string[] = [];
  if (!env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');
  if (!env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
  if (!env.TOKEN_ENCRYPTION_KEY) missing.push('TOKEN_ENCRYPTION_KEY');
  return missing;
}

export function isGoogleConfigured(): boolean {
  return missingGoogleConfig().length === 0;
}

export class GoogleNotConfiguredError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`Google integration is not configured: missing ${missing.join(', ')}`);
    this.name = 'GoogleNotConfiguredError';
    this.missing = missing;
  }
}

export function googleConfig(): GoogleConfig {
  const missing = missingGoogleConfig();
  if (missing.length > 0) throw new GoogleNotConfiguredError(missing);

  const origin = env.BETTER_AUTH_URL.replace(/\/$/, '');

  return {
    clientId: env.GOOGLE_CLIENT_ID!,
    clientSecret: env.GOOGLE_CLIENT_SECRET!,
    redirectUri: `${origin}${OAUTH_CALLBACK_PATH}`,
    webhookAddress: `${origin}${WEBHOOK_PATH}`,
    encryptionKey: parseEncryptionKey(env.TOKEN_ENCRYPTION_KEY!),
  };
}

/**
 * The per-channel verification token Google echoes back in
 * `X-Goog-Channel-Token`.
 *
 * Derived — `HMAC(BETTER_AUTH_SECRET, 'kynite.channel:' + channelId)` —
 * rather than stored: it is unguessable without the app secret, it is
 * verifiable with one hash and no database round-trip, and it needs no
 * column that the §3 `calendar` sketch does not have. Rotating
 * `BETTER_AUTH_SECRET` invalidates every channel, which the renewal job
 * repairs within `RENEWAL_WINDOW_MS` (≤30 min, `channels.ts`).
 *
 * The `'kynite.channel:'` prefix domain-separates this HMAC from the OAuth
 * `state` signature in `oauth.ts` (`'kynite.oauth-state:'`) — both key off
 * the same `BETTER_AUTH_SECRET`, so without a distinct prefix per use a
 * signature valid for one purpose would also verify for the other.
 */
export function channelTokenFor(channelId: string): string {
  return createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update(`kynite.channel:${channelId}`)
    .digest('base64url');
}
