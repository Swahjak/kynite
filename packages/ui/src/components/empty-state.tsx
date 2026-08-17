import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils';
import { type IconName } from './icon-codepoints';
import { IconMedallion } from './icon-medallion';

/**
 * The zero-state block: optional icon medallion, a title, an optional
 * description, an optional action.
 *
 * Three sizes, because the product shows this at three scales and every one of
 * them was hand-rolled before:
 *
 * - `inline` — inside a card or a list, one line of muted copy.
 * - `page`   — a centred block filling a route's content area.
 * - `hub`    — the same, at kiosk type sizes, for the wall display.
 *
 * `framed` draws the dashed outline the calendar's "free day" states use, so a
 * genuinely empty region still reads as a region.
 */
const emptyStateVariants = cva('flex flex-col items-center text-center', {
  variants: {
    size: {
      inline: 'gap-2 px-4 py-6',
      page: 'mx-auto min-h-64 max-w-md justify-center gap-3 p-6',
      hub: 'min-h-full justify-center gap-3 p-8',
    },
    framed: {
      // Hairline. The dashed frame marks a region, which is not one of the
      // three jobs the 2px emphasis width is reserved for.
      true: 'rounded-2xl border border-dashed border-line-subtle',
      false: '',
    },
  },
  defaultVariants: { size: 'inline', framed: false },
});

const TITLE_CLASS = {
  inline: 'font-display text-body font-bold text-ink',
  page: 'font-display text-h2 font-bold text-ink',
  hub: 'font-display text-h1 font-bold text-ink',
} as const;

const BODY_CLASS = {
  inline: 'text-body-sm text-ink-secondary',
  page: 'text-body text-ink-secondary',
  hub: 'text-body-lg text-ink-secondary',
} as const;

const MEDALLION_SIZE = { inline: 'lg', page: '2xl', hub: '3xl' } as const;

export type EmptyStateProps = Omit<React.ComponentProps<'div'>, 'title'> &
  VariantProps<typeof emptyStateVariants> & {
    icon?: IconName;
    title: React.ReactNode;
    description?: React.ReactNode;
    /** A button, a link, or nothing. Rendered under the copy. */
    action?: React.ReactNode;
    /** Renders the title as an `<h1>` rather than a `<p>` (error/404 pages). */
    heading?: boolean;
  };

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'inline',
  framed = false,
  heading = false,
  className,
  ...props
}: EmptyStateProps) {
  const step = size ?? 'inline';
  const Title = heading ? 'h1' : 'p';

  return (
    <div
      data-slot="empty-state"
      className={cn(emptyStateVariants({ size, framed }), className)}
      {...props}
    >
      {icon ? <IconMedallion icon={icon} tint="muted" size={MEDALLION_SIZE[step]} /> : null}
      <Title className={TITLE_CLASS[step]}>{title}</Title>
      {description ? <p className={BODY_CLASS[step]}>{description}</p> : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export { emptyStateVariants };
