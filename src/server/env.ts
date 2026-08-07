import { z } from 'zod';

/**
 * Server environment contract.
 *
 * Validation is *lazy*: nothing is checked at import time, so `next build`
 * (which imports server modules without a runtime environment) never fails on
 * missing secrets. The first read of `env.<KEY>` — i.e. at boot / first
 * request — throws if the environment is incomplete.
 */
/**
 * A base64 32-byte key. Optional at boot (see below) but never *wrong*: a
 * malformed key must fail loudly at validation, not at the first decrypt.
 */
const base64Key32 = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      return Buffer.from(value, 'base64').length === 32;
    } catch {
      return false;
    }
  }, 'TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)');

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.url('BETTER_AUTH_URL must be a valid URL'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /**
   * Google Calendar sync (M05). Optional on purpose: an install without Google
   * credentials is a *working* install with linking switched off, not a boot
   * failure — see `modules/google/config.ts`. Architecture §10 lists these as
   * boot-required; that is the deployment posture for a production install and
   * is enforced by `assertGoogleConfigured()` at the point of use instead.
   */
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  /** AES-256-GCM key for OAuth tokens at rest (§5 "Tokens encrypted at rest"). */
  TOKEN_ENCRYPTION_KEY: base64Key32.optional(),

  /**
   * Origin every Google endpoint hangs off (M17).
   *
   * Google is the *only* boundary the e2e suite is allowed to fake, and faking
   * it honestly means the app still speaks real HTTP — real OAuth redirect,
   * real token POST, real `calendarList`/`events` GETs — to a server that
   * happens to be ours. That needs exactly one seam, and this is it: unset
   * (the default, and the only possibility in production) every URL in
   * `modules/google/config.ts` resolves against Google's own origins.
   *
   * Refused in production below. A variable that can repoint the token
   * endpoint is a credential-exfiltration primitive if anything can set it on
   * a live host, so the schema — not a convention — is what keeps it to
   * development and test.
   */
  GOOGLE_API_BASE_URL: z.url().optional(),

  /**
   * VAPID keypair for Web Push (§6 "Web push (parents only)", M11).
   *
   * Optional at boot for the same reason the Google credentials are: an
   * install without a keypair is a *working* install with push switched off
   * (`isPushConfigured()` gates every entry point, and the notification
   * settings panel says which variables are missing), which is what keeps
   * `pnpm build`, the unit gate and the e2e run free of secrets (§9).
   * Architecture §10 lists these as boot-required; that is the production
   * deployment posture and is enforced by `assertPushConfigured()` at the
   * point of use instead.
   *
   * There is deliberately **no** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: a
   * `NEXT_PUBLIC_` variable is inlined at *build* time, and this repo's build
   * runs without secrets. The public key reaches the browser as a prop from a
   * server component instead (`loadNotificationsPage()`), which is one read of
   * the same env at request time and no new public surface.
   */
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  /** `mailto:` or `https:` contact the push service can reach us on (RFC 8292). */
  VAPID_SUBJECT: z.string().min(1).optional(),

  /**
   * In-process pg-boss workers (§10 "One process; jobs in-process"). Set to
   * `false` for a second web-only process, and in test runs where a worker
   * would only add nondeterminism.
   */
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

/**
 * The one cross-field rule: `GOOGLE_API_BASE_URL` may not be set in
 * production. See its field doc — repointing Google's token endpoint is how
 * you would steal a household's refresh tokens, so the boot refuses rather
 * than trusting that nobody sets it.
 */
export const envSchemaWithRules = envSchema.superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && value.GOOGLE_API_BASE_URL) {
    ctx.addIssue({
      code: 'custom',
      path: ['GOOGLE_API_BASE_URL'],
      message: 'GOOGLE_API_BASE_URL is a development/test seam and must be unset in production',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(issues: string[]) {
    super(`Invalid server environment:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

/** Pure parser — throws `EnvValidationError` when the source is incomplete. */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchemaWithRules.safeParse(source);

  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    );
  }

  return result.data;
}

let cached: Env | undefined;

/** Validates once, then memoises. Throws on every call until the env is fixed. */
export function getEnv(): Env {
  cached ??= parseEnv();
  return cached;
}

/** Test-only hook so suites can exercise a fresh validation. */
export function resetEnvCache(): void {
  cached = undefined;
}

/** Ergonomic accessor: `env.DATABASE_URL` validates on first property read. */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
