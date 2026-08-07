'use client';

import { useEffect, useRef } from 'react';
import { toast } from './toast';

/**
 * The quiet confirmation a settings form owes its user (M18).
 *
 * Every `useActionState` form in this app has the same problem: a successful
 * save returns `idleState`, which is byte-identical to the state the form
 * started in, so the page simply… does nothing. A parent who taps "Opslaan" and
 * sees no change reasonably concludes the button is broken and taps it again.
 * The toast system was built in M15 and mounted only in `/dev/design`; this is
 * the hook that puts it to work.
 *
 * It fires on the *transition* out of pending, not on state identity — an
 * action that returns the same value twice still confirms twice, because the
 * user pressed the button twice and both presses did something.
 *
 * Deliberately not a replacement for inline errors. A form that renders its
 * own `role="alert"` keeps it: an error has to survive being missed, and a
 * toast that has already dismissed itself cannot be re-read. Pass `error` only
 * where there is no inline surface for it.
 */
export function useActionToast(
  state: { status: string },
  pending: boolean,
  copy: { success: string; error?: string }
): void {
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      if (state.status === 'error') {
        if (copy.error) toast.add({ title: copy.error, type: 'error' });
      } else {
        toast.add({ title: copy.success, type: 'success' });
      }
    }
    wasPending.current = pending;
  }, [pending, state.status, copy.success, copy.error]);
}
