import { describe, expect, it } from 'vitest';
import {
  KNOWN_OAUTH_SCOPES,
  SCOPE_MESSAGE_KEYS,
  scopeMessageKey,
} from '@/modules/oauth-consent/page-data';
import en from '../../../messages/en.json';
import nl from '../../../messages/nl.json';

/**
 * Regression coverage for the prod crash this fixes: `(app)/oauth/consent`
 * built its message key as `oauth.scopes.${scope}` directly off the raw
 * scope string. next-intl treats `.` as a nesting separator, so a scope like
 * `kynite:calendar.read` resolved to a non-existent nested key and threw
 * `MISSING_MESSAGE` for every scope on the page. `scopeMessageKey` routes
 * every known scope through a dot/colon-free message key instead.
 */
describe('scopeMessageKey', () => {
  const allScopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'kynite:calendar.read',
    'kynite:calendar.write',
    'kynite:tasks.read',
    'kynite:tasks.write',
  ];

  it('resolves a safe, dot/colon-free message key for every known scope', () => {
    for (const scope of allScopes) {
      const key = scopeMessageKey(scope);
      expect(key).not.toBeNull();
      expect(key).toMatch(/^[A-Za-z]+$/);
    }
  });

  it('returns null for an unknown scope, never a raw dynamic key', () => {
    expect(scopeMessageKey('kynite:family.destroy')).toBeNull();
    expect(scopeMessageKey('')).toBeNull();
  });

  it('agrees with KNOWN_OAUTH_SCOPES on exactly the known scopes', () => {
    for (const scope of allScopes) {
      expect(KNOWN_OAUTH_SCOPES.has(scope)).toBe(true);
    }
    expect(KNOWN_OAUTH_SCOPES.has('kynite:family.destroy')).toBe(false);
  });

  it('resolves to a label present in both nl.json and en.json for every known scope', () => {
    for (const scope of allScopes) {
      const key = SCOPE_MESSAGE_KEYS[scope];
      expect(nl.oauth.scopes).toHaveProperty(key);
      expect(en.oauth.scopes).toHaveProperty(key);
      expect((nl.oauth.scopes as Record<string, string>)[key]).not.toBe('');
      expect((en.oauth.scopes as Record<string, string>)[key]).not.toBe('');
    }
  });
});
