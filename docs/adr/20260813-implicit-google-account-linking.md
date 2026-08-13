# ADR: Implicit Google Account Linking

**Date:** 2026-08-13
**Status:** Accepted (temporary — must be revisited before public launch)
**Context:** Bug report — existing email/password user's "Continue with Google" was refused

## Decision

Enable implicit account linking for Google sign-in with `requireLocalEmailVerified: false`:

```typescript
account: {
  accountLinking: {
    enabled: true,
    trustedProviders: ['google'],
    requireLocalEmailVerified: false,
  },
},
```

## Context

A user with an existing email/password account tapped "Continue with Google" using the
same email address and was redirected back with "An account with this email address
already exists. Sign in with your password." (`errors.oauthNotLinked`).

Tracing better-auth 1.6.26's linking logic (`oauth2/link-account.mjs`) showed the refusal
is gated by two independent checks: whether the *provider* is trusted, and
`requireLocalEmailVerified` — whether the **existing local account** already has
`emailVerified: true`. `trustedProviders` alone only satisfies the first; it does nothing
to the second.

This app has no outbound mailer yet (`emailAndPassword.requireEmailVerification: false`,
per `docs/adr/...` / M10 scope), so **every local account's `emailVerified` is `false`
forever**. That means `requireLocalEmailVerified`'s default (`true`) blocks Google linking
unconditionally, for every user, regardless of `trustedProviders`. The only way to unblock
the reported sign-in is to set `requireLocalEmailVerified: false`.

## Consequences

### Accepted risk: pre-registration account takeover

With `requireLocalEmailVerified: false`, anyone can pre-register `victim@gmail.com` with a
password of their choosing today — no verification is required to create the account. If
the real owner of that address later signs in with Google, better-auth implicitly links
the Google identity onto the attacker's pre-existing user row. The attacker's password
keeps working against the now-linked account, giving them ongoing access to the real
owner's household, calendar, and data.

Google verifying its own email does not close this gap: Google vouches that the *Google*
identity is real, not that the *local* password account being merged into was created by
the same person.

### Why accepted now

- Small, closed-audience family install — sign-up is not open to the general public yet.
- Owner-accepted trade-off (2026-08-13) to unblock existing users from "Continue with
  Google" rather than leave the feature broken for them.

### MUST be revisited before any public launch

This is not a permanent posture. Once public sign-up is on the table, the takeover vector
above becomes exploitable by anyone, not just people who already know a household's email
address. Before public launch:

1. Ship email verification (M10 — outbound mailer + verify-email flow).
2. Once local accounts can actually reach `emailVerified: true`, remove the
   `requireLocalEmailVerified: false` override in `src/server/auth.ts` (or set it back to
   `true` explicitly) so implicit linking again requires the existing local account to be
   verified first.
3. Re-check whether the old `errors.oauthNotLinked` copy in `messages/*.json` is still
   reachable and still says the right thing once that path can fire again.

## Related

- Auth configuration: `src/server/auth.ts` (`account.accountLinking`)
- better-auth linking source consulted: `node_modules/better-auth/dist/oauth2/link-account.mjs` (v1.6.26)
- Verification work tracked under M10 in `docs/rebuild-milestones.md`
- Related prior decision: `docs/adr/20251225-google-only-auth.md` (superseded in practice —
  the app now supports email/password *and* Google as peers, not Google-only; not
  reconciled by this ADR)
