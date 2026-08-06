import { getFormatter, getTranslations } from 'next-intl/server';
import { PersonColumns, loadCalendarPage } from '@/modules/calendar';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The hub ambient board (M06): one column per member in `sortOrder`, each in
 * their own color, at 6-foot legibility.
 *
 * Two things are deliberately different from `(app)/today`. Private calendars
 * render free/busy only — a kitchen wall is not a private surface — which
 * `loadCalendarPage({ surface: 'hub' })` enforces. And there is no event
 * dialog at all: `event:write` is `deny` for a device principal (§7), so the
 * board offers no writes rather than offering some that would be refused.
 *
 * M01 put this at `(hub)/hub` rather than `(hub)/` as §2 describes; M12 owns
 * resolving that along with device pairing, so the addressing stands for now.
 */
export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;

  // The board is an ambient "today" surface; `?date=` renders another day,
  // which is what a tomorrow-preview needs and what makes the board
  // snapshot-testable without freezing a clock.
  const data = await loadCalendarPage({ view: 'day', date, surface: 'hub' });
  const t = await getTranslations('calendar');
  const format = await getFormatter();

  if (!data) {
    // No paired device session exists until M12; until then an unauthenticated
    // hub says so rather than rendering an empty board that looks broken.
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="font-display text-h1 font-bold">{t('hub.unpairedTitle')}</h1>
        <p className="text-body-lg text-ink-secondary">{t('hub.unpairedBody')}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-background p-6" data-testid="hub-board">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-display-md font-extrabold">{t('hub.title')}</h1>
          <p className="text-body-lg text-ink-secondary">
            {format.dateTime(data.anchor, { dateStyle: 'full' })}
          </p>
        </div>
        {/* A real wall clock — the one deliberately live thing on the board. */}
        <span
          data-testid="hub-clock"
          className="tabular-time text-display-md font-extrabold text-brand-ink"
        >
          {format.dateTime(data.now, { hour: '2-digit', minute: '2-digit' })}
        </span>
      </header>

      <PersonColumns
        members={data.members}
        events={data.events}
        timeZone={data.timeZone}
        day={data.anchor}
        now={data.now}
        hub
      />
    </main>
  );
}
