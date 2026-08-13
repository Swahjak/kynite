'use client';

import { useFormatter, useNow } from 'next-intl';

/**
 * The shell's live clock — weekday + date over a tabular time.
 *
 * Before M19 the only clock in the product was on the hub; the mockups put one
 * in the parent app's header too (`docs/rebuild-design-gaps.md` §2), because the
 * app is read at a glance on the way out of the door as much as the wall
 * tablet is.
 *
 * `useNow` rather than a hand-rolled `setInterval`: it seeds from the server
 * render (so the first paint is not blank and does not mismatch) and it formats
 * through `useFormatter`, which resolves the *family's* timezone from the
 * provider `(app)/layout.tsx` installs — not the server's and not the browser's.
 *
 * 30s is the right tick for a `HH:mm` display: the label can lag the minute
 * boundary by at most half a minute, and the component re-renders 120× an hour
 * instead of 3,600×.
 */
export function AppClock() {
  const now = useNow({ updateInterval: 30_000 });
  const format = useFormatter();

  return (
    <div className="flex flex-col justify-center">
      <time
        data-testid="app-clock"
        dateTime={now.toISOString()}
        className="tabular-time text-h2 leading-none font-bold text-ink"
      >
        {format.dateTime(now, { hour: '2-digit', minute: '2-digit' })}
      </time>
      <span data-testid="app-clock-date" className="label-overline mt-1 text-ink-secondary">
        {format.dateTime(now, { weekday: 'long', day: 'numeric', month: 'short' })}
      </span>
    </div>
  );
}
