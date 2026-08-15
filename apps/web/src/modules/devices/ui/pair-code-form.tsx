'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { PAIRING_CODE_LENGTH, normalizePairingCode } from '@/lib/device-session';
import { pairDeviceIdle, type PairDeviceState } from '../action-state';
import { pairDeviceAction } from '../actions';

/**
 * The kiosk half of pairing: six digits, one keypad, no keyboard.
 *
 * A wall tablet has no hardware keyboard and the software one covers half the
 * screen, so the digits are entered on an on-screen pad of 72px keys — well
 * past the 48px kiosk minimum, because this is the one screen an adult uses
 * standing up at arm's length. The boxes are `readOnly` display, not inputs:
 * there is nothing to focus and therefore nothing to summon the OS keyboard.
 *
 * Copy note: this file sits inside a child-facing tree, and a child *will*
 * stand in front of it. Nothing here scolds, counts down failures out loud or
 * calls anyone wrong — a bad code is reported as "that code did not work",
 * which is a fact about the code.
 */
export function PairCodeForm() {
  const t = useTranslations('devices.hubPair');
  const router = useRouter();
  const [digits, setDigits] = useState('');
  const [state, setState] = useState<PairDeviceState>(pairDeviceIdle);
  const [pending, startTransition] = useTransition();

  const complete = digits.length === PAIRING_CODE_LENGTH;

  const press = (digit: string) => {
    if (pending || state.status === 'paired') return;
    setState(pairDeviceIdle);
    setDigits((current) => (current + digit).slice(0, PAIRING_CODE_LENGTH));
  };

  const backspace = () => {
    if (pending || state.status === 'paired') return;
    setState(pairDeviceIdle);
    setDigits((current) => current.slice(0, -1));
  };

  const submit = () => {
    const code = normalizePairingCode(digits);
    if (!code) return;

    startTransition(async () => {
      const result = await pairDeviceAction({ code });
      setState(result);
      if (result.status === 'paired') {
        // The cookie is set; a refresh re-runs the page, which now resolves a
        // device principal and sends the tablet to the board. The client does
        // not navigate on its own — the server decides where a paired hub
        // belongs, and that stays true if the landing surface ever changes.
        router.refresh();
        return;
      }
      // A failed code is cleared rather than left in the boxes: retyping six
      // digits is less work than finding which one was wrong.
      setDigits('');
    });
  };

  return (
    <div className="flex flex-col items-center gap-8" data-testid="pair-form">
      <div className="flex gap-3" aria-live="polite" aria-label={t('entered')}>
        {Array.from({ length: PAIRING_CODE_LENGTH }, (_, index) => (
          <span
            key={index}
            data-testid="pair-digit"
            className="flex h-20 w-14 items-center justify-center rounded-xl border-2 border-border bg-card font-display text-display-md tabular-time"
          >
            {digits[index] ?? ''}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <Button
            key={digit}
            type="button"
            variant="outline"
            size="hub"
            className="h-18 w-18 text-h2"
            onClick={() => press(digit)}
            data-testid={`pair-key-${digit}`}
          >
            {digit}
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="hub"
          className="h-18 w-18"
          onClick={backspace}
          aria-label={t('backspace')}
          data-testid="pair-key-backspace"
        >
          <Icon name="chevron_left" size="lg" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="hub"
          className="h-18 w-18 text-h2"
          onClick={() => press('0')}
          data-testid="pair-key-0"
        >
          0
        </Button>
        <Button
          type="button"
          size="hub"
          className="h-18 w-18"
          disabled={!complete || pending}
          onClick={submit}
          aria-label={t('confirm')}
          data-testid="pair-submit"
        >
          <Icon name="check" size="lg" />
        </Button>
      </div>

      <p
        role="status"
        aria-live="polite"
        className="min-h-8 text-center text-body-lg text-ink-secondary"
        data-testid="pair-status"
      >
        {state.status === 'error' ? t(`errors.${state.error}`) : null}
        {state.status === 'paired' ? t('paired', { name: state.deviceName }) : null}
      </p>
    </div>
  );
}
