import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@kynite/ui';
import { ChildTabs } from '@/components/hub';
import { formatDateTime } from '@/i18n/formatting-locale';
import { requireHubDevice } from '@/modules/devices';
import { getHouseholdFormattingLocale } from '@/modules/family';
import { RoutineBoard, loadMemberRoutines } from '@/modules/routines';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * One child's routine screen on the hub (M07).
 *
 * Everything about this page is the child's own dashboard, in the board's
 * neutral voice (research §"Nagging / device as messenger"): it names the
 * child, states what is done out of what, and never issues an instruction or
 * speaks for a parent. It shows exactly one member's routines — there is no
 * combined surface anywhere in the product (§Decisions 3).
 *
 * `?date=`/`?time=` pin the rendered clock so the visual snapshot is
 * deterministic; they affect display only (see `page-data.ts`).
 *
 * Addressing is settled in `(hub)/layout.tsx`: the hub tree keeps its `/hub`
 * prefix, and this page is reached only behind a device principal (M12).
 */
export default async function HubRoutinesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; memberId: string }>;
  searchParams: Promise<{ date?: string; time?: string }>;
}) {
  const { locale, memberId } = await params;
  const { date, time } = await searchParams;
  await requireHubDevice(locale, `/hub/routines/${memberId}`, { date, time });

  const board = await loadMemberRoutines({ memberId, date, time });
  const t = await getTranslations('routines');
  const formattingLocale = await getHouseholdFormattingLocale();

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
    // Tighter than the 24px rhythm the rest of the app uses (M19 review, F8):
    // at 1280×800 the shell's chrome plus this page's own header and tabs left
    // the routine list scrolling inside a screen nobody can scroll.
    <main
      className="flex min-h-full flex-col gap-4 bg-background px-6 py-4"
      data-testid="hub-routines"
      data-member-id={board.member.id}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-display-md font-extrabold">
            {t('hub.title', { name: board.member.displayName })}
          </h1>
          <p className="text-body-lg text-ink-secondary">
            {formatDateTime(board.now, formattingLocale, { dateStyle: 'full' })}
          </p>
        </div>
        {/* M19: the Stitch board clock token (72px), not the 56px display-md
            this carried before — the clock is the one thing on a hub screen
            read from the far side of a room. */}
        <span
          data-testid="hub-routines-clock"
          className="tabular-time text-display-hub font-extrabold text-brand-ink"
        >
          {formatDateTime(board.now, formattingLocale, { hour: '2-digit', minute: '2-digit' })}
        </span>
      </header>

      {/* M19: their stars and their shelf are one tap from their steps. */}
      <ChildTabs memberId={board.member.id} displayName={board.member.displayName} />

      <RoutineBoard board={board} />
    </main>
  );
}
