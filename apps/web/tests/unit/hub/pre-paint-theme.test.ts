import { describe, expect, it, vi } from 'vitest';
import { prePaintTheme } from '@/components/hub/pre-paint-theme';

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
  it('uses the family zone for the clock rule (TZ=UTC server/CI)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T05:30:00Z')); // 07:30 Amsterdam, 05:30 UTC
    expect(run('Europe/Amsterdam')).toBe('light');
    expect(run('UTC')).toBe('dark');
    vi.useRealTimers();
  });
});
