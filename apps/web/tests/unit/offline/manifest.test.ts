import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

/**
 * Installability, as a contract rather than as a screenshot (M11: "Files
 * exist: `src/app/sw.ts`, web app manifest; both hub and parent app are
 * installable").
 *
 * Lighthouse dropped its PWA category in v12, so "Lighthouse PWA
 * installability passes" no longer names a runnable check. What it *meant* is
 * a short list of manifest properties every Chromium install prompt requires,
 * and those are checkable exactly — here, statically, in both manifests at
 * once. The runtime half (a registered, controlling service worker over the
 * right scope) is asserted in `e2e/tests/pwa/installability.spec.ts`.
 *
 * §6 wants **two** installable surfaces. That is the load-bearing assertion
 * below: the hub and the parent app must not share a `start_url`, or
 * installing one gives you the other.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

type Icon = { src: string; sizes?: string; type?: string; purpose?: string };
type Manifest = {
  id?: string;
  name?: string;
  short_name?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  display_override?: string[];
  theme_color?: string;
  background_color?: string;
  icons?: Icon[];
};

const app = manifest() as Manifest;
const hub = JSON.parse(readFileSync(join(root, 'public/hub.webmanifest'), 'utf8')) as Manifest;

const SURFACES: [string, Manifest][] = [
  ['parent app', app],
  ['hub', hub],
];

/** What a Chromium install prompt actually requires. */
const INSTALLABLE_DISPLAY = ['standalone', 'fullscreen', 'minimal-ui'];

describe.each(SURFACES)('%s manifest', (_label, subject) => {
  it('names itself', () => {
    expect(subject.name).toBeTruthy();
    expect(subject.short_name).toBeTruthy();
    // Home-screen labels truncate past roughly this length on both platforms.
    expect(subject.short_name!.length).toBeLessThanOrEqual(12);
  });

  it('starts inside its own scope, with a locale prefix', () => {
    expect(subject.start_url).toBeTruthy();
    expect(subject.scope).toBeTruthy();
    expect(subject.start_url!.startsWith(subject.scope!)).toBe(true);
    // `localePrefix: 'always'`: an un-prefixed start URL costs every cold
    // launch a redirect, and an offline one finds nothing cached at all.
    expect(subject.start_url).toMatch(/^\/(?:nl|en)\//);
  });

  it('declares a display mode a browser will offer to install', () => {
    expect(INSTALLABLE_DISPLAY).toContain(subject.display);
  });

  it('carries the 192px and 512px PNG icons an install prompt needs', () => {
    const icons = subject.icons ?? [];

    for (const size of ['192x192', '512x512']) {
      const icon = icons.find(
        (candidate) => candidate.sizes === size && candidate.type === 'image/png'
      );
      expect(icon, `missing a ${size} PNG icon`).toBeDefined();
      // And it has to actually be on disk — a manifest pointing at a 404 is
      // the exact failure that makes an app quietly uninstallable.
      expect(statSync(join(root, 'public', icon!.src)).size).toBeGreaterThan(0);
    }
  });

  it('provides a maskable icon so Android does not letterbox the mark', () => {
    const maskable = (subject.icons ?? []).find((icon) => icon.purpose?.includes('maskable'));
    expect(maskable).toBeDefined();
    expect(statSync(join(root, 'public', maskable!.src)).size).toBeGreaterThan(0);
  });

  it('sets both colors, so the install has no white flash of its own', () => {
    expect(subject.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(subject.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('two surfaces, not one', () => {
  it('installs to different entry points', () => {
    expect(app.start_url).not.toBe(hub.start_url);
    expect(app.id).not.toBe(hub.id);
  });

  it('sends the hub to the board and the parent app to today', () => {
    expect(hub.start_url).toMatch(/\/hub$/);
    expect(app.start_url).toMatch(/\/today$/);
  });

  it('gives the wall display a chrome-free display mode', () => {
    // M12 owns the kiosk layout; the manifest half of "no browser chrome" is
    // this, and it is already true.
    expect(hub.display).toBe('fullscreen');
  });

  it('agrees on the theme color, because they are one product', () => {
    expect(hub.theme_color).toBe(app.theme_color);
  });
});
