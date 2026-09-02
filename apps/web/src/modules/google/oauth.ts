import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '@/server/env';
import {
  googleOauthAuthorizeUrl,
  googleOauthTokenUrl,
  GOOGLE_SCOPES,
  googleUserinfoUrl,
  googleConfig,
} from './config';
import { GoogleAuthError } from './domain/errors';

/**
 * Google OAuth (docs/architecture.md §5 "OAuth").
 *
 * `access_type=offline` + `prompt=consent` are not optional: without both,
 * Google withholds the refresh token on every consent after the first, and a
 * calendar link that cannot refresh is a link that dies in an hour.
 *
 * better-auth owns *login* identities; this owns the calendar-scoped tokens.
 * A parent may link a work calendar that is never a login identity (§5), so
 * the two must not share a row.
 */

export type TokenResponse = {
  accessToken: string;
  /** Absent on a refresh — Google only re-issues it on a fresh consent. */
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
  idToken: string | null;
};

export type GoogleIdentity = {
  googleUserId: string;
  email: string;
};

/**
 * The `state` parameter, signed rather than stored: `<payload>.<hmac>`.
 *
 * It carries the family and member the consent belongs to, plus a nonce that
 * is echoed in an httpOnly cookie — so the callback is protected against both
 * tampering (the HMAC) and cross-site injection of someone else's code (the
 * cookie must match). No server-side state, no cleanup job.
 */
export type OAuthState = {
  familyId: string;
  memberId: string;
  nonce: string;
  /** Epoch ms; a consent screen left open for a day is not a valid callback. */
  expiresAt: number;
  /** Where the callback sends the browser afterwards. Absent = `settings`. */
  returnTo?: OAuthReturnTo;
};

/**
 * The two places a completed consent can land (M14).
 *
 * A closed set, not a path — the state is signed but it is still a value the
 * browser carries, and "redirect to whatever string comes back" is how open
 * redirects are built. The callback maps these names to routes it already
 * knows; nothing the client sends ever becomes a `Location` header.
 */
export const OAUTH_RETURN_TARGETS = ['settings', 'onboarding'] as const;

export type OAuthReturnTo = (typeof OAUTH_RETURN_TARGETS)[number];

export function isOAuthReturnTo(value: string | null): value is OAuthReturnTo {
  return value !== null && (OAUTH_RETURN_TARGETS as readonly string[]).includes(value);
}

const STATE_TTL_MS = 15 * 60 * 1000;

// Domain-separates this signature from the channel-token HMAC in
// `config.ts` (`'kynite.channel:'`) — both derive off `BETTER_AUTH_SECRET`,
// so a distinct prefix per use keeps one signature from also verifying for
// the other's purpose.
function sign(payload: string): string {
  return createHmac('sha256', env.BETTER_AUTH_SECRET)
    .update(`kynite.oauth-state:${payload}`)
    .digest('base64url');
}

export function createOAuthState(
  familyId: string,
  memberId: string,
  options: { now?: number; returnTo?: OAuthReturnTo } = {}
): { state: string; nonce: string } {
  const now = options.now ?? Date.now();
  const nonce = randomBytes(16).toString('base64url');
  const payload: OAuthState = {
    familyId,
    memberId,
    nonce,
    expiresAt: now + STATE_TTL_MS,
    // Omitted rather than defaulted, so an existing signed state minted before
    // M14 still verifies and still lands where it always did.
    ...(options.returnTo ? { returnTo: options.returnTo } : {}),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

  return { state: `${encoded}.${sign(encoded)}`, nonce };
}

/**
 * Returns the state only when the signature, the TTL and the nonce all hold.
 *
 * `cookieNonces` is the *set* currently held in the nonce cookie (start.ts
 * appends rather than overwrites, keeping the newest few — see
 * `OAUTH_NONCE_COOKIE`), so two flows started in quick succession — a
 * double-tapped "link Google" button, or a duplicated request — each keep
 * their own nonce alive and both verify. Membership, not equality.
 */
export function verifyOAuthState(
  state: string | null,
  cookieNonces: string[],
  now: number = Date.now()
): OAuthState | null {
  if (!state || cookieNonces.length === 0) return null;

  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) return null;

  const expected = Buffer.from(sign(encoded), 'utf8');
  const actual = Buffer.from(signature, 'utf8');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let parsed: OAuthState;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthState;
  } catch {
    return null;
  }

  if (!parsed.familyId || !parsed.memberId || !parsed.nonce) return null;
  if (!parsed.expiresAt || parsed.expiresAt < now) return null;
  if (!cookieNonces.includes(parsed.nonce)) return null;

  return parsed;
}

/**
 * `loginHint` is exactly that — a hint. Google uses it to preselect an account
 * on the consent screen (the repair path for a `reauth_required` link, where
 * the parent must land on the *same* identity for the row to update in place),
 * but the user can still switch accounts, so nothing downstream may trust it.
 * Identity is read from userinfo after the exchange, as it always was.
 */
export function authorizationUrl(state: string, options: { loginHint?: string } = {}): string {
  const { clientId, redirectUri } = googleConfig();
  const url = new URL(googleOauthAuthorizeUrl());

  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  // Both are required for a guaranteed refresh token (§5).
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  if (options.loginHint) url.searchParams.set('login_hint', options.loginHint);

  return url.toString();
}

type RawTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(
  body: Record<string, string>,
  fetchImpl: typeof fetch,
  now: number
): Promise<TokenResponse> {
  const response = await fetchImpl(googleOauthTokenUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  const payload = (await response.json().catch(() => ({}))) as RawTokenResponse;

  if (!response.ok || payload.error || !payload.access_token) {
    throw new GoogleAuthError(
      payload.error ?? `token_endpoint_${response.status}`,
      payload.error_description
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    // 60s of slack: a token that expires mid-request is a failed sync.
    expiresAt: new Date(now + ((payload.expires_in ?? 3600) - 60) * 1000),
    scopes: payload.scope ? payload.scope.split(' ') : [],
    idToken: payload.id_token ?? null,
  };
}

export function exchangeCode(
  code: string,
  options: { fetchImpl?: typeof fetch; now?: number } = {}
): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = googleConfig();
  return tokenRequest(
    {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    },
    options.fetchImpl ?? fetch,
    options.now ?? Date.now()
  );
}

/** Throws `GoogleAuthError` with `isInvalidGrant` when the grant is dead (§5). */
export function refreshAccessToken(
  refreshToken: string,
  options: { fetchImpl?: typeof fetch; now?: number } = {}
): Promise<TokenResponse> {
  const { clientId, clientSecret } = googleConfig();
  return tokenRequest(
    {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    },
    options.fetchImpl ?? fetch,
    options.now ?? Date.now()
  );
}

/** Who consented. Read from the userinfo endpoint rather than an unverified JWT. */
export async function fetchIdentity(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<GoogleIdentity> {
  const response = await fetchImpl(googleUserinfoUrl(), {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new GoogleAuthError('userinfo_failed', `HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { sub?: string; email?: string };
  if (!payload.sub) throw new GoogleAuthError('userinfo_failed', 'no subject in userinfo');

  return { googleUserId: payload.sub, email: payload.email ?? '' };
}
