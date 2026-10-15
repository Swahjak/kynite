import { getTranslations } from 'next-intl/server';
import { EmptyState, PageHeader } from '@kynite/ui';
import { formatDateTime } from '@/i18n/formatting-locale';
import { requireMemberOrDevice } from '@/modules/devices';
import { getFamily, getHouseholdFormattingLocale } from '@/modules/family';
import {
  DURATION_PRESETS,
  TimerBoard,
  TimerControls,
  loadTimerBoard,
  loadTimersPage,
  type TimerQuickStart,
} from '@/modules/timers';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The hub timers screen (M09).
 *
 * The board speaks for itself: it names what is running and how long is left,
 * and says the time is up when it is (FR30 — never "you still have to…", never
 * a parent's voice). The countdown is server-authoritative in its start time,
 * so this page can be reloaded at any point in a countdown and resume on the
 * same second.
 *
 * One route for both principals; the principal decides the controls, the
 * surface decides nothing here. A signed-in member gets the full
 * `TimerControls` (custom label, member select, start from a routine step's
 * prescribed timer, extend); a paired device keeps the wall's quick-start
 * board.
 */
export default async function HubTimersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ now?: string }>;
}) {
  const { locale } = await params;
  const { now } = await searchParams;
  const principal = await requireMemberOrDevice(locale, '/timers', { now });

  if (principal.kind === 'member') {
    const [page, tMember] = await Promise.all([loadTimersPage(), getTranslations('timers')]);
    if (!page) return null;
    return (
      <main
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 sm:p-6"
        data-testid="timers-page"
      >
        <PageHeader
          icon="timer"
          iconTint="brand-container"
          iconFilled
          title={tMember('title')}
          subtitle={tMember('subtitle')}
        />

        <TimerControls page={page} />
      </main>
    );
  }

  const board = await loadTimerBoard({ now });
  const t = await getTranslations('timers');
  const hub = await getTranslations('hub.timers');
  const formattingLocale = await getHouseholdFormattingLocale();
  // The wall clock reads in the family's zone, never the server's (UTC on Railway).
  const timeZone = (await getFamily(principal.familyId))?.timezone ?? 'Europe/Amsterdam';

  // M19, owner decision: the wall starts timers, it does not only display them.
  // `timer:control` is `allow` for a device principal (§7), so the Server
  // Action was already there and only the control was missing. The copy comes
  // from the `hub` namespace and is passed *into* the shared board — the board
  // is the same component on both surfaces, and a hub-only fork of it is
  // exactly what M19's architecture decision forbids.
  const quickStart: TimerQuickStart[] = DURATION_PRESETS.map((seconds) => {
    const minutes = Math.round(seconds / 60);
    return {
      seconds,
      label: hub('start', { minutes }),
      ariaLabel: hub('startNamed', { minutes }),
      // Not the button's face. "5 min" as a timer *name* makes every wall timer
      // identically titled; this is the name the tile, the stop control and the
      // warning line all speak, so it has to be a name.
      startLabel: hub('quickStartLabel', { minutes }),
    };
  });

  if (!board) {
    return (
      <main className="min-h-full">
        <EmptyState
          size="hub"
          heading
          title={t('hub.unavailableTitle')}
          description={t('hub.unavailableBody')}
        />
      </main>
    );
  }

  return (
    // Same tightened kiosk rhythm as the routines screen — see the note there
    // (M19 review, F8).
    <main
      className="flex min-h-full flex-col gap-4 bg-background px-6 py-4"
      data-testid="hub-timers"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-display-md font-extrabold">{t('hub.title')}</h1>
        {/* The Stitch board clock token (72px) — see the routines screen. */}
        <span className="tabular-time text-display-hub font-extrabold text-brand-ink">
          {formatDateTime(new Date(board.serverNow), formattingLocale, {
            hour: '2-digit',
            minute: '2-digit',
            timeZone,
          })}
        </span>
      </header>

      <TimerBoard
        board={board}
        quickStart={quickStart}
        quickStartTitle={hub('startTitle')}
        atMaximumLabel={hub('atMaximum')}
      />
    </main>
  );
}
