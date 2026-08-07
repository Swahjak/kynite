import { getFormatter, getTranslations } from 'next-intl/server';
import { PersonColumns, loadCalendarPage } from '@/modules/calendar';
import { firstNameOf, getMember, getPrincipal, greetingSlotFor, hourIn } from '@/modules/family';
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
  const tCommon = await getTranslations('common');
  const format = await getFormatter();

  /**
   * The greeting (M18).
   *
   * `/today` is the first screen a signed-in parent lands on, and until now it
   * opened with the word "Vandaag" and a date — true, and completely
   * anonymous. The slot is resolved against the *household's* timezone
   * (`data.timeZone`), not the server's: a family in Curaçao must not be wished
   * a good evening over breakfast.
   *
   * It degrades rather than fails: a principal with no member row, or a member
   * with a blank display name, simply keeps the plain title.
   */
  const principal = await getPrincipal();
  const viewer =
    principal?.kind === 'member' ? await getMember(principal.familyId, principal.memberId) : null;
  const firstName = viewer ? firstNameOf(viewer.displayName) : '';
  const slot = greetingSlotFor(hourIn(data.now, data.timeZone));

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 p-3" data-testid="today-board">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1 font-bold" data-testid="today-greeting">
          {firstName ? tCommon(`greeting.${slot}`, { name: firstName }) : t('todayTitle')}
        </h1>
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
