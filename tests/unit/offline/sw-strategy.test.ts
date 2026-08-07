import { describe, expect, it } from 'vitest';
import {
  APP_NETWORK_TIMEOUT_SECONDS,
  HUB_NETWORK_TIMEOUT_SECONDS,
  isDataRequest,
  isHubUrl,
  isImmutableAsset,
  isNeverCached,
  strategyFor,
} from '@/components/offline/sw-strategy';

/**
 * The service worker's routing table (docs/architecture.md §6).
 *
 * §6 assigns a different strategy per surface, and getting the *match* wrong
 * silently inverts the guarantee: a hub falling into `NetworkFirst` waits
 * three seconds on a dead network before showing a board, and a parent app
 * falling into `StaleWhileRevalidate` shows yesterday's calendar. Both are
 * invisible until someone is standing in front of them, which is why the
 * predicate lives in a pure module and is tested here rather than inferred
 * from a browser.
 */

const page = (url: string) => strategyFor({ url, destination: 'document', mode: 'navigate' });

describe('service worker strategy', () => {
  describe('hub matching', () => {
    it('recognises the hub in every locale and at every depth', () => {
      expect(isHubUrl('/nl/hub')).toBe(true);
      expect(isHubUrl('/en/hub')).toBe(true);
      expect(isHubUrl('/nl/hub/timers')).toBe(true);
      expect(isHubUrl('/en/hub/routines/abc-123')).toBe(true);
      expect(isHubUrl(new URL('https://kynite.test/nl/hub/store'))).toBe(true);
    });

    it('does not treat a route that merely starts with the same letters as the hub', () => {
      // The board and a hypothetical `/nl/hubbub` are different surfaces; a
      // `startsWith('/nl/hub')` would have conflated them.
      expect(isHubUrl('/nl/hubbub')).toBe(false);
      expect(isHubUrl('/nl/today')).toBe(false);
      expect(isHubUrl('/hub')).toBe(false);
    });
  });

  describe('page requests', () => {
    it('gives the hub its own shell strategy', () => {
      expect(page('/nl/hub')).toBe('hub-shell');
      expect(page('/en/hub/timers')).toBe('hub-shell');
    });

    it('gives the parent app network-first', () => {
      expect(page('/nl/today')).toBe('app-pages');
      expect(page('/nl/calendar')).toBe('app-pages');
      expect(page('/en/settings/notifications')).toBe('app-pages');
    });

    it('keeps mobile freshness at the three seconds §6 specifies', () => {
      expect(APP_NETWORK_TIMEOUT_SECONDS).toBe(3);
    });

    it('gives the wall display a shorter fuse than the phone', () => {
      // The hub is network-first rather than §6's literal
      // `StaleWhileRevalidate` (see `HUB_NETWORK_TIMEOUT_SECONDS`): a stale
      // board carries a stale `serverNow` and would paint a wrong countdown,
      // regressing M09. The short fuse is what keeps the offline guarantee.
      expect(HUB_NETWORK_TIMEOUT_SECONDS).toBeLessThan(APP_NETWORK_TIMEOUT_SECONDS);
      expect(HUB_NETWORK_TIMEOUT_SECONDS).toBe(2);
    });
  });

  describe('assets', () => {
    it('serves hashed build output and art from the cache first', () => {
      expect(isImmutableAsset('/_next/static/chunks/main-abc123.js')).toBe(true);
      expect(isImmutableAsset('/icons/icon-192.png')).toBe(true);
      expect(isImmutableAsset('/_next/static/media/noto-sans.woff2')).toBe(true);
      expect(isImmutableAsset('/avatars/fox.svg')).toBe(true);

      expect(strategyFor({ url: '/icons/icon-512.png', destination: 'image' })).toBe('assets');
    });

    it('does not classify a page as an asset', () => {
      expect(isImmutableAsset('/nl/hub')).toBe(false);
      expect(isImmutableAsset('/api/timers')).toBe(false);
    });
  });

  describe('never cached', () => {
    it('leaves the event stream alone', () => {
      // A cached `text/event-stream` would be a hub that believes it is
      // connected forever — and §6 derives the offline indicator from exactly
      // that connection state.
      expect(isNeverCached('/api/sse')).toBe(true);
      expect(strategyFor({ url: '/api/sse', destination: '' })).toBe('network-only');
    });

    it('leaves auth, push and webhooks alone', () => {
      expect(isNeverCached('/api/auth/session')).toBe(true);
      expect(isNeverCached('/api/push/subscribe')).toBe(true);
      expect(isNeverCached('/api/webhooks/google-calendar')).toBe(true);
    });

    it('still caches the ordinary reads the hub polls', () => {
      expect(isDataRequest('/api/timers')).toBe(true);
      expect(strategyFor({ url: '/api/timers', destination: '' })).toBe('data');
      expect(isDataRequest('/api/sse')).toBe(false);
    });
  });
});
