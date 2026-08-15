import { CalendarShell, loadCalendarPage } from '@/modules/calendar';
import { redirect } from '@/i18n/navigation';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The parent app's calendar (FR3). All four layouts are rendered from one
 * fetched window, so switching between them is client state — see
 * `modules/calendar/ui/calendar-shell.tsx`.
 */
export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { locale } = await params;
  const { view, date } = await searchParams;

  const data = await loadCalendarPage({ view, date });
  if (!data) redirect({ href: '/sign-in', locale });
  if (!data) return null;

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <CalendarShell
        view={data.view}
        anchor={data.anchor}
        events={data.events}
        members={data.members}
        calendars={data.calendars}
        timeZone={data.timeZone}
        weekStartsOn={data.weekStartsOn}
        now={data.now}
        canWrite={data.canWrite}
      />
    </main>
  );
}
