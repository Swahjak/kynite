import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Card variants — `docs/design/stitch/.../kynite/DESIGN.md`, "Elevation & Depth".
 *
 * - `default` — Level 1. A 1px border *and* a soft ambient shadow. Before M19
 *   this was `ring-1` with **no shadow at all** (docs/rebuild-design-gaps.md
 *   S5/§9), which is why the app read as flat next to the mockups: the mockups
 *   lean on elevation, not on outline, to separate a card from the background.
 *   A real `border` rather than a ring, so the card participates in the tonal
 *   layering (`--line` is M3 `outline-variant`) instead of tinting the
 *   foreground colour at 10%.
 * - `hero` — the filled-primary "NOW" / "CURRENT GOAL" card every mockup screen
 *   has exactly one of. Phase 2 adopts it on `/today`, the hub and the reward
 *   store; `savings-goal-card.tsx` already hand-rolls this treatment and is the
 *   reference for it. Radius steps up to `2xl` (24px) and the ambient glow the
 *   mockups paint behind the eyebrow comes with it.
 */
type CardVariant = 'default' | 'hero';

const CARD_VARIANTS: Record<CardVariant, string> = {
  default: 'rounded-xl border border-border bg-card text-card-foreground shadow-sm',
  hero: 'relative rounded-2xl bg-primary text-primary-foreground shadow-lg',
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
        'group/card flex flex-col gap-(--card-spacing) overflow-hidden py-(--card-spacing) text-sm transition-shadow duration-200 ease-brand [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl',
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
        'group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)',
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
        // The brand type scale, not a generic `text-base`/weight-500: the
        // mockups set card titles in Hanken Grotesk at 600–700
        // (docs/rebuild-design-gaps.md §9).
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
        'flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)',
        className
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
