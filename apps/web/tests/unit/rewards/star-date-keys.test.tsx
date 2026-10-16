import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StarChartData } from '@/modules/rewards/page-data';

/**
 * The star chart's bars are labelled from a YYYY-MM-DD key read back at noon
 * UTC. The key already *is* the family's calendar day, so the label must come
 * from the UTC reading of that instant: reading it in the device's zone shifts
 * the day for any zone more than twelve hours east of UTC.
 *
 * The process zone is pinned to Kiritimati (UTC+14) — noon UTC is 02:00 the
 * next day there, so an unpinned `formatDateTime` renders every label a day late.
 */
process.env.TZ = 'Pacific/Kiritimati';

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values?.day ? `${key}:${String(values.day)}` : key,
}));

vi.mock('@/modules/family', () => ({
  getHouseholdFormattingLocale: async () => 'en-GB',
}));

const { StarWeekCard } = await import('@/modules/rewards/ui/star-week-card');
const { StarChart } = await import('@/modules/rewards/ui/star-chart');

// Wednesday 2026-09-16 .. Friday: a Monday-first week with distinct weekdays.
const WEEK = [
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
  '2026-09-18',
  '2026-09-19',
  '2026-09-20',
];

const chart = {
  familyId: 'family-1',
  member: { id: 'm1', displayName: 'Noor' },
  horizon: 'savings',
  totals: { earned: 10, available: 5 },
  history: [],
  week: WEEK.map((day) => ({ day, total: 1 })),
  weekTotal: 7,
  today: '2026-09-16',
  graduated: [],
  now: new Date('2026-09-16T10:00:00Z'),
  timeZone: 'Europe/Amsterdam',
} as unknown as StarChartData;

describe('star chart date keys never shift day', () => {
  it('labels the week card bars with the key’s own weekday', async () => {
    const { container } = render(await StarWeekCard({ chart }));
    const html = container.innerHTML;
    const spoken = [...html.matchAll(/chart\.dayStars:(\w+)/g)].map((match) => match[1]);

    expect(spoken).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
  });

  it('labels the chart columns with the key’s own day number and weekday', async () => {
    const { container } = render(await StarChart({ chart }));
    const columns = [...container.querySelectorAll('ol > li')].map((li) => li.textContent);

    expect(columns).toHaveLength(7);
    expect(columns[0]).toContain('14');
    expect(columns[0]).toContain('Mon');
    expect(columns[6]).toContain('20');
    expect(columns[6]).toContain('Sun');
  });
});
