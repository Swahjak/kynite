import { expect, test } from '@e2e/fixtures/family';
import { pairHub } from '@e2e/fixtures/hub';
import { seedMembers, withDb } from '@e2e/utils/seed';

/**
 * The M12 criterion "the hub layout renders fullscreen with no browser chrome
 * in standalone mode; body text meets the 6-foot legibility scale; all targets
 * ≥48×48px — automated audit", held as an actual audit rather than a screenshot.
 *
 * Three properties, each measured on the *rendered* page:
 *
 *  1. **Standalone.** The kiosk's manifest asks for `display: fullscreen` and
 *     the page adopts its own scope, so an installed hub has no browser UI.
 *     Headless Chromium never enters standalone, so the wiring is what is
 *     asserted — the manifest the hub links, its `display` and `scope`, and the
 *     fact that the shell is sized to the viewport rather than to the document
 *     (a page that scrolls the body has browser chrome even when the browser
 *     does not).
 *  2. **6-foot type.** Every rendered text node's *computed* font size is
 *     collected and compared against the kiosk floor. Computed, not
 *     class-name-matched: the whole mechanism under test is the
 *     `[data-surface='hub']` scale override in `globals.css`, and a test that
 *     read class names would pass whether or not it was applied.
 *  3. **48px targets.** Every interactive element's bounding box is walked.
 *
 * `e2e/tests/hub/target-size.spec.ts` audits the same 48px rule on the
 * component gallery. This one audits the real surfaces, where a layout — not a
 * primitive — is what shrinks something.
 */

const MIN_TARGET = 48;

/**
 * The kiosk floor: `--text-overline` under `[data-surface='hub']`, the smallest
 * size the scale defines. Body copy lands well above it (22px); this is the
 * bound below which *nothing* on a wall display may be typeset.
 */
const MIN_TEXT_PX = 16;

/** What body copy must reach. The scale sets `--text-body` to 1.375rem = 22px. */
const MIN_BODY_PX = 22;

const NOT_HIDDEN = ':not([aria-hidden="true"]):not([type="hidden"])';

const INTERACTIVE_SELECTOR = [
  'button',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="combobox"]',
  'a[href]',
  'input',
  'select',
  'textarea',
]
  .map((selector) => `${selector}${NOT_HIDDEN}`)
  .join(', ');

type Undersized = { text: string; size: number };

/**
 * Every rendered text node's computed font size, with the element that owns it.
 * Walks text nodes rather than elements so a `<span>` inside a `<p>` is measured
 * on its own terms, and skips whitespace, invisible and zero-area nodes.
 */
/**
 * `next dev` injects its own dev-tools overlay, and it lives inside a shadow
 * root — so `closest()` alone stops at the shadow boundary while Playwright's
 * locators pierce straight through it. Walking up through shadow *hosts* is
 * what actually excludes it. It does not exist in a production build; auditing
 * it would be auditing Next.js.
 *
 * Declared as a browser-side source string because both call sites hand it to
 * a different `evaluate()` and Playwright serialises each one separately.
 */
function isDevOverlay(element: Element): boolean {
  let node: Node | null = element;
  while (node) {
    if (node instanceof Element && node.tagName.toLowerCase().startsWith('nextjs-')) return true;
    const root = node.getRootNode();
    node = root instanceof ShadowRoot ? root.host : ((node as Element).parentElement ?? null);
  }
  return false;
}

async function textSizes(page: import('@playwright/test').Page): Promise<Undersized[]> {
  return page.evaluate((isOverlaySource) => {
    const isOverlay = new Function('return ' + isOverlaySource)() as (el: Element) => boolean;
    const found: { text: string; size: number }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? '';
      if (text.length === 0) continue;

      const parent = node.parentElement;
      if (!parent) continue;
      if (isOverlay(parent)) continue;

      const style = getComputedStyle(parent);
      if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') {
        continue;
      }
      // Icon fonts are glyphs, not copy: a Material Symbols codepoint is sized
      // by its own scale and reading it as 14px "text" would be meaningless.
      if (style.fontFamily.includes('fontIcon')) continue;
      // Screen-reader-only text has no visual size to audit.
      const box = parent.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;

      found.push({ text: text.slice(0, 40), size: Number.parseFloat(style.fontSize) });
    }

    return found;
  }, isDevOverlay.toString());
}

async function undersizedTargets(page: import('@playwright/test').Page): Promise<string[]> {
  const controls = page.locator(INTERACTIVE_SELECTOR);
  const count = await controls.count();
  const undersized: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible())) continue;
    // The `next dev` overlay again — see `isDevOverlay`.
    const overlay = await control.evaluate(
      (element, source) =>
        (new Function('return ' + source)() as (node: Element) => boolean)(element),
      isDevOverlay.toString()
    );
    if (overlay) continue;

    const box = await control.boundingBox();
    const describe = await control.evaluate((element) => {
      const tag = element.tagName.toLowerCase();
      const label =
        element.getAttribute('aria-label') ??
        element.getAttribute('data-testid') ??
        element.textContent?.trim().slice(0, 30) ??
        '(no label)';
      return `${tag} "${label}"`;
    });

    if (!box) {
      undersized.push(`${describe} — not rendered`);
      continue;
    }
    if (box.width < MIN_TARGET || box.height < MIN_TARGET) {
      undersized.push(`${describe} — ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
  }

  return undersized;
}

test.describe('kiosk layout audit', { tag: '@heavy' }, () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // The e2e server is `next dev`, so the first visit to each hub route in a
  // worker pays for compiling it — and this file is usually the first thing to
  // touch several of them. That has nothing to do with what is being audited,
  // and under four parallel workers it is the difference between the suite
  // passing and a 30s default timeout (`timers.spec.ts` documents the same
  // effect and buys a warm-up round instead).
  test.setTimeout(90_000);

  test('links a fullscreen, hub-scoped manifest and fills the viewport without scrolling the body', async ({
    page,
    family,
  }) => {
    await pairHub(page, family.familyId);
    await page.goto('/nl/hub');

    // The hub tree overrides the parent app's manifest (§6: two installable
    // surfaces, one service worker).
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/hub.webmanifest');

    const manifest = await page.request.get('/hub.webmanifest').then((r) => r.json());
    expect(manifest.display).toBe('fullscreen');
    expect(manifest.display_override).toContain('fullscreen');
    expect(manifest.scope).toBe('/nl/hub');
    expect(manifest.start_url).toBe('/nl/hub');
    // Landscape: a wall tablet is mounted, and a board that rotates is a board
    // that is briefly unreadable.
    expect(manifest.orientation).toBe('landscape');

    // Mobile Safari and Android both ignore the manifest for a home-screen
    // launch and read this instead; without it a bookmarked hub keeps the
    // browser's chrome. Next 16 emits the modern `mobile-web-app-capable`
    // name for `appleWebApp.capable`, not the legacy `apple-` prefixed one.
    await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
      'content',
      'yes'
    );

    // The shell owns the viewport, and the document does not scroll — a hub
    // whose body scrolls shows a scrollbar and a rubber-band edge, which is
    // browser chrome by another name.
    const layout = await page.evaluate(() => ({
      shellHeight: document.querySelector<HTMLElement>('[data-testid="kiosk-shell"]')?.clientHeight,
      viewportHeight: window.innerHeight,
      bodyScrolls: document.body.scrollHeight > window.innerHeight + 1,
      surface: document.documentElement.dataset.surface,
    }));

    expect(layout.surface).toBe('hub');
    expect(layout.bodyScrolls).toBe(false);
    expect(layout.shellHeight).toBeGreaterThanOrEqual(layout.viewportHeight - 1);

    // No parent-app navigation reached the wall.
    await expect(page.getByRole('link', { name: 'Instellingen' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Uitloggen' })).toHaveCount(0);
  });

  test('applies the 6-foot type scale to the shell and everything under it', async ({
    page,
    family,
  }) => {
    await pairHub(page, family.familyId);
    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();

    // Measured on an element carrying the design system's own body class, not
    // on a bare paragraph: the kiosk scale re-points the `--text-*` tokens, so
    // an element that never asked for a token still inherits the browser's
    // 16px and would say nothing about whether the override works.
    //
    // Both readings come from the *same* element with the attribute toggled
    // off and on, which is the non-vacuity check: the override lives on the
    // document element, so anything appended anywhere inherits it, and a
    // comparison against a hard-coded number would pass even if the whole
    // mechanism were deleted.
    const scale = await page.evaluate(() => {
      const root = document.documentElement;
      const probe = document.createElement('p');
      probe.className = 'text-body';
      document.body.append(probe);

      const hub = Number.parseFloat(getComputedStyle(probe).fontSize);

      const surface = root.dataset.surface;
      delete root.dataset.surface;
      const app = Number.parseFloat(getComputedStyle(probe).fontSize);
      if (surface) root.dataset.surface = surface;

      probe.remove();
      return { hub, app };
    });

    expect(scale.hub).toBeGreaterThanOrEqual(MIN_BODY_PX);
    expect(scale.app).toBeLessThan(scale.hub);
  });

  for (const surface of [
    { name: 'ambient board', path: () => '/nl/hub' },
    { name: 'timers', path: () => '/nl/hub/timers' },
    { name: 'pair screen', path: () => '/nl/hub/pair', unpaired: true },
  ]) {
    test(`typesets nothing below ${MIN_TEXT_PX}px on the ${surface.name}`, async ({
      page,
      family,
    }) => {
      if (!surface.unpaired) await pairHub(page, family.familyId);
      await page.goto(surface.path());
      await page.waitForFunction(() => document.fonts.status === 'loaded');

      const sizes = await textSizes(page);
      // Non-vacuity: an empty walk would pass trivially.
      expect(sizes.length).toBeGreaterThan(3);

      const tooSmall = sizes.filter((entry) => entry.size < MIN_TEXT_PX);
      expect(tooSmall, `text below the kiosk floor on ${surface.name}`).toEqual([]);
    });

    test(`keeps every target at ${MIN_TARGET}px on the ${surface.name}`, async ({
      page,
      family,
    }) => {
      if (!surface.unpaired) await pairHub(page, family.familyId);
      await page.goto(surface.path());
      await page.waitForFunction(() => document.fonts.status === 'loaded');

      const undersized = await undersizedTargets(page);
      expect(undersized, `undersized targets on ${surface.name}`).toEqual([]);
    });
  }

  test('audits the settings sheet too — a portalled surface is still the hub', async ({
    page,
    family,
  }) => {
    await pairHub(page, family.familyId);
    await page.goto('/nl/hub');

    await page.getByTestId('hub-settings-trigger').click();
    await expect(page.getByTestId('hub-settings')).toBeVisible();

    // The sheet renders outside the shell's subtree, which is exactly why the
    // scale attribute lives on `<html>`. If it did not, everything in here
    // would come back at phone sizes and this assertion would catch it.
    const sizes = await textSizes(page);
    expect(sizes.filter((entry) => entry.size < MIN_TEXT_PX)).toEqual([]);
    expect(await undersizedTargets(page)).toEqual([]);
  });

  test('renders a dark board when the device asks for one', async ({ page, family }) => {
    await pairHub(page, family.familyId);

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/nl/hub');
    await expect(page.getByTestId('kiosk-shell')).toHaveAttribute('data-hub-theme', 'dark');
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    await expect(page.getByTestId('kiosk-shell')).toHaveAttribute('data-hub-theme', 'light');
    const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    expect(dark).not.toBe(light);
  });

  test('routine and store surfaces meet the same floors', async ({ page, family }) => {
    const [mila] = await withDb((client) =>
      seedMembers(client, family.familyId, [
        { displayName: 'Mila', role: 'child', color: 'orange', sortOrder: 1 },
      ])
    );

    await pairHub(page, family.familyId);

    for (const path of [`/nl/hub/routines/${mila.id}`, `/nl/hub/store?member=${mila.id}`]) {
      await page.goto(path);
      await page.waitForFunction(() => document.fonts.status === 'loaded');

      const sizes = await textSizes(page);
      expect(sizes.length).toBeGreaterThan(3);
      expect(
        sizes.filter((entry) => entry.size < MIN_TEXT_PX),
        `text on ${path}`
      ).toEqual([]);
      expect(await undersizedTargets(page), `targets on ${path}`).toEqual([]);
    }
  });
});
