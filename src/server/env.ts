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
   * In-process pg-boss workers (§10 "One process; jobs in-process"). Set to
   * `false` for a second web-only process, and in test runs where a worker
   * would only add nondeterminism.
   */
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
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
  const result = envSchema.safeParse(source);

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
