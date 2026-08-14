'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { useRouter } from '@/i18n/navigation';
import { elapsedRatio, minutesRemaining, minutesUntil } from '../domain/flow';
import { ProgressRing } from './progress-ring';

/**
 * The part of the NOW hero that a clock changes.
 *
 * Everything else about the hero — title, location, faces, the arrow into the
 * calendar — is a fact about the *event* and stays server-rendered. The ring's
 * sweep, the minutes on it and the sentence beside it are facts about **now**,
 * and until M19 they were photographs: rendered once on the server and then
 * frozen until some unrelated realtime event happened to refresh the page. A
 * hero reading "12m remaining" an hour after the block ended is worse than no
 * hero at all, because a family trusts this screen to be right.
 *
 * So this component owns a tick, and only this component re-renders on it. The
 * server's values are the initial state, so the first paint is identical to
 * what it always was and there is no hydration flash.
 *
 * A minute is the resolution the card displays, but the tick runs twice that
 * fast: a 60s interval started mid-minute lands the visible number up to a full
 * minute late, which is exactly the staleness this exists to remove.
 *
 * **State transitions** (live → next → clear) need the *other* blocks of the
 * day, which this component deliberately does not have — duplicating `flowOf`
 * and the day's event list into the browser to answer "what is after this" would
 * put two sources of truth on one screen. Instead, when the block the card is
 * about crosses its own boundary, the page is refreshed and the server answers
 * the question it already answers. One navigation-free refresh per boundary,
 * not one per tick.
 */

export type NowHeroClockProps = {
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  /** `live` counts down to the end; `next` counts up to the start. */
  state: 'live' | 'next';
  /** The server's `now`, so the first client render matches the HTML. */
  initialNow: Date;
  timeZone: string;
};

const TICK_MS = 30_000;

export function NowHeroClock({
  startsAt,
  endsAt,
  allDay,
  state,
  initialNow,
  timeZone,
}: NowHeroClockProps) {
  const t = useTranslations('today');
  const formatDateTime = useDateTimeFormat();
  const router = useRouter();

  const [now, setNow] = useState(initialNow);
  // The boundary is crossed once. Without this a slow refresh would be asked
  // for again on every tick until the new render arrived.
  const refreshed = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (refreshed.current) return;

    const boundary = state === 'live' ? endsAt.getTime() : startsAt.getTime();
    if (now.getTime() < boundary) return;

    refreshed.current = true;
    router.refresh();
  }, [now, state, startsAt, endsAt, router]);

  const block = { startsAt, endsAt, allDay };
  const at = (instant: Date) =>
    formatDateTime(instant, { hour: '2-digit', minute: '2-digit', timeZone });

  const live = state === 'live';
  const ratio = live ? elapsedRatio(block, now) : 0;
  const remaining = minutesRemaining(block, now);
  const until = minutesUntil(block, now);

  return (
    <div
      data-testid="now-hero-clock"
      data-state={state}
      className="flex min-w-0 items-center gap-4 sm:gap-6"
    >
      <ProgressRing
        ratio={ratio}
        label={
          live
            ? t('now.remainingLabel', { minutes: remaining })
            : t('now.startsLabel', { time: at(startsAt) })
        }
        className="size-20 sm:size-24"
        trackClassName="text-primary-foreground/20"
        sweepClassName="text-primary-foreground"
      >
        <span className="tabular-nums">
          {live ? t('now.minutesShort', { minutes: remaining }) : at(startsAt)}
        </span>
      </ProgressRing>

      <div className="flex min-w-0 flex-col">
        <span className="font-display text-h3">
          {live ? t('now.remainingTitle') : t('now.startsTitle')}
        </span>
        <span className="text-body text-primary-foreground">
          {live ? t('now.endsAt', { time: at(endsAt) }) : t('now.inMinutes', { minutes: until })}
        </span>
      </div>
    </div>
  );
}
