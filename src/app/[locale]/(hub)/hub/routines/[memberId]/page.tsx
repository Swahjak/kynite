import { getFormatter, getTranslations } from 'next-intl/server';
import { requireHubDevice } from '@/modules/devices';
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
  await requireHubDevice(locale);

  const { date, time } = await searchParams;

  const board = await loadMemberRoutines({ memberId, date, time });
  const t = await getTranslations('routines');
  const format = await getFormatter();

  if (!board) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="font-display text-h1 font-bold">{t('hub.unavailableTitle')}</h1>
        <p className="text-body-lg text-ink-secondary">{t('hub.unavailableBody')}</p>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-full flex-col gap-6 bg-background p-6"
      data-testid="hub-routines"
      data-member-id={board.member.id}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-display-md font-extrabold">
            {t('hub.title', { name: board.member.displayName })}
          </h1>
          <p className="text-body-lg text-ink-secondary">
            {format.dateTime(board.now, { dateStyle: 'full' })}
          </p>
        </div>
        <span
          data-testid="hub-routines-clock"
          className="tabular-time text-display-md font-extrabold text-brand-ink"
        >
          {format.dateTime(board.now, { hour: '2-digit', minute: '2-digit' })}
        </span>
      </header>

      <RoutineBoard board={board} />
    </main>
  );
}
