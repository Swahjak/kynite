import { z } from 'zod';

/**
 * Server environment contract.
 *
 * Validation is *lazy*: nothing is checked at import time, so `next build`
 * (which imports server modules without a runtime environment) never fails on
 * missing secrets. The first read of `env.<KEY>` — i.e. at boot / first
 * request — throws if the environment is incomplete.
 */
export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.url('BETTER_AUTH_URL must be a valid URL'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
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
