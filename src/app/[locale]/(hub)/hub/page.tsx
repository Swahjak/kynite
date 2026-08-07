import { getTranslations } from 'next-intl/server';
import { ChildLauncher, type HubChild } from '@/components/hub';
import { HubBoard, loadCalendarPage } from '@/modules/calendar';
import { requireHubDevice } from '@/modules/devices';
import { MEMBER_COLOR_CLASSES, initialsOf } from '@/modules/family';
import { loadFamilyRoutineTotals } from '@/modules/routines';
import { AmbientTimers, loadTimerBoard } from '@/modules/timers';

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
 * The board renders behind a **device** principal, not a parent's (M12): the
 * `(hub)` layout note records why the tree stays at `/hub/*`, and
 * `requireHubDevice` is why nothing here can be reached with an account
 * session. `loadCalendarPage` therefore sees `kind: 'device'` and grades
 * `calendar:view_private` as `busy-only` on its own, with no surface flag.
 */
export default async function HubPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; now?: string }>;
}) {
  const { locale } = await params;
  const { date, now } = await searchParams;
  // The device principal is resolved before anything is read. An unpaired or
  // revoked tablet lands on the pair screen instead of on an empty board.
  // NB-3: `?date=`/`?now=` are forwarded so a locale-follow redirect (M16)
  // doesn't drop them.
  await requireHubDevice(locale, '/hub', { date, now });

  // The board is an ambient "today" surface; `?date=` renders another day,
  // which is what a tomorrow-preview needs and what makes the board
  // snapshot-testable without freezing a clock.
  // No `view`: the hub's board is the *family's* (FR28, M16), resolved inside
  // the loader from `family.hubDefaultView`. Passing 'day' here would have
  // pinned the wall to one shape and made the setting unobservable.
  const data = await loadCalendarPage({ date, surface: 'hub' });
  // Renders nothing when nothing is running, so the board is unchanged the
  // rest of the day.
  const timers = await loadTimerBoard({ now });
  const t = await getTranslations('calendar');

  // M19: the board is the way *in*, not only a thing to read. One entry per
  // child, carrying today's step count so the tap is informed rather than
  // exploratory. Loaded here, on the server, because `ChildLauncher` is a
  // client component and `@/modules/routines` is `server-only`; the same seam
  // `AmbientTimers` uses. Adults are absent by design — the hub's interactive
  // half is the child-facing one (§7: a device may complete steps and request
  // redemptions, and nothing an adult does on the wall is a thing the wall
  // should offer).
  //
  // One family-wide read, not one board per child: this page re-renders on
  // every SSE event a wall display receives, and `loadMemberRoutines` per child
  // was an N+1 that built four full board sections per member to read two
  // integers off the end (M19 review, F11).
  const totals = data ? await loadFamilyRoutineTotals({ date }) : null;

  const children: HubChild[] = (data?.members ?? [])
    .filter((member) => member.role === 'child')
    .map((member) => {
      const progress = totals?.get(member.id) ?? { done: 0, total: 0 };

      return {
        id: member.id,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl,
        initials: initialsOf(member.displayName),
        colorClass: MEMBER_COLOR_CLASSES[member.color].surface,
        doneCount: progress.done,
        total: progress.total,
      };
    });

  if (!data) {
    // Unreachable in practice — `requireHubDevice` has already redirected a
    // hub with no principal. Kept as the honest fallback for the case the
    // loader itself declines (a family row deleted mid-request), because a
    // blank board is the one thing a wall display must never show.
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="font-display text-h1 font-bold">{t('hub.unpairedTitle')}</h1>
        <p className="text-body-lg text-ink-secondary">{t('hub.unpairedBody')}</p>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-full flex-col gap-4 bg-background px-6 py-4"
      data-testid="hub-board"
    >
      {/* §6: family state is mirrored to IndexedDB on every load and every SSE
          event, and a boot renders from IDB then reconciles. Both halves live
          in `HubBoard`, because the reconcile has to swap the heading, the day
          and the columns together or the wall contradicts itself.

          `generatedAt` is the server's render instant and the only thing the
          mirror compares: a snapshot is adopted over this document strictly
          when it is newer, from the same family, and the stream is not up. */}
      <HubBoard
        familyId={data.familyId}
        snapshot={{
          // The server's own render instant, not `Date.now()` in a client
          // component: two snapshots must be comparable across devices.
          generatedAt: data.now.getTime(),
          anchor: data.anchor,
          now: data.now,
          timeZone: data.timeZone,
          view: data.view,
          weekStartsOn: data.weekStartsOn,
          members: data.members,
          events: data.events,
        }}
      >
        {/* M09: a running timer is on the board without anyone navigating to
            it. Passed as a child rather than mirrored — a countdown comes from
            the server's clock, and a cached one would be a wrong number. */}
        {timers ? <AmbientTimers board={timers} /> : null}

        {/* M19: the per-child entry points. Not mirrored either — a step count
            is a live number, and a board rendered from IndexedDB after a
            reboot should show yesterday's schedule rather than yesterday's
            progress. */}
        <ChildLauncher entries={children} />
      </HubBoard>
    </main>
  );
}
