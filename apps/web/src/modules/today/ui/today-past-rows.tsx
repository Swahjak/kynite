'use client';

import { useState, type ReactNode } from 'react';
import { cn, Icon } from '@kynite/ui';

/**
 * The collapsed "already happened" band at the top of the day timeline.
 *
 * A day read at four in the afternoon is mostly behind you, and a timeline that
 * opens with six struck-through rows buries the one thing the screen is for.
 * So the morning collapses into a single line — "3 afgerond — Ontbijt (07:30)"
 * — that names the *last* thing that happened, which is the only part of the
 * past a person scanning this actually reaches for.
 *
 * It is a disclosure, not a filter: everything is still here, one tap away, and
 * the rows themselves are server-rendered and handed through as `children`.
 * Nothing about the past is fetched when it is opened.
 *
 * A `<button>` with `aria-expanded` rather than `<details>`: the summary has to
 * sit *outside* the timeline's own indentation while the rows sit inside it,
 * which `<details>` cannot express without duplicating the layout.
 *
 * On the phone the toggle is not a line of its own: the design puts the
 * section's eyebrow on the left of one row and "⌄ 1 afgerond" on the right of
 * it ("Vandaag.dc.html":377–380). `header` is that left half — passed in rather
 * than assumed, because the wall's list keeps the toggle inline under a real
 * card heading and has no header to share the row with.
 *
 * Sharing the row is what dictates the widths: the eyebrow keeps its full
 * width and the *toggle* is the part that gives, so the summary — which ends
 * in an event title and is therefore arbitrarily long — truncates rather than
 * crowding "DAGOVERZICHT" or pushing the chevron to the card's edge. Hence
 * `min-w-0` on both flex parents (without it a flex item refuses to shrink
 * below its content) and `shrink-0` on the chevron.
 *
 * The chevron's size follows the branch, because the two branches are two
 * different reading distances. On the phone the sheet sets it at 16px
 * ("Vandaag.dc.html":378) next to 12px caption text — that is `xs+`. The wall's
 * list has no header to share a row with, sits under a real card heading in
 * `text-body-sm`, and is read from across a room, so it keeps `sm` (18).
 */

export function TodayPastRows({
  summary,
  label,
  header,
  children,
}: {
  /** "3 afgerond — Ontbijt (07:30)". */
  summary: string;
  /** Accessible name of the toggle, e.g. "Toon eerdere afspraken". */
  label: string;
  /** The section's own heading, put on the toggle's row and pushed left. */
  header?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <div
        className={header ? 'flex min-w-0 items-center justify-between gap-3 pb-2.5' : 'contents'}
      >
        {header ? <div className="shrink-0">{header}</div> : null}
        <button
          type="button"
          data-testid="today-past-toggle"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen((previous) => !previous)}
          className={
            header
              ? 'flex min-w-0 items-center gap-1.5 rounded-lg text-ink-muted transition-colors duration-200 hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'
              : 'flex items-center gap-2 self-start rounded-lg py-1 pb-3.5 pl-14 text-ink-muted transition-colors duration-200 hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'
          }
        >
          <Icon
            name="expand_more"
            size={header ? 'xs+' : 'sm'}
            className={cn('shrink-0 transition-transform', open && 'rotate-180')}
          />
          <span className={header ? 'truncate text-caption' : 'text-body-sm'}>{summary}</span>
        </button>
      </div>

      {open ? <div className="flex flex-col">{children}</div> : null}
    </div>
  );
}
