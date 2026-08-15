import * as React from 'react';

import { cn } from '@kynite/ui';

/**
 * The list row every module drew by hand: a leading visual (an
 * `IconMedallion`, a `MemberFace`, a checkbox), a title with optional meta
 * chips beneath it, and trailing actions.
 *
 * `layout.md` § "Content area" gives the shape for the compact version — a
 * leading marker, `margin-top:6px` to align it with the first text line, and
 * stacked title/sub-label text. `components.md` § `Card/Attention` gives the
 * padded, tinted version.
 *
 * Seven near-identical copies existed across routines, rewards, timers and
 * devices, disagreeing about radius (`xl` vs `2xl`), whether there was a
 * border, and whether the row had a minimum height.
 */
export function MediaRow({
  leading,
  title,
  meta,
  actions,
  variant = 'plain',
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  leading?: React.ReactNode;
  title?: React.ReactNode;
  /** Chips, timestamps, sub-labels — rendered under the title. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /**
   * - `plain`   — no ground of its own; for rows already inside a card.
   * - `tinted`  — the `#f5f3ee` tile the docs use for a row-as-card.
   * - `outlined`— a bordered card row, for lists that are the whole page.
   */
  variant?: 'plain' | 'tinted' | 'outlined';
}) {
  return (
    <div
      data-slot="media-row"
      className={cn(
        'flex min-h-12 flex-wrap items-center justify-between gap-3',
        variant === 'tinted' && 'rounded-2xl bg-surface-container px-4 py-3',
        variant === 'outlined' && 'rounded-2xl border border-line-subtle bg-card p-4 shadow-sm',
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {leading}
        <div className="min-w-0">
          {title ? <div className="font-display font-bold text-ink">{title}</div> : null}
          {meta ? (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-body-sm text-ink-secondary">
              {meta}
            </div>
          ) : null}
          {children}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
