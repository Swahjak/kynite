import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * One axe run, asserted the same way on every surface (M17).
 *
 * The tag set is WCAG 2.0/2.1 level A and AA — the standard M17 names, and the
 * one this product's colour tokens, target sizes and type scale were designed
 * against in M02 and M12.
 *
 * There is deliberately **no exclusion list**. A violation here is a bug in a
 * component, and the fix is in the component; an `exclude()` would turn this
 * suite into a record of which problems we have agreed not to see. The failure
 * message carries the rule id, the count and the selector, because "axe found
 * 3 violations" is not something anyone can act on.
 */
export async function expectNoAxeViolations(page: Page, surface: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const readable = results.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id} @ ${node.target.join(' ')} — ${node.failureSummary ?? violation.help}`
    )
  );

  expect(readable, `${surface} has WCAG AA violations`).toEqual([]);
}
