'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { startTimerAction, stopTimerAction } from '../actions';
import {
  DURATION_PRESETS,
  formatCountdown,
  minutesRemaining,
  remainingSeconds,
} from '../domain/countdown';
import type { TimersPageData, TimerView } from '../page-data';
import { TimerTile } from './timer-tile';
import { TIMER_TAP_TARGET_CLASS } from './tokens';
import { useServerNow } from './use-server-now';
import { useTimerChannel } from './use-timer-channel';

/**
 * The Controller's timer surface (`(app)/timers`) — parent-facing, and the
 * "start/stop from the Controller reflects on the hub" half of M09.
 *
 * Two ways to start one, because the two are genuinely different intents:
 * a routine step's prescription ("Tanden poetsen, 2 minuten" — the duration a
 * parent already decided once), and an ad hoc timer typed in the moment.
 * Both land in the same row shape; only the provenance columns differ.
 *
 * This component is parent-only and pinned as such in
 * `tests/unit/no-negative-marking.test.ts`: nothing on the hub imports it.
 */
export function TimerControls({ page }: { page: TimersPageData }) {
  const t = useTranslations('timers');
  const { timers, offsetMs } = useTimerChannel({
    familyId: page.familyId,
    serverNow: page.serverNow,
    timers: page.running,
    frozen: false,
  });
  const now = useServerNow(page.serverNow, offsetMs);
  const [, startTransition] = useTransition();

  const [label, setLabel] = useState('');
  const [memberId, setMemberId] = useState('');

  const start = (input: Parameters<typeof startTimerAction>[0]) => {
    startTransition(async () => {
      await startTimerAction({ ...input, clientId: crypto.randomUUID() });
    });
  };

  const stop = (timerId: string) => {
    startTransition(async () => {
      await stopTimerAction({ timerId });
    });
  };

  const copyFor = (timer: TimerView) => ({
    warning: t('warning', { label: timer.label, minutes: minutesRemaining(timer, now) }),
    overrun: t('overrun'),
    remainingLabel: t('remainingLabel', { time: formatCountdown(remainingSeconds(timer, now)) }),
    stopLabel: t('actions.stopNamed', { label: timer.label }),
  });

  return (
    <div className="flex flex-col gap-8" data-testid="timer-controls">
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h2 font-bold">{t('running')}</h2>
        {timers.length === 0 ? (
          <p data-testid="timer-controls-empty" className="text-body text-ink-secondary">
            {t('empty')}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {timers.map((timer) => (
              <TimerTile
                key={timer.id}
                timer={timer}
                nowMs={now}
                copy={copyFor(timer)}
                compact
                onStop={() => stop(timer.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h2 font-bold">{t('adHoc.title')}</h2>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-body-sm text-ink-secondary">
            {t('adHoc.label')}
            <input
              data-testid="timer-label-input"
              value={label}
              onChange={(event) => setLabel(event.currentTarget.value)}
              placeholder={t('adHoc.labelPlaceholder')}
              maxLength={120}
              className="h-12 w-64 rounded-lg bg-surface px-3 text-body ring-1 ring-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>

          <label className="flex flex-col gap-1 text-body-sm text-ink-secondary">
            {t('adHoc.member')}
            <select
              data-testid="timer-member-select"
              value={memberId}
              onChange={(event) => setMemberId(event.currentTarget.value)}
              className="h-12 w-48 rounded-lg bg-surface px-3 text-body ring-1 ring-foreground/10"
            >
              <option value="">{t('adHoc.everyone')}</option>
              {page.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>

          <div role="group" aria-label={t('adHoc.duration')} className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                data-testid={`timer-preset-${seconds}`}
                disabled={!page.canControl || label.trim().length === 0}
                onClick={() =>
                  start({
                    label: label.trim(),
                    durationSeconds: seconds,
                    memberId: memberId || undefined,
                  })
                }
                className={cn(
                  TIMER_TAP_TARGET_CLASS,
                  'rounded-lg bg-surface px-4 text-body font-medium ring-1 ring-foreground/10',
                  'transition-colors duration-200 ease-brand hover:bg-accent disabled:opacity-50',
                  'focus-visible:ring-3 focus-visible:ring-ring/50'
                )}
              >
                {t('minutes', { minutes: Math.round(seconds / 60) })}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h2 font-bold">{t('fromSteps.title')}</h2>
        {page.stepOptions.length === 0 ? (
          <p className="text-body text-ink-secondary">{t('fromSteps.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {page.stepOptions.map((option) => (
              <li key={option.routineStepId}>
                <button
                  type="button"
                  data-testid="step-timer-start"
                  data-step-id={option.routineStepId}
                  disabled={!page.canControl}
                  onClick={() => start({ routineStepId: option.routineStepId })}
                  className={cn(
                    TIMER_TAP_TARGET_CLASS,
                    'flex w-full items-center gap-3 rounded-lg bg-surface px-4 text-left text-body ring-1 ring-foreground/10',
                    'transition-colors duration-200 ease-brand hover:bg-accent disabled:opacity-50',
                    'focus-visible:ring-3 focus-visible:ring-ring/50'
                  )}
                >
                  <Icon name="timer" size="sm" />
                  <span className="min-w-0 flex-1 truncate">
                    {option.routineTitle} — {option.stepTitle}
                  </span>
                  <span className="tabular-time shrink-0 text-ink-secondary">
                    {formatCountdown(option.timerSeconds)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
