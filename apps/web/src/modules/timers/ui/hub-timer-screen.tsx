'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { cn, Icon } from '@kynite/ui';
import { pauseTimerAction, resumeTimerAction, stopTimerAction } from '../actions';
import {
  formatCountdown,
  phaseOf,
  progressRatio,
  remainingMs,
  remainingSeconds,
} from '../domain/countdown';
import type { TimerBoardData, TimerView } from '../page-data';
import { HubTimerEmptyState } from './hub-timer-empty-state';
import { TimerRing } from './timer-ring';
import { TIMER_TAP_TARGET_CLASS, timerIconOf } from './tokens';
import { useServerNow } from './use-server-now';
import { useTimerChannel } from './use-timer-channel';

/**
 * The fullscreen hub timer (M-T2, `(hub)/hub/timer`) — the Google-Nest-Hub-
 * reference screen: a full-bleed `bg-primary` ground, one giant ring at the
 * centre, ghost pause/stop controls flanking it, and every other running
 * timer as a smaller ring along the bottom edge.
 *
 * Composition mirrors `TimerBoard`: `useTimerChannel` for what is running,
 * `useServerNow` for the tick, and this component owns only the one thing
 * neither of those does — *which* timer is the hero. That is local state
 * (`heroId`), not derived every render from "soonest-ending", because a tap
 * on a strip ring has to *stay* promoted even if a longer timer someone else
 * started a second later would otherwise have taken the spot back.
 * `heroId` still falls back to soonest-ending whenever it names a timer that
 * is no longer on the board (stopped, or never existed) — the empty string
 * of a `Map` miss is "nobody chose yet", same as `null`.
 */
export function HubTimerScreen({ board }: { board: TimerBoardData }) {
  const t = useTranslations('timers');
  const { timers, offsetMs } = useTimerChannel(board);
  const now = useServerNow(board.serverNow, offsetMs);
  const [heroId, setHeroId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (timers.length === 0) return <HubTimerEmptyState />;

  const sorted = [...timers].sort((a, b) => remainingMs(a, now) - remainingMs(b, now));
  const hero = sorted.find((timer) => timer.id === heroId) ?? sorted[0];
  const strip = sorted.filter((timer) => timer.id !== hero.id);

  const phase = phaseOf(hero, now);
  const paused = phase === 'paused';

  const pause = (timerId: string) => {
    startTransition(async () => {
      await pauseTimerAction({ timerId });
    });
  };

  const resume = (timerId: string) => {
    startTransition(async () => {
      await resumeTimerAction({ timerId });
    });
  };

  const stop = (timerId: string) => {
    startTransition(async () => {
      await stopTimerAction({ timerId });
    });
    // A stopped hero should not keep pinning an id nothing on the board
    // answers to any more — the fallback-to-soonest above already handles
    // that the instant the channel drops it, but clearing here means the
    // *next* tap does not have to wait for that round trip.
    if (timerId === heroId) setHeroId(null);
  };

  const ringFor = (timer: TimerView, size: 'hero' | 'strip') => (
    <TimerRing
      ratio={progressRatio(timer, now)}
      label={timer.label}
      icon={timerIconOf(timer)}
      digits={formatCountdown(remainingSeconds(timer, now))}
      digitsLabel={t('remainingLabel', { time: formatCountdown(remainingSeconds(timer, now)) })}
      size={size}
      paused={phaseOf(timer, now) === 'paused'}
    />
  );

  return (
    <main
      data-testid="hub-timer-fullscreen"
      className="flex h-full min-h-full flex-col items-center justify-between gap-6 bg-primary px-6 py-8 text-primary-foreground"
    >
      <div className="flex flex-1 items-center justify-center gap-8 sm:gap-14">
        <button
          type="button"
          data-testid="hub-timer-pause-resume"
          aria-label={
            paused
              ? t('actions.resumeNamed', { label: hero.label })
              : t('actions.pauseNamed', { label: hero.label })
          }
          onClick={() => (paused ? resume(hero.id) : pause(hero.id))}
          className={cn(
            TIMER_TAP_TARGET_CLASS,
            'flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-foreground/10 transition-colors duration-200 ease-brand hover:bg-primary-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50'
          )}
        >
          <Icon name={paused ? 'play_arrow' : 'pause'} size="xl" />
        </button>

        {ringFor(hero, 'hero')}

        <button
          type="button"
          data-testid="hub-timer-stop"
          aria-label={t('actions.stopNamed', { label: hero.label })}
          onClick={() => stop(hero.id)}
          className={cn(
            TIMER_TAP_TARGET_CLASS,
            'flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-foreground/10 transition-colors duration-200 ease-brand hover:bg-primary-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50'
          )}
        >
          <Icon name="close" size="xl" />
        </button>
      </div>

      {strip.length > 0 ? (
        <div
          data-testid="hub-timer-strip"
          className="flex w-full max-w-full items-center justify-center gap-4 overflow-x-auto pb-1"
        >
          {strip.map((timer) => (
            <button
              key={timer.id}
              type="button"
              data-testid="hub-timer-strip-item"
              aria-label={t('remainingLabel', {
                time: formatCountdown(remainingSeconds(timer, now)),
              })}
              onClick={() => setHeroId(timer.id)}
              className="shrink-0 rounded-3xl focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {ringFor(timer, 'strip')}
            </button>
          ))}
        </div>
      ) : null}
    </main>
  );
}
