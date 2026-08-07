'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * The kiosk error boundary (M18).
 *
 * A wall tablet has nobody in front of it. The parent-app boundary offers a
 * "try again" button, which is the right answer for a phone in a hand and the
 * wrong one for a screen in a hallway: the failure would sit there until
 * somebody walked past, noticed, and thought to tap. So this one *recovers on
 * its own* — `reset()` after a short pause, which re-renders the segment
 * without a full reload and therefore without losing the device session or the
 * service worker.
 *
 * The copy obeys the same law as everything else on this surface (PRD FR30,
 * `tests/unit/no-negative-marking.test.ts`): it states a fact about the board
 * and says what is about to happen. No red, no alert glyph, no exclamation
 * mark — a child walks past this screen, and a wall that shouts at the room
 * about a stack trace is worse than a wall that is briefly blank.
 */

/** Long enough to not hammer a failing server, short enough to be unnoticed. */
const RETRY_DELAY_MS = 5000;

export default function HubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    // Backs off linearly rather than retrying every five seconds forever: a
    // hub that has been failing for an hour should not still be re-rendering
    // twelve times a minute.
    const handle = setTimeout(
      () => {
        setAttempt((value) => value + 1);
        reset();
      },
      RETRY_DELAY_MS * (attempt + 1)
    );

    return () => clearTimeout(handle);
  }, [attempt, reset]);

  return (
    <main
      data-testid="hub-error"
      data-attempt={attempt}
      className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <h1 className="font-display text-h1 font-bold text-ink">{t('hub.title')}</h1>
      <p aria-live="polite" className="text-body-lg text-ink-secondary">
        {t('hub.body')}
      </p>
    </main>
  );
}
