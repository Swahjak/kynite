import { describe, expect, it } from 'vitest';
import { MEMBER_COLOR_CLASSES as CALENDAR_MEMBER_COLOR_CLASSES } from '@/modules/calendar/ui/tokens';
import { MEMBER_COLOR_CLASSES as FAMILY_MEMBER_COLOR_CLASSES } from '@/modules/family/ui/tokens';

/**
 * `MEMBER_COLOR_CLASSES` is intentionally duplicated: the module-boundary
 * ESLint rule bans a client bundle (`event-chip.tsx`, `person-columns.tsx`,
 * `member-day-grid.tsx`, `calendar-shell.tsx`) from deep-importing
 * `@/modules/family/ui/tokens`, because the family slice's only allowed
 * cross-slice import — its barrel — drags in `server-only` and the Postgres
 * driver (see the doc comment on `modules/calendar/ui/tokens.ts`'s copy).
 *
 * Unit tests are exempt from that boundary rule (`eslint.config.mjs`, "Unit
 * tests exercise slice internals directly"), so this test can import both
 * copies directly and assert they never drift apart — a change to one table
 * without the other is exactly the failure mode the duplication comment
 * warns about, and it should fail loudly here rather than silently at
 * runtime as two calendar/family surfaces disagreeing on a member's colour.
 */
describe('MEMBER_COLOR_CLASSES parity (family vs. calendar copy)', () => {
  it('keeps the calendar slice copy identical to the family slice source', () => {
    expect(CALENDAR_MEMBER_COLOR_CLASSES).toEqual(FAMILY_MEMBER_COLOR_CLASSES);
  });
});
