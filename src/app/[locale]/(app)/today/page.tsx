import { getFormatter, getTranslations } from 'next-intl/server';
import { PersonColumns, loadCalendarPage } from '@/modules/calendar';
import { redirect } from '@/i18n/navigation';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * `(app)/today` — the parent's per-person view of the day. Same board the hub
 * renders, at phone scale and with private detail intact: this is a personal
 * device, not a wall display.
 */
export default async function TodayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { locale } = await params;
  const { date } = await searchParams;

  // `?date=` browses another day in the same per-person layout. Defaults to
  // today, which is the only thing the nav ever links to.
  const data = await loadCalendarPage({ view: 'day', date });
  if (!data) redirect({ href: '/sign-in', locale });
  if (!data) return null;

  const t = await getTranslations('calendar');
  const format = await getFormatter();

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 p-3" data-testid="today-board">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1 font-bold">{t('todayTitle')}</h1>
        <p className="text-body text-ink-secondary">
          {format.dateTime(data.anchor, { dateStyle: 'full' })}
        </p>
      </header>

      <PersonColumns
        members={data.members}
        events={data.events}
        timeZone={data.timeZone}
        day={data.anchor}
        now={data.now}
      />
    </main>
  );
}
