'use client';

import {
  useState,
  useTransition,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import { Button, cn, Icon, useFabSpeedDialAction } from '@kynite/ui';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRouter } from '@/i18n/navigation';
import { startTimerAction } from '../actions';
import { DURATION_PRESETS } from '../domain/countdown';
import { DEFAULT_TIMER_ICON, TIMER_ICONS, TIMER_TAP_TARGET_CLASS, type TimerIcon } from './tokens';

/**
 * The hub FAB's "start a timer" action (M-T2) — a modal in place of what used
 * to be a plain link to `/hub/timers`. The child taps the FAB, picks a length
 * and a picture, and lands straight on the countdown (`/hub/timer`) rather
 * than on a board they then have to tap a preset on — the same number of taps
 * either way, but the second one now *is* the countdown instead of a detour
 * through it.
 *
 * Shaped exactly like `AddEventFabAction`/`TaskComposerFabAction`
 * (`modules/calendar`, `modules/tasks`): a plain `<button>` that
 * `FabSpeedDialAction.render` clones its FAB chrome onto, opening a dialog
 * this component owns, rather than a `DialogTrigger` — `FabSpeedDial` already
 * *is* the trigger. When the element arrives as a React Flight lazy
 * reference `cloneElement` can't read (crossing the hub page's
 * Server→Client boundary), `FabSpeedDial` renders it as-is instead and this
 * component reads the same chrome back via `useFabSpeedDialAction()` (see
 * `FabSpeedDialActionSlot`). `TodayFab` (`modules/today`) may not import this slice's
 * barrel from a client component (`server-only` reads live behind it), so —
 * same as the calendar/tasks pair — the slice that owns the dialog owns the
 * button that opens it, and the hub page hands the finished element down as
 * `timerAction`.
 *
 * **Every `TIMER_ICONS` entry renders through `<Icon name={option}>`** — the
 * subset-font promise `ui/tokens.ts` and `scripts/subset-icons.mjs` both
 * describe: a name in that closed set is only actually shipped in the font
 * once *something* renders it, and this picker is that something.
 */
export type TimerStartFabActionProps = {
  // The props `FabSpeedDial` clones onto `action.render` — same union
  // `AddEventFabAction` takes.
  className?: string;
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  style?: CSSProperties;
  'aria-disabled'?: boolean;
  tabIndex?: number;
  'data-testid'?: string;
};

export function TimerStartFabAction({
  onClick,
  children,
  ...cloneProps
}: TimerStartFabActionProps) {
  const [open, setOpen] = useState(false);
  // Fallback for when `FabSpeedDial` could not `cloneElement` this element
  // (see `FabSpeedDialActionSlot`) — `null` on the ordinary clone path, where
  // `cloneProps` already carries everything below directly.
  const slot = useFabSpeedDialAction();

  const buttonClassName = cloneProps.className ?? slot?.className;
  const kids = children ?? slot?.children;
  const style = cloneProps.style ?? slot?.style;
  const testId = cloneProps['data-testid'] ?? slot?.['data-testid'];
  const ariaDisabled = cloneProps['aria-disabled'] ?? slot?.disabled;

  return (
    <>
      <button
        type="button"
        {...cloneProps}
        className={buttonClassName}
        style={style}
        aria-disabled={ariaDisabled}
        data-testid={testId}
        onClick={(event) => {
          onClick?.(event);
          setOpen(true);
          // No-op on the clone path — `FabSpeedDial` already composed the
          // close into `onClick` above.
          slot?.onClick(event);
        }}
      >
        {kids}
      </button>
      {/* Remounted per opening (same `key` trick `AddEventFabAction` uses) so a
          cancelled open never leaves a stale duration/icon selection for the
          next one. */}
      {open ? <TimerStartForm key="open" onOpenChange={setOpen} /> : null}
    </>
  );
}

function TimerStartForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('timers');
  const hub = useTranslations('hub.timers');
  const common = useTranslations('common');
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  // Review fix: a failed start used to close the dialog with no trace of why
  // — the child taps "start", the sheet vanishes, and nothing happened. Kept
  // open with the same `errors.<key>` inline message `reward-dialog.tsx` /
  // `pair-code-form.tsx` already use for a Server Action's `ActionState`.
  const [error, setError] = useState<string | null>(null);

  const [seconds, setSeconds] = useState<number>(DURATION_PRESETS[1]);
  const [icon, setIcon] = useState<TimerIcon>(DEFAULT_TIMER_ICON);

  const minutes = Math.round(seconds / 60);

  const start = () => {
    if (pending) return;
    setPending(true);
    setError(null);

    startTransition(async () => {
      try {
        const result = await startTimerAction({
          label: hub('quickStartLabel', { minutes }),
          durationSeconds: seconds,
          icon,
          clientId: crypto.randomUUID(),
        });
        if (result.status === 'error') {
          setError(result.error);
          return;
        }
        onOpenChange(false);
        router.push('/hub/timer');
      } finally {
        setPending(false);
      }
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="hub" className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hub('startTitle')}</DialogTitle>
          <DialogDescription>{t('adHoc.duration')}</DialogDescription>
        </DialogHeader>

        <div
          role="radiogroup"
          aria-label={t('adHoc.duration')}
          className="flex flex-wrap items-center gap-2"
        >
          {DURATION_PRESETS.map((option) => {
            const selected = option === seconds;
            return (
              <label key={option} className="cursor-pointer">
                <input
                  type="radio"
                  name="timerDuration"
                  value={option}
                  checked={selected}
                  onChange={() => setSeconds(option)}
                  className="sr-only"
                />
                <span
                  data-testid={`timer-fab-duration-${option}`}
                  className={cn(
                    TIMER_TAP_TARGET_CLASS,
                    'tabular-time flex items-center justify-center rounded-4xl px-5 text-body-lg font-medium transition-colors duration-200 ease-brand',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-container text-ink-secondary hover:bg-surface-hover'
                  )}
                >
                  {t('minutes', { minutes: Math.round(option / 60) })}
                </span>
              </label>
            );
          })}
        </div>

        <div
          role="radiogroup"
          aria-label={hub('pickIcon')}
          className="flex flex-wrap items-center gap-2"
        >
          {TIMER_ICONS.map((option) => {
            const selected = option === icon;
            return (
              <label
                key={option}
                data-testid={`timer-fab-icon-${option}`}
                className="cursor-pointer"
              >
                <input
                  type="radio"
                  name="timerIcon"
                  value={option}
                  checked={selected}
                  onChange={() => setIcon(option)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    'flex size-12 items-center justify-center rounded-xl transition-colors duration-200 ease-brand',
                    selected
                      ? 'border-2 border-primary bg-brand-container text-brand'
                      : 'bg-surface-container text-ink-muted hover:text-ink-secondary'
                  )}
                >
                  <Icon name={option} size="md" label={t(`icons.${option}`)} />
                </span>
              </label>
            );
          })}
        </div>

        {error ? (
          // No alarm styling on a surface a child sees (FR11/FR13): same
          // neutral `ink-secondary` treatment `pair-code-form.tsx` uses for
          // its own inline `ActionState` error, not `text-destructive`.
          <p role="alert" className="text-sm text-ink-secondary">
            {t(`errors.${error}`)}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" size="hub" className={TIMER_TAP_TARGET_CLASS}>
                {common('cancel')}
              </Button>
            }
          />
          <Button
            type="button"
            size="hub"
            data-testid="timer-fab-start"
            disabled={pending}
            onClick={start}
            className={cn(TIMER_TAP_TARGET_CLASS, 'rounded-4xl')}
          >
            {hub('startAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
