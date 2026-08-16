'use client';

import * as React from 'react';
import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar';

import { cn } from '../lib/utils';

/**
 * `docs/design/components.md` § Avatars — "Three sizes shown together: `32px`,
 * `44px`, and `56px`", all `border-radius:9999px`, `object-fit:cover`,
 * `flex-shrink:0`. Those are `default` / `lg` / `hub` here; `xs` (24px) and
 * `sm` (28px) are the in-list sizes the calendar and event rows use
 * ("Small avatar-in-list usage (event list item): `28px`").
 *
 * `2xs` (16px) is one step below all of those and exists for exactly one
 * surface: a **time-grid block**. `docs/design/claude-design/Kalender.dc.html`
 * draws every day/week block's face at `width:16px;height:16px` (:108, :181),
 * because a block is as tall as its event is long — a half-hour appointment is
 * 29px — and the 24px of `xs` does not fit inside one with its padding. It is
 * deliberately too small to carry initials legibly at a distance, which is why
 * nothing but a grid block should reach for it.
 *
 * `ring` adds the 56px specimen's focus halo: `box-shadow:0 0 0 3px
 * rgba(93,95,239,0.15)`.
 *
 * **The ramp has six steps; the design sheet documents five.** "Kynite Design
 * System" § Avatars now names `16 · 24 · 32 · 44 · 56` and jumps straight from
 * 24 to 32. `sm` (28px) stays anyway: it is the size the docs' own "Small
 * avatar-in-list usage (event list item): `28px`" gives, and it is what the
 * calendar and event rows render. The sheet's ramp is a swatch strip rather
 * than a closed set, and collapsing 28 into 24 or 32 would move rows the
 * design never asked to move. Recorded here so the gap reads as known rather
 * than as drift.
 */
function Avatar({
  className,
  size = 'default',
  ring = false,
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: 'default' | '2xs' | 'xs' | 'sm' | 'lg' | 'hub';
  ring?: boolean;
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        'group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=hub]:size-14 data-[size=lg]:size-11 data-[size=sm]:size-7 data-[size=xs]:size-6 data-[size=2xs]:size-4 dark:after:mix-blend-lighten',
        ring && 'shadow-[0_0_0_3px_rgb(93_95_239_/_0.15)]',
        className
      )}
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full rounded-full object-cover', className)}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-muted font-display text-sm font-bold text-foreground group-data-[size=hub]/avatar:text-h3 group-data-[size=lg]/avatar:text-body group-data-[size=sm]/avatar:text-xs group-data-[size=xs]/avatar:text-xs group-data-[size=2xs]/avatar:text-[0.5rem] group-data-[size=2xs]/avatar:leading-none',
        className
      )}
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        'absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none',
        'group-data-[size=xs]/avatar:size-2 group-data-[size=xs]/avatar:[&>svg]:hidden',
        'group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden',
        'group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2',
        'group-data-[size=hub]/avatar:size-4 group-data-[size=hub]/avatar:[&>svg]:size-3',
        'group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2',
        className
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        'group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background',
        className
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        'relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-display text-sm font-bold text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-11 group-has-data-[size=sm]/avatar-group:size-7 group-has-data-[size=xs]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3',
        className
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge };
