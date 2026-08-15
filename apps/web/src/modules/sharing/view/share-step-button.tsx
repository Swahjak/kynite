'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { cn, Icon } from '@kynite/ui';

/**
 * The one interactive control on the whole `(share)` surface: a contributor
 * ticking a step.
 *
 * **Why `fetch`, not a Server Action.** The `(share)` tree imports zero Server
 * Actions (docs/architecture.md §2), enforced by a lint rule and a repo scan,
 * and `src/proxy.ts` refuses any non-GET request to `/s/*` — which a Server
 * Action POST would be. So a contributor's tick leaves the page as an ordinary
 * `POST /api/share/completions`, outside the tree and outside the proxy's
 * share matcher, where the token is re-resolved into a principal server-side
 * and `can('completion:write', { memberId })` is asked again. Nothing about
 * this component is trusted: it is an affordance, not an authorization.
 *
 * The token travels in the request body. It is already in the URL bar of the
 * page this button is rendered on, so no new exposure — but the body rather
 * than the path means it stays out of access logs and out of the `Referer` a
 * `Referrer-Policy: no-referrer` header is separately there to suppress.
 *
 * Optimistic and irreversible-looking on purpose: the tick lands immediately
 * and there is no failure state on this path (FR11, research §"no negative
 * marking"). A request that is refused simply leaves the step as it was.
 */
export function ShareStepButton({
  token,
  routineId,
  routineStepId,
  memberId,
  occurrenceDate,
  clientId,
  title,
  done,
}: {
  token: string;
  routineId: string;
  routineStepId: string;
  memberId: string;
  occurrenceDate: string;
  clientId: string;
  title: string;
  done: boolean;
}) {
  const t = useTranslations('sharing.view');
  const [ticked, setTicked] = useState(done);
  const [pending, startTransition] = useTransition();

  const isDone = done || ticked;

  function tick() {
    if (isDone || pending) return;
    setTicked(true);

    startTransition(async () => {
      await fetch('/api/share/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          routineId,
          routineStepId,
          memberId,
          occurrenceDate,
          clientId,
        }),
      }).catch(() => {
        // Deliberately silent. A caregiver on a phone in someone else's hallway
        // cannot act on a network error, and the step being un-ticked on the
        // next load is a truer signal than a toast they will not read.
      });
    });
  }

  return (
    <button
      type="button"
      onClick={tick}
      disabled={isDone}
      aria-pressed={isDone}
      data-testid="share-step"
      className={cn(
        // M19 phase 2: the 48px hub target and the design system's radius,
        // shared with the read-only twin in `share-board.tsx` so the two shapes
        // differ only in whether they can be pressed.
        'flex min-h-hub-target w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left text-body transition-all duration-200 ease-brand active:scale-[0.99]',
        isDone ? 'bg-surface-container text-ink-muted' : 'bg-card shadow-sm hover:bg-surface-hover'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full border',
          isDone ? 'border-transparent bg-primary text-primary-foreground' : 'border-border'
        )}
      >
        {isDone ? <Icon name="check" size="sm" /> : null}
      </span>
      <span className={cn(isDone && 'line-through')}>{title}</span>
      <span className="sr-only">{isDone ? t('stepDone') : t('stepTodo')}</span>
    </button>
  );
}
