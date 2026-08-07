'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import type { IconName } from '@/components/ui/icon-codepoints';
import { cn } from '@/lib/utils';
import { extendTimerAction, startTimerAction, stopTimerAction } from '../actions';
import {
  DURATION_PRESETS,
  EXTEND_PRESET_MINUTES,
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
 * A section heading with the stitch icon medallion beside it — the same shape
 * the rewards queue uses, so the two parent surfaces read as one product.
 */
function SectionHeading({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-h2 font-bold">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface-container text-ink-secondary"
      >
        <Icon name={icon} size="md" />
      </span>
      {children}
    </h2>
  );
}

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
  /**
   * Timers the server has told us are already as long as they get.
   *
   * M19 review: the hub board states this and `(app)/timers` swallowed it — the
   * same tap, on the same timer, answered on one surface and silently did
   * nothing on the other. Kept per timer, for the reason `TimerBoard` gives:
   * two countdowns are two questions.
   */
  const [atMaximum, setAtMaximum] = useState<ReadonlySet<string>>(new Set());

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

  const extend = (timerId: string, minutes: number) => {
    startTransition(async () => {
      const result = await extendTimerAction({ timerId, minutes });
      if (result.status !== 'atMaximum') return;
      setAtMaximum((previous) => new Set(previous).add(timerId));
    });
  };

  const copyFor = (timer: TimerView) => ({
    warning: t('warning', { label: timer.label, minutes: minutesRemaining(timer, now) }),
    overrun: t('overrun'),
    remainingLabel: t('remainingLabel', { time: formatCountdown(remainingSeconds(timer, now)) }),
    stopLabel: t('actions.stopNamed', { label: timer.label }),
    atMaximum: t('atMaximum'),
  });

  return (
    <div className="flex flex-col gap-8" data-testid="timer-controls">
      <section className="flex flex-col gap-4">
        <SectionHeading icon="hourglass_top">{t('running')}</SectionHeading>
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
                extendOptions={
                  page.canControl
                    ? EXTEND_PRESET_MINUTES.map((minutes) => ({
                        minutes,
                        label: t('actions.extend', { minutes }),
                        ariaLabel: t('actions.extendNamed', { label: timer.label, minutes }),
                      }))
                    : undefined
                }
                onExtend={page.canControl ? (minutes) => extend(timer.id, minutes) : undefined}
                atMaximum={atMaximum.has(timer.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading icon="add">{t('adHoc.title')}</SectionHeading>

        {/* The composer is one panel rather than three loose controls: label,
            who it is for, then the duration presets that start it. Card
            radius, elevation, no outline (docs/rebuild-design-gaps.md §7). */}
        <div className="flex flex-wrap items-end gap-4 rounded-2xl bg-surface-container-lowest p-4 shadow-sm sm:p-6">
          <label className="flex flex-col gap-1 text-body-sm text-ink-secondary">
            {t('adHoc.label')}
            <input
              data-testid="timer-label-input"
              value={label}
              onChange={(event) => setLabel(event.currentTarget.value)}
              placeholder={t('adHoc.labelPlaceholder')}
              maxLength={120}
              className="h-12 w-full min-w-0 rounded-xl border border-line bg-surface-container-low px-4 text-body transition-colors duration-200 ease-brand focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:w-64"
            />
          </label>

          <label className="flex flex-col gap-1 text-body-sm text-ink-secondary">
            {t('adHoc.member')}
            <select
              data-testid="timer-member-select"
              value={memberId}
              onChange={(event) => setMemberId(event.currentTarget.value)}
              className="h-12 w-full min-w-0 rounded-xl border border-line bg-surface-container-low px-4 text-body transition-colors duration-200 ease-brand focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:w-48"
            >
              <option value="">{t('adHoc.everyone')}</option>
              {page.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>

          {/* The presets are pills, and they are the *start* control: a
              duration is picked and the timer runs. Shared `<Button>` at hub
              size, so a parent starting one on a phone gets the same 48px
              target the wall does. */}
          <div
            role="group"
            aria-label={t('adHoc.duration')}
            className="flex flex-wrap items-center gap-2"
          >
            {DURATION_PRESETS.map((seconds) => (
              <Button
                key={seconds}
                type="button"
                variant="outline"
                size="hub"
                data-testid={`timer-preset-${seconds}`}
                disabled={!page.canControl || label.trim().length === 0}
                onClick={() =>
                  start({
                    label: label.trim(),
                    durationSeconds: seconds,
                    memberId: memberId || undefined,
                  })
                }
                className={cn(TIMER_TAP_TARGET_CLASS, 'tabular-time rounded-4xl px-5')}
              >
                {t('minutes', { minutes: Math.round(seconds / 60) })}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading icon="checklist">{t('fromSteps.title')}</SectionHeading>
        {page.stepOptions.length === 0 ? (
          <p className="text-body text-ink-secondary">{t('fromSteps.empty')}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
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
                    'flex w-full items-center gap-3 rounded-2xl bg-surface-container-lowest px-4 py-3 text-left text-body shadow-sm',
                    'transition-all duration-200 ease-brand hover:shadow-md active:scale-[0.99] disabled:opacity-50 disabled:hover:shadow-sm',
                    'focus-visible:ring-3 focus-visible:ring-ring/50'
                  )}
                >
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-container text-brand-container-ink"
                  >
                    <Icon name="timer" size="md" filled />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {option.routineTitle} — {option.stepTitle}
                  </span>
                  <span className="tabular-time shrink-0 rounded-4xl bg-surface-container px-3 py-1 text-body-sm text-ink-secondary">
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
