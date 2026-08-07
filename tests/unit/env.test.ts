import { beforeEach, describe, expect, it } from 'vitest';
import { EnvValidationError, getEnv, parseEnv, resetEnvCache } from '@/server/env';

const VALID = {
  DATABASE_URL: 'postgresql://kynite:kynite@localhost:5435/kynite_test',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  NODE_ENV: 'test',
} satisfies Record<string, string>;

describe('server env', () => {
  beforeEach(() => {
    resetEnvCache();
  });

  it('parses a complete environment', () => {
    const env = parseEnv(VALID);
    expect(env.DATABASE_URL).toBe(VALID.DATABASE_URL);
    expect(env.NODE_ENV).toBe('test');
  });

  it('throws when DATABASE_URL is unset', () => {
    const { DATABASE_URL: _omitted, ...withoutDbUrl } = VALID;
    expect(() => parseEnv(withoutDbUrl)).toThrow(EnvValidationError);
    expect(() => parseEnv(withoutDbUrl)).toThrow(/DATABASE_URL/);
  });

  it('throws when BETTER_AUTH_SECRET is too short', () => {
    expect(() => parseEnv({ ...VALID, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('throws when BETTER_AUTH_URL is not a URL', () => {
    expect(() => parseEnv({ ...VALID, BETTER_AUTH_URL: 'not-a-url' })).toThrow(/BETTER_AUTH_URL/);
  });

  it('getEnv() throws at boot when DATABASE_URL is missing from process.env', () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      expect(() => getEnv()).toThrow(/DATABASE_URL/);
    } finally {
      if (previous !== undefined) process.env.DATABASE_URL = previous;
    }
  });

  it('does not validate at import time', async () => {
    // Importing the module must never throw, otherwise `next build` breaks.
    await expect(import('@/server/env')).resolves.toBeDefined();
  });

  it('throws when GOOGLE_API_BASE_URL is set in production', () => {
    expect(() =>
      parseEnv({
        ...VALID,
        NODE_ENV: 'production',
        GOOGLE_API_BASE_URL: 'http://127.0.0.1:3102',
      })
    ).toThrow(/GOOGLE_API_BASE_URL/);
  });

  it('accepts GOOGLE_API_BASE_URL unset in production', () => {
    const env = parseEnv({ ...VALID, NODE_ENV: 'production' });
    expect(env.NODE_ENV).toBe('production');
    expect(env.GOOGLE_API_BASE_URL).toBeUndefined();
  });
});
