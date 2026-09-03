-- better-auth 1.7 upgrade: every `account` row must now carry an `issuer` —
-- the identity namespace an `account_id` is scoped to — with uniqueness
-- enforced on `(issuer, account_id)` instead of the old bare `account_id`.
--
-- The 1.7 upgrade guide's prose frames this as configurable via
-- `account.identityStrategy: "provider-id" | "issuer"`. That option does
-- **not** exist in the installed 1.7.2 API (checked against
-- `@better-auth/core`'s `init-options.d.mts` account-options block, and
-- grepped across both `better-auth`'s and `@better-auth/core`'s dist — no
-- `identityStrategy` anywhere). Issuer resolution in 1.7.2 is unconditional,
-- not strategy-gated: `better-auth/dist/db/internal-adapter.mjs` calls
-- `createLocalAccountIssuer("credential")` outright for email/password, and
-- `better-auth/dist/oauth2/account-key.mjs` calls
-- `createOAuthAccountIssuer(provider.id)` outright for any OAuth provider
-- that sets no custom `accountIssuer` on itself (this app's Google config
-- sets none — `src/server/auth.ts`). So there was no config knob to set;
-- `src/server/auth.ts`'s `account` block carries only a comment recording
-- this, not an `identityStrategy` key.
--
-- This app has only ever written two providers (`src/server/auth.ts`):
-- email/password (`provider_id = 'credential'`) and Google sign-in
-- (`provider_id = 'google'`, via `socialProviders`). Per the unconditional
-- resolution above, both `@better-auth/core/dist/db/schema/account.mjs`
-- functions give:
--   - credential  -> `local:credential`   (`createLocalAccountIssuer('credential')`)
--   - google      -> `local:oauth:google` (`createOAuthAccountIssuer('google')` —
--     this is what any OAuth/social provider gets by default, independent of
--     whether the provider itself has a real issuer URL; better-auth never
--     substitutes `https://accounts.google.com` here on its own)
--
-- Column is added nullable, backfilled, deduplicated, then locked to
-- NOT NULL + unique so the migration works against populated prod data
-- (Dockerfile migrate-on-boot), not just an empty dev database.
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint

UPDATE "account" SET "issuer" = 'local:credential' WHERE "provider_id" = 'credential';--> statement-breakpoint

UPDATE "account" SET "issuer" = 'local:oauth:google' WHERE "provider_id" = 'google';--> statement-breakpoint

-- Defence in depth: any provider this app has not written before (there
-- should be none) still gets a well-formed synthetic issuer instead of
-- being left NULL and failing the NOT NULL step below silently-mysteriously.
-- Matches core's `local:oauth:<providerId>` shape for every id but
-- 'credential', which local email/password already claimed above.
UPDATE "account" SET "issuer" = 'local:oauth:' || "provider_id" WHERE "issuer" IS NULL AND "provider_id" <> 'credential';--> statement-breakpoint

UPDATE "account" SET "issuer" = 'local:credential' WHERE "issuer" IS NULL;--> statement-breakpoint

-- Pre-flight dedup: prod never enforced uniqueness on `(provider_id,
-- account_id)`, only on `id`, so a historic double-linked row is possible
-- (e.g. a retried linkAccount write) and would make the CREATE UNIQUE INDEX
-- below fail at container boot, blocking the app.
--
-- Scoped defensively to *exact* duplicates: same `(issuer, account_id)` AND
-- same `user_id` — a harmless accidental re-insert of the same person's own
-- link, safe to collapse automatically. A duplicate `(issuer, account_id)`
-- pair belonging to *different* users is a different, security-relevant
-- situation (two accounts claiming the same external identity) — exactly
-- the guide's own "multiple users -> verify provider authority" case, which
-- it says to resolve manually, not by picking a winner in a migration. This
-- statement leaves those alone; if any exist, the unique index step below
-- fails loudly and the deploy needs a human, which is the correct outcome
-- for a genuine identity collision rather than a silent, wrong pick.
--
-- Keeps the oldest row per group (min `created_at`, `id` as a tiebreak for
-- equal timestamps). better-auth's own lookup
-- (`internal-adapter.mjs`'s `findAccountOwnerByKey`, used by sign-in) does a
-- plain `findOne` with no `ORDER BY`, so which duplicate it happened to
-- resolve to was already undefined behavior pre-upgrade; keeping the oldest
-- is the conservative choice — the row least likely to be an accidental
-- later re-insert, and (for the credential row specifically) the one
-- matching the account's original sign-up.
DELETE FROM "account" AS a
USING "account" AS newer
WHERE a."issuer" = newer."issuer"
  AND a."account_id" = newer."account_id"
  AND a."user_id" = newer."user_id"
  AND (a."created_at", a."id") > (newer."created_at", newer."id");--> statement-breakpoint

ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_id_uidx" ON "account" USING btree ("issuer","account_id");
