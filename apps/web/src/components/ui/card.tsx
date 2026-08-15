import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Card variants — `docs/design/components.md` § Cards.
 *
 * "All cards: `border-radius:24px` … `box-shadow:0 1px 2px rgba(0,0,0,0.04)` as
 * the default resting elevation." Elevation, not outline, is what separates a
 * card from the cream background, so `default` carries no border.
 *
 * - `default` — `Card/Stat`: `background:#ffffff;border-radius:24px;
 *   box-shadow:0 1px 2px rgba(0,0,0,0.04)`.
 * - `muted` — `Card/Attention`: the same card on `#f5f3ee`, for the secondary
 *   tile in a pair (approval requests, "needs your attention").
 * - `hero` — the filled-primary "NOW" / "CURRENT GOAL" card every screen has
 *   exactly one of.
 * - `inverse` — `Card/Toast`: `background:#2e3132;box-shadow:0 8px 24px
 *   rgba(0,0,0,0.18)`, the dark card the celebration and toast specimens use.
 * - `outlined` — a card that has to read as a *boundary* rather than as a
 *   surface (pickers, list frames on an already-white ground). Not a design
 *   system variant; kept because dropping the border from `default` would
 *   otherwise erase those frames.
 */
type CardVariant = 'default' | 'muted' | 'hero' | 'inverse' | 'outlined';

const CARD_VARIANTS: Record<CardVariant, string> = {
  default: 'rounded-2xl bg-card text-card-foreground shadow-sm',
  muted: 'rounded-2xl bg-surface-container text-card-foreground shadow-sm',
  hero: 'relative rounded-2xl bg-primary text-primary-foreground shadow-lg',
  inverse: 'rounded-2xl bg-ink text-background shadow-lg dark:bg-surface dark:text-ink',
  outlined: 'rounded-2xl border border-border bg-card text-card-foreground shadow-sm',
};

function Card({
  className,
  size = 'default',
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & {
  size?: 'default' | 'sm';
  variant?: CardVariant;
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-variant={variant}
      className={cn(
        'group/card flex flex-col gap-(--card-spacing) overflow-hidden py-(--card-spacing) text-sm transition-shadow duration-200 ease-brand [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-2xl *:[img:last-child]:rounded-b-2xl',
        CARD_VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-2xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)',
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        // `typography.md`: card headings are Baloo 2 at 16–18px/700 and
        // `headline-md` is Baloo 2 20px/600 — never a generic weight-500 body.
        'font-heading text-h3 leading-snug font-semibold group-data-[size=sm]/card:text-body',
        className
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-body-sm text-ink-secondary', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-content" className={cn('px-(--card-spacing)', className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center rounded-b-2xl border-t bg-muted/50 p-(--card-spacing)',
        className
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
