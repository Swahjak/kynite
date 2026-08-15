'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * One-shot guard for a destructive submit (M18).
 *
 * `useActionState`'s `pending` does not flip on the click; it flips when React
 * has actually started the transition, which is at least a frame later. A
 * double-tap on a wall tablet, or an impatient second click on a slow action,
 * therefore lands *before* `disabled={pending}` is true and posts the form
 * twice — two unlink attempts, two deletes, two error toasts.
 *
 * So the button disables itself the moment it is activated, on its own state,
 * and only re-arms on the falling edge of `pending` — i.e. when the action has
 * actually settled. That covers the failure case too: an action that comes back
 * `forbidden` leaves the dialog open, and the parent gets a working button back
 * rather than a dead one.
 *
 * Usage: `<form onSubmit={lock}>` … `<Button disabled={locked} />`.
 */
export function useSubmitGuard(pending: boolean): {
  locked: boolean;
  lock: () => void;
} {
  const [submitted, setSubmitted] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) setSubmitted(false);
    wasPending.current = pending;
  }, [pending]);

  return { locked: submitted || pending, lock: () => setSubmitted(true) };
}
