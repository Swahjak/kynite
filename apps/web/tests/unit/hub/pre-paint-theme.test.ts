import { describe, expect, it, vi } from 'vitest';
import { prePaintTheme } from '@/components/hub/pre-paint-theme';

// Pin the device zone to UTC, which differs from the family zone (Europe/Amsterdam)
// at every instant used here, whatever machine runs this (an Amsterdam laptop would
// otherwise agree with the family zone and hide the bug). Node re-reads TZ on assignment.
process.env.TZ = 'UTC';

function run(timeZone: string): string | undefined {
  const root = { classList: { toggle: vi.fn() }, dataset: {} as Record<string, string> };
  const fn = new Function('document', 'localStorage', 'window', prePaintTheme(timeZone));
  fn(
    { documentElement: root },
    { getItem: () => null },
    { matchMedia: (q: string) => ({ matches: q.includes('no-preference') }) }
  );
  return root.dataset.hubTheme;
}

describe('pre-paint theme script', () => {
  it('uses the family zone for the clock rule (device zone pinned to UTC)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T05:30:00Z')); // 07:30 Amsterdam, 05:30 UTC
    expect(run('Europe/Amsterdam')).toBe('light');
    expect(run('UTC')).toBe('dark');
    vi.useRealTimers();
  });

  it('escapes < in the serialized zone so it cannot close the inline script', () => {
    const script = prePaintTheme('</script><script>alert(1)</script>');
    expect(script).not.toContain('</script');
    expect(script).toContain('\\u003c/script>');
  });
});
