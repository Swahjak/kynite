import { describe, expect, it } from 'vitest';
import { OVERFLOW_NAV, RAIL_FOOTER_NAV, withoutManage } from '@/components/app-nav/nav-items';

/** D16: Beheer is a capability-gated entry, filtered out for anyone who may not manage. */
describe('withoutManage', () => {
  it('drops the /manage entry and keeps the rest in order', () => {
    const filtered = withoutManage(OVERFLOW_NAV);
    expect(filtered.map((item) => item.href)).toEqual(['/routines', '/timers']);
    expect(OVERFLOW_NAV.some((item) => item.href === '/manage')).toBe(true);
  });

  it('empties the rail footer for a non-manager', () => {
    expect(withoutManage(RAIL_FOOTER_NAV)).toEqual([]);
  });

  // The layouts' `canManage ? NAV : withoutManage(NAV)` selection.
  it.each([
    [true, ['/routines', '/timers', '/manage']],
    [false, ['/routines', '/timers']],
  ])('canManage=%s', (canManage, expected) => {
    const nav = canManage ? OVERFLOW_NAV : withoutManage(OVERFLOW_NAV);
    expect(nav.map((item) => item.href)).toEqual(expected);
  });
});
