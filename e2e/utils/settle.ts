import { expect, type Page } from '@playwright/test';

/**
 * Put a page into a screenshot-stable state.
 *
 * The same discipline `utils/design-page.ts` applies to `/dev/design`, factored
 * out so the calendar visuals cannot drift from it: wait for font loading to
 * settle (not for a guessed number of milliseconds), then kill animations,
 * transitions and the caret so nothing is mid-flight when the shot is taken.
 */
export async function settlePage(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }
    /* The Next.js dev-mode indicator is not part of the design. */
    nextjs-portal { display: none !important; }`,
  });

  // Style injection can itself trigger a font load (a newly visible element in
  // a family that had not been used yet), so settle once more afterwards.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/**
 * Pin a deliberately-live text node — the hub's wall clock — for a screenshot.
 *
 * ## Why a one-shot overwrite was not enough (M19)
 *
 * The previous form of this was two lines in the spec: wait for the clock to
 * read like a time, then `element.textContent = '00:00'`. It produced a
 * *nondeterministic* board — two of the hub baselines failed immediately after
 * `e2e:visual:update` had regenerated them in the same session, one because the
 * baseline had captured a live time and one because the shot had.
 *
 * The cause is that the wait proves nothing. `HubBoard`'s clock is rendered on
 * the **server** from `snapshot.now` and formatted the same way on the client,
 * so the markup reads like a real time from the very first byte — before React
 * has hydrated the node at all. Confirmed directly: under a 20× CPU throttle
 * the clock element carries no `__reactFiber$` key at the moment the old code
 * pinned it, and ~800ms later hydration commits and puts the live time back.
 * On an unloaded machine hydration usually wins the race first and the pin
 * sticks; with four workers on one box it is a coin toss, which is exactly the
 * shape the failures had.
 *
 * ## Why an observer rather than a better wait
 *
 * Waiting for hydration is possible (`__reactFiber$` on the node, or the
 * realtime `EventSource` opening) but both are proxies: one is a React
 * internal, the other is a different subsystem's timing standing in for this
 * one's. A `MutationObserver` needs neither. It re-applies the pin whenever
 * anything rewrites the node, and because observer callbacks are microtasks
 * they run before the next paint — so no frame, and therefore no screenshot,
 * can contain the live value regardless of when React commits.
 *
 * The pin is asserted afterwards, so a clock that somehow escaped it fails the
 * test loudly instead of silently baking a wall time into a baseline.
 */
export async function pinLiveText(page: Page, testId: string, text = '00:00'): Promise<void> {
  const target = page.getByTestId(testId);
  await expect(target).toBeVisible();

  await page.evaluate(
    ({ selector, pinned }) => {
      // Observed on the *document*, re-querying every time — not on the element
      // handle. React's recovery from a hydration mismatch removes and
      // re-creates the node rather than patching it, so an observer bound to
      // the element ends up watching a detached copy while the live board
      // carries the wall time (measured: the pin still lost, identically, with
      // an element-scoped observer).
      const apply = () => {
        const element = document.querySelector(selector);
        if (element && element.textContent !== pinned) element.textContent = pinned;
      };
      new MutationObserver(apply).observe(document.documentElement, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      apply();
    },
    { selector: `[data-testid="${testId}"]`, pinned: text }
  );

  await expect(target).toHaveText(text);
}
