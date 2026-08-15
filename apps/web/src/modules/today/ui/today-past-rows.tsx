'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from '@kynite/ui';

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
 */

export function TodayPastRows({
  summary,
  label,
  children,
}: {
  /** "3 afgerond — Ontbijt (07:30)". */
  summary: string;
  /** Accessible name of the toggle, e.g. "Toon eerdere afspraken". */
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        data-testid="today-past-toggle"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((previous) => !previous)}
        className="flex items-center gap-2 self-start rounded-lg py-1 pb-3.5 pl-14 text-ink-muted transition-colors duration-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Icon
          name="expand_more"
          size="sm"
          className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
        />
        <span className="text-body-sm">{summary}</span>
      </button>

      {open ? <div className="flex flex-col">{children}</div> : null}
    </div>
  );
}
