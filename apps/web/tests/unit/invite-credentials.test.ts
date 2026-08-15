import { describe, expect, it } from 'vitest';
import { hashDeviceToken } from '@/lib/device-session';
import {
  INVITE_TOKEN_LENGTH,
  INVITE_TTL_DAYS,
  generateInviteToken,
  hashInviteToken,
  inviteExpiry,
  inviteUrlFor,
  isInviteTokenShaped,
} from '@/lib/invite-token';
import { hashShareToken } from '@/lib/share-token';
import {
  INVITABLE_ROLES,
  inviteStateOf,
  isInvitableRole,
  type InviteLifecycle,
} from '@/modules/family/domain/invite';

/**
 * The invite credential (M14) — the third bearer secret in this repo, held to
 * the same standard as `device-credentials.test.ts` and
 * `share-credentials.test.ts` before it.
 */

const NOW = new Date('2026-03-01T12:00:00.000Z');

const lifecycle = (overrides: Partial<InviteLifecycle> = {}): InviteLifecycle => ({
  claimedAt: null,
  revokedAt: null,
  expiresAt: new Date(NOW.getTime() + 60_000),
  ...overrides,
});

describe('invite tokens', () => {
  it('mints 32 bytes of base64url', () => {
    const token = generateInviteToken();

    expect(token).toHaveLength(INVITE_TOKEN_LENGTH);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('never mints the same token twice', () => {
    const tokens = new Set(Array.from({ length: 500 }, generateInviteToken));
    expect(tokens.size).toBe(500);
  });

  it('hashes deterministically, and to something that is not the token', () => {
    const token = generateInviteToken();

    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(token)).not.toContain(token);
  });

  /**
   * The reason the `invite:` prefix exists. All three credentials hash 32
   * base64url bytes; without domain separation a hash leaked from one table
   * would be a valid lookup key in another, and the invite table is the one
   * where a match would hand over an account rather than a read.
   */
  it('is domain-separated from the device and share hash spaces', () => {
    const token = generateInviteToken();

    expect(hashInviteToken(token)).not.toBe(hashDeviceToken(token));
    expect(hashInviteToken(token)).not.toBe(hashShareToken(token));
  });

  it('recognises only well-formed tokens, before any query is made', () => {
    expect(isInviteTokenShaped(generateInviteToken())).toBe(true);

    expect(isInviteTokenShaped('')).toBe(false);
    expect(isInviteTokenShaped('short')).toBe(false);
    expect(isInviteTokenShaped('a'.repeat(INVITE_TOKEN_LENGTH + 1))).toBe(false);
    // Base64 padding and the non-url alphabet are both out.
    expect(isInviteTokenShaped(`${'a'.repeat(INVITE_TOKEN_LENGTH - 1)}=`)).toBe(false);
    expect(isInviteTokenShaped(`${'a'.repeat(INVITE_TOKEN_LENGTH - 1)}/`)).toBe(false);
    expect(isInviteTokenShaped(`${'a'.repeat(INVITE_TOKEN_LENGTH - 1)}+`)).toBe(false);
  });

  it('expires seven days out', () => {
    expect(inviteExpiry(NOW).getTime() - NOW.getTime()).toBe(INVITE_TTL_DAYS * 86_400_000);
  });

  it('builds a locale-prefixed URL so next-intl never redirects a bearer secret', () => {
    expect(inviteUrlFor('https://kynite.test', 'nl', 'abc')).toBe(
      'https://kynite.test/nl/invite/abc'
    );
    expect(inviteUrlFor('https://kynite.test/', 'en', 'abc')).toBe(
      'https://kynite.test/en/invite/abc'
    );
  });
});

describe('invite lifecycle', () => {
  it('is pending while unclaimed, unrevoked and in date', () => {
    expect(inviteStateOf(lifecycle(), NOW)).toBe('pending');
  });

  it('expires on the boundary, not after it', () => {
    expect(inviteStateOf(lifecycle({ expiresAt: NOW }), NOW)).toBe('expired');
    expect(inviteStateOf(lifecycle({ expiresAt: new Date(NOW.getTime() + 1) }), NOW)).toBe(
      'pending'
    );
  });

  it('reports revoked over expired — a parent acted, and that is the more useful fact', () => {
    const invite = lifecycle({ revokedAt: NOW, expiresAt: new Date(NOW.getTime() - 1) });
    expect(inviteStateOf(invite, NOW)).toBe('revoked');
  });

  /**
   * The replay guard's display half. An invite that was accepted stays
   * `claimed` forever: revoking it afterwards cannot un-attach the login it
   * created, and letting it drift to `expired` would tell the household
   * something false about who is in it.
   */
  it('reports claimed over everything else, permanently', () => {
    const invite = lifecycle({
      claimedAt: NOW,
      revokedAt: NOW,
      expiresAt: new Date(NOW.getTime() - 86_400_000),
    });

    expect(inviteStateOf(invite, NOW)).toBe('claimed');
    expect(inviteStateOf(invite, new Date(NOW.getTime() + 86_400_000 * 365))).toBe('claimed');
  });
});

describe('who may be invited', () => {
  /**
   * The anti-escalation invariant, stated where it can be read. The invite
   * carries a member id and no role; this is the only set of roles the pointed-at
   * row is allowed to have, and `mintInvite` enforces the same predicate in SQL.
   */
  it('is adults and nobody else', () => {
    expect([...INVITABLE_ROLES]).toEqual(['adult']);

    expect(isInvitableRole('adult')).toBe(true);
    expect(isInvitableRole('owner')).toBe(false);
    expect(isInvitableRole('child')).toBe(false);
    expect(isInvitableRole('caregiver')).toBe(false);
    expect(isInvitableRole('')).toBe(false);
  });
});
