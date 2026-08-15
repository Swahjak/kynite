import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
import * as schema from '@/server/db/schema';
import { env } from '@/server/env';

/**
 * better-auth (docs/architecture.md §7).
 *
 * - Email/password, plus **Google social sign-in** (M19 phase 2, owner override
 *   of the PRD's "email/password" line, 2026-08-07). The two are peers: neither
 *   is required, and an install with no Google credentials keeps working with
 *   the form alone — see `isSocialSignInConfigured()`.
 * - Sessions are 30-day sliding, httpOnly / SameSite=Lax.
 * - `activeFamilyId` + `memberId` are session columns *and* live in the signed
 *   session-cookie cache, so authorization is a cookie read rather than a join
 *   on every request. They are populated by the `session.create.before` hook,
 *   which runs after the user (and, on sign-up, the family) exists.
 *   Trade-off: session revocation (sign-out elsewhere, a killed session row)
 *   can lag up to `cookieCache.maxAge` (300s) on *other* devices still
 *   presenting the cached cookie — the device that signs out clears its own
 *   cookie immediately. Role demotion is not subject to that lag: `member:manage`
 *   and every other capability check re-reads the member row from the database
 *   on each request rather than trusting a role baked into the cookie, so a
 *   demoted role takes effect on the very next request.
 *
 * Constructed lazily: `betterAuth()` reads `env` eagerly, and importing this
 * module must stay side-effect-free for `next build`.
 */
/**
 * Whether "Continue with Google" may be offered at all.
 *
 * Deliberately *not* `modules/google`'s `isGoogleConfigured()`, which also
 * demands `TOKEN_ENCRYPTION_KEY`: that key exists to encrypt long-lived
 * *calendar* refresh tokens at rest (§5). Sign-in stores no token at all — it
 * asks for `openid email profile`, and the `account` hook in `createAuth()`
 * discards whatever comes back regardless of what Google chose to grant — so
 * requiring the calendar key here would switch off a working login for an
 * install that simply has not turned calendar sync on. Two different questions,
 * two different predicates.
 *
 * Read lazily (a function, not a const) for the same reason `createAuth()` is:
 * `env` validates on first property read, and importing this module must stay
 * side-effect-free for `next build`.
 */
export function isSocialSignInConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/**
 * Strip every OAuth credential from an `account` row on its way to the
 * database, leaving the identity columns (and the email/password `password`)
 * alone. See the `databaseHooks.account` note in `createAuth()` for why.
 *
 * `null` rather than `undefined`: an undefined field is one the adapter may
 * simply omit, which on an *update* means "leave the existing value", i.e. the
 * opposite of what this does.
 */
function withoutOAuthTokens<T extends Record<string, unknown>>(account: T) {
  return {
    ...account,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
  };
}

function createAuth() {
  const db = getDb();

  /**
   * The same client credentials the calendar integration uses
   * (`modules/google/config.ts`), and deliberately the same Google Cloud OAuth
   * client — one consent screen, one brand, one set of redirect URIs to keep
   * straight. The two flows stay separate everywhere it matters:
   *
   *  - **Scopes requested.** Sign-in takes better-auth's Google defaults, which
   *    are exactly `email profile openid` (verified in
   *    `@better-auth/core/social-providers/google`). `CALENDAR_SCOPE` is never
   *    requested here; asking a parent for read/write access to their whole
   *    calendar just to log in would be the wrong trade the first time they
   *    ever see us, and the calendar link is its own deliberate step later.
   *  - **Scopes *granted*, which is not the same thing (F2).** That same
   *    provider hard-codes `include_granted_scopes: "true"` on the
   *    authorization URL, and the option bag it accepts (`GoogleOptions`,
   *    `ProviderOptions`) has no knob to drop it or to override
   *    `additionalParams` — checked against 1.6.26's source, not guessed. With
   *    Google's incremental authorization that means a parent who has *already*
   *    linked their calendar (same OAuth client, by design, one row above) gets
   *    a sign-in access token carrying the calendar scope too. Nothing in the
   *    request asked for it and nothing in this app wants it, so it is thrown
   *    away rather than reasoned about: see the `account.create` hook below,
   *    which is what actually neutralizes this.
   *  - **Redirect URI.** better-auth's callback is
   *    `<BETTER_AUTH_URL>/api/auth/callback/google`; the calendar flow's is
   *    `<BETTER_AUTH_URL>/api/google/oauth/callback` (`OAUTH_CALLBACK_PATH`).
   *    Both must be registered in the Google Cloud console.
   *  - **Token storage.** Calendar tokens live in `google_account`, encrypted
   *    at rest by `modules/google/tokens.ts`. Sign-in tokens would live in
   *    better-auth's `account` table — except that this app stores none: the
   *    hook drops them, and `account.encryptOAuthTokens` encrypts whatever any
   *    future flow does persist. Nothing crosses over in either direction.
   *
   * Account linking: `requireLocalEmailVerified: false` below turns on
   * *implicit* linking — a Google sign-in whose address already belongs to
   * an email/password account is merged into it rather than refused. This is
   * a known, accepted risk, not an oversight: this app has no outbound
   * mailer yet (`requireEmailVerification: false`), so every local account
   * is unverified, and implicit linking means anyone who pre-registers
   * `victim@gmail.com` with a password they choose can inherit the real
   * owner's household the moment that owner later signs in with Google —
   * the attacker's password keeps working against the now-linked account.
   *
   * Owner decision, 2026-08-13: accept that risk for now and ship the
   * linking so existing email/password users aren't locked out of "Continue
   * with Google" (bug report: same-email Google sign-in was refused with
   * "account not linked"). This is a small, closed-audience family install,
   * which is the only reason the trade-off is acceptable short-term. Without
   * this, `requireLocalEmailVerified` defaults to `true` and blocks linking
   * unconditionally, since local `emailVerified` can never become `true`
   * without a verification flow — `trustedProviders` alone (which only
   * vouches for the *provider's* email, not the local account being merged
   * into) does not and cannot fix that refusal on its own.
   *
   * Retire this the moment email verification (M10) ships: once local
   * accounts can actually become `emailVerified: true`, remove the
   * `requireLocalEmailVerified: false` override below (falling back to
   * better-auth's safe default of `true`) so linking again requires the
   * existing local account to be verified. Until then the refusal's old
   * error copy stays live as a fallback — see the note on
   * `errors.oauthNotLinked` near the sign-in error mapping.
   *
   * Full write-up, accepted risk, and the MUST-fix-before-public-launch
   * condition: `docs/adr/20260813-implicit-google-account-linking.md`.
   */
  const googleSignIn = isSocialSignInConfigured()
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {};

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: 'pg', schema, transaction: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Verification mail needs an outbound mailer (M10); until then a fresh
      // account is usable immediately.
      requireEmailVerification: false,
      /**
       * The sign-up action creates the family + owner member *between* the user
       * row and the session, so the first session cookie is already scoped.
       * Auto sign-in would issue that cookie too early, with a null scope.
       */
      autoSignIn: false,
    },
    socialProviders: googleSignIn,
    account: {
      /**
       * F2, half one: anything better-auth *does* persist in `account`
       * (`access_token`, `refresh_token`, `id_token`) is AES-256-GCM encrypted
       * with `secret` before it is written, rather than stored as plaintext a
       * database dump or a backup would hand over verbatim. Defence in depth
       * behind the hook below, which is what stops the tokens existing at all.
       */
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        // Google only: it verifies the address before issuing an id token.
        // Deliberately no other provider is trusted, and `allowDifferentEmails`
        // is deliberately not set — this must stay scoped to "same email,
        // Google-verified", never "any email the provider hands us".
        trustedProviders: ['google'],
        // See the design note above `googleSignIn`: this is what actually
        // permits linking, since local accounts are never emailVerified in
        // this app. Accepted risk, revisit when M10 ships.
        requireLocalEmailVerified: false,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 },
      additionalFields: {
        activeFamilyId: { type: 'string', required: false, input: false },
        memberId: { type: 'string', required: false, input: false },
      },
    },
    advanced: {
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
    },
    databaseHooks: {
      /**
       * F2, half two: the sign-in flow stores no OAuth token, ever.
       *
       * better-auth persists the provider's tokens on the `account` row as a
       * convenience for apps that later call the provider on the user's behalf.
       * This app never does — every Google API call goes through
       * `modules/google`, against its own `google_account` row with its own
       * consent, its own scopes and its own encrypted storage — so the tokens
       * here are, at best, unused. At worst they are the F2 escalation: the
       * provider's hard-coded `include_granted_scopes` can hand back a token
       * that carries the calendar scope for a parent who linked their calendar
       * earlier, and an unused calendar-capable credential sitting in a table
       * is a credential waiting to be misused by code nobody has written yet.
       *
       * Dropping them at the write is the version of "the sign-in path cannot
       * use it" that does not depend on anyone remembering. It costs nothing:
       * the id token has already been verified by the time this runs (it is
       * what the profile is read from), and sign-in never looks at the row's
       * token columns again. `password` is untouched — that is the
       * email/password provider's column, and it lives on the same table.
       */
      account: {
        create: { before: async (account) => ({ data: withoutOAuthTokens(account) }) },
        update: { before: async (account) => ({ data: withoutOAuthTokens(account) }) },
      },
      session: {
        create: {
          /**
           * Stamp the session with the family scope at creation time. On
           * sign-up the owner member already exists (the sign-up action creates
           * family + member before the session is issued), so the very first
           * cookie is correctly scoped.
           *
           * A **social** sign-up cannot work that way: Google's callback
           * creates the user and the session in one uninterrupted pass, so
           * there is no seam to build a household in and this lookup finds
           * nothing. That session is deliberately left unscoped — an unscoped
           * session resolves to *no principal* (`principal.ts`), which is the
           * safe direction — and `(auth)/onboarding` is where the household is
           * made and a scoped session re-issued.
           */
          before: async (session) => {
            const [scope] = await db
              .select({
                familyId: schema.member.familyId,
                memberId: schema.member.id,
              })
              .from(schema.member)
              .where(eq(schema.member.userId, session.userId))
              .orderBy(schema.member.sortOrder)
              .limit(1);

            if (!scope) return;

            return {
              data: {
                ...session,
                activeFamilyId: scope.familyId,
                memberId: scope.memberId,
              },
            };
          },
        },
      },
    },
    // Must stay last: it flushes better-auth's Set-Cookie headers into the
    // Next.js cookie store so Server Actions can sign users in.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}

export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getAuth(), prop) as unknown;
  },
});

export type Session = Auth['$Infer']['Session'];
