'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Icon } from './icon';

/**
 * The M12 two-tap confirmation, extracted (M18).
 *
 * `modules/devices/ui/device-list.tsx` invented this shape in M12 — "a single
 * stray tap must not be enough" — and it stayed a one-off while three other
 * destructive controls in the app (delete routine, delete reward, remove
 * member) kept firing on the first press. This is the same interaction, in one
 * place, so the answer to "how does this app confirm something" has one shape.
 *
 * **Why not `AlertDialog` everywhere?** Weight has to match stake. A modal
 * traps focus, dims the page and demands a decision; that is right when the
 * action takes *other* data with it and the parent needs a sentence with a
 * number in it ("214 events disappear") — which is exactly where
 * `alert-dialog.tsx` is used. It is wrong for one row in a list, where the row
 * itself is the context and the question fits beside it.
 *
 * Mechanically this is a `type="submit"` that only *exists* after the first
 * tap: the trigger is a plain button, and the real submit is rendered in its
 * place. So a form posting on the second press is the browser's own behaviour
 * rather than a synthetic dispatch, and the enclosing `<form action={…}>` keeps
 * working with progressive enhancement intact.
 *
 * Two things the extraction had to add, because the one-off never needed them:
 *
 * - **The armed confirm takes focus.** The trigger it replaced has just been
 *   unmounted, so without this the focus ring lands back on `<body>` and a
 *   keyboard or screen-reader user is told nothing changed while the whole
 *   question appeared in front of a mouse user.
 * - **`pending` disarms on settle.** The action can come back an *error* — a
 *   caregiver who may not delete, a row somebody else already removed — and the
 *   component stays mounted. Leaving it armed leaves a live one-tap destructive
 *   button sitting under the parent's finger next to an error message. Settled
 *   means "answer this again from the start", so it returns to rest.
 */
export function ConfirmButton({
  /** The resting label — what the parent sees before anything is asked. */
  children,
  /** The question, shown in place of nothing once armed. */
  question,
  /** The affirmative label; the button that actually submits. */
  confirmLabel,
  /** Accessible name of the resting trigger, when `children` is an icon. */
  triggerLabel,
  /** The negative label; returns the control to rest without submitting. */
  cancelLabel = 'Cancel',
  disabled = false,
  pending = false,
  className,
  testId,
  compact = false,
}: {
  children: ReactNode;
  question: string;
  confirmLabel: string;
  triggerLabel?: string;
  cancelLabel?: string;
  disabled?: boolean;
  /** The enclosing action's in-flight flag. Falling edge disarms the control. */
  pending?: boolean;
  className?: string;
  testId?: string;
  /**
   * The icon-only trigger a dense list row uses. The two-tap confirmation is
   * unchanged — only the resting state shrinks, because a row of near-identical
   * items should not be a column of large red buttons. `triggerLabel` becomes
   * the control's whole accessible name, so it is required in practice.
   */
  compact?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (armed) confirmRef.current?.focus();
  }, [armed]);

  useEffect(() => {
    // Falling edge only: the action settled, whatever it settled as.
    if (wasPending.current && !pending) setArmed(false);
    wasPending.current = pending;
  }, [pending]);

  if (!armed) {
    return (
      <Button
        type="button"
        variant={compact ? 'ghost' : 'destructive'}
        size={compact ? 'icon' : 'hub'}
        disabled={disabled}
        aria-label={triggerLabel}
        onClick={() => setArmed(true)}
        className={cn(compact && 'shrink-0 text-ink-muted', className)}
        data-testid={testId}
      >
        {compact ? <Icon name="delete" size="sm" /> : children}
      </Button>
    );
  }

  return (
    <span className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-body-sm text-muted-foreground">{question}</span>
      <Button
        ref={confirmRef}
        type="submit"
        variant="destructive"
        size={compact ? 'sm' : 'hub'}
        disabled={disabled || pending}
        data-testid={testId ? `${testId}-yes` : undefined}
      >
        {confirmLabel}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={compact ? 'sm' : 'hub'}
        onClick={() => setArmed(false)}
        data-testid={testId ? `${testId}-cancel` : undefined}
      >
        {cancelLabel}
      </Button>
    </span>
  );
}
