import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GOOGLE_SCOPES, channelTokenFor, missingGoogleConfig } from '@/modules/google/config';
import { authorizationUrl, createOAuthState, verifyOAuthState } from '@/modules/google/oauth';
import { QUEUE, QUEUE_DEFINITIONS, queueName } from '@/modules/google/queues';
import { resetEnvCache } from '@/server/env';

/**
 * OAuth request shape, signed state, and the job cadences (docs/architecture.md
 * §5, milestone M05). Nothing here talks to Google — the parameters *are* the
 * contract, and `access_type=offline&prompt=consent` in particular is what
 * guarantees a refresh token.
 */

const ORIGINAL = { ...process.env };

const FAMILY = '22222222-2222-4222-8222-222222222222';
const MEMBER = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://kynite:kynite@localhost:5435/kynite_test';
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.BETTER_AUTH_URL = 'https://kynite.test';
  process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  resetEnvCache();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  resetEnvCache();
});

describe('authorizationUrl', () => {
  it('requests offline access with a forced consent screen', () => {
    const url = new URL(authorizationUrl('state-value'));

    // Without both of these Google withholds the refresh token on re-consent,
    // and the link dies within the hour (§5).
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('asks for the read/write calendar scope and an identity', () => {
    const scopes = new URL(authorizationUrl('s')).searchParams.get('scope')!.split(' ');

    expect(scopes).toContain('https://www.googleapis.com/auth/calendar');
    expect(scopes).toEqual([...GOOGLE_SCOPES]);
  });

  it('points the redirect at our callback on the public origin', () => {
    const url = new URL(authorizationUrl('s'));
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://kynite.test/api/google/oauth/callback'
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('s');
  });
});

describe('signed OAuth state', () => {
  it('round-trips family and member', () => {
    const { state, nonce } = createOAuthState(FAMILY, MEMBER);
    expect(verifyOAuthState(state, nonce)).toMatchObject({ familyId: FAMILY, memberId: MEMBER });
  });

  it('rejects a tampered payload', () => {
    const { state, nonce } = createOAuthState(FAMILY, MEMBER);
    const [payload, signature] = state.split('.');
    const forged = Buffer.from(
      JSON.stringify({ familyId: 'other', memberId: MEMBER, nonce, expiresAt: Date.now() + 1000 })
    ).toString('base64url');

    expect(verifyOAuthState(`${forged}.${signature}`, nonce)).toBeNull();
    expect(payload).not.toBe(forged);
  });

  it('rejects a state whose nonce cookie does not match (cross-site injection)', () => {
    const { state } = createOAuthState(FAMILY, MEMBER);
    expect(verifyOAuthState(state, 'someone-elses-nonce')).toBeNull();
    expect(verifyOAuthState(state, null)).toBeNull();
  });

  it('expires', () => {
    const now = Date.now();
    const { state, nonce } = createOAuthState(FAMILY, MEMBER, now);
    expect(verifyOAuthState(state, nonce, now + 16 * 60 * 1000)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifyOAuthState('nonsense', 'nonce')).toBeNull();
    expect(verifyOAuthState(null, 'nonce')).toBeNull();
  });
});

describe('channel tokens', () => {
  it('are deterministic per channel and differ between channels', () => {
    expect(channelTokenFor('channel-1')).toBe(channelTokenFor('channel-1'));
    expect(channelTokenFor('channel-1')).not.toBe(channelTokenFor('channel-2'));
  });
});

describe('configuration degradation', () => {
  it('reports exactly which variables are missing', () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    resetEnvCache();

    expect(missingGoogleConfig()).toEqual(['GOOGLE_CLIENT_ID', 'TOKEN_ENCRYPTION_KEY']);
  });

  it('is configured when all three are present', () => {
    expect(missingGoogleConfig()).toEqual([]);
  });
});

describe('job registry', () => {
  it('defines every M05 queue', () => {
    expect(QUEUE_DEFINITIONS.map((definition) => definition.name).sort()).toEqual(
      [
        QUEUE.poll,
        QUEUE.pushEvent,
        QUEUE.refreshTokens,
        QUEUE.renewChannels,
        QUEUE.syncCalendar,
      ].sort()
    );
  });

  it('keeps the §5 cadences', () => {
    const cron = Object.fromEntries(
      QUEUE_DEFINITIONS.map((definition) => [definition.name, definition.cron])
    );

    expect(cron[QUEUE.poll]).toBe('*/15 * * * *');
    expect(cron[QUEUE.renewChannels]).toBe('*/30 * * * *');
    expect(cron[QUEUE.refreshTokens]).toBe('*/15 * * * *');
    // Event-driven, never scheduled.
    expect(cron[QUEUE.syncCalendar]).toBeUndefined();
    expect(cron[QUEUE.pushEvent]).toBeUndefined();
  });

  it('retries sync and push five times with backoff', () => {
    for (const name of [QUEUE.syncCalendar, QUEUE.pushEvent]) {
      const definition = QUEUE_DEFINITIONS.find((entry) => entry.name === name)!;
      expect(definition.retryLimit).toBe(5);
      expect(definition.retryBackoff).toBe(true);
    }
  });

  it('adapts the documented `:` names to pg-boss 12, which forbids the colon', () => {
    // The codebase and the docs speak in `google:sync-calendar`; pg-boss stores
    // `google.sync-calendar`. One seam, asserted so it cannot drift silently.
    expect(queueName(QUEUE.syncCalendar)).toBe('google.sync-calendar');
    for (const definition of QUEUE_DEFINITIONS) {
      expect(queueName(definition.name)).toMatch(/^[A-Za-z0-9_\-./]+$/);
    }
  });

  it('makes the calendar sync a singleton per calendar', () => {
    const definition = QUEUE_DEFINITIONS.find((entry) => entry.name === QUEUE.syncCalendar)!;
    // `stately` = at most one job per state per singletonKey, so a webhook
    // storm for one calendar collapses to "running + one queued".
    expect(definition.policy).toBe('stately');
  });
});
