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
 * `ring` adds the 56px specimen's focus halo: `box-shadow:0 0 0 3px
 * rgba(93,95,239,0.15)`.
 */
function Avatar({
  className,
  size = 'default',
  ring = false,
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'hub';
  ring?: boolean;
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        'group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=hub]:size-14 data-[size=lg]:size-11 data-[size=sm]:size-7 data-[size=xs]:size-6 dark:after:mix-blend-lighten',
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
        'flex size-full items-center justify-center rounded-full bg-muted font-display text-sm font-bold text-foreground group-data-[size=hub]/avatar:text-h3 group-data-[size=lg]/avatar:text-body group-data-[size=sm]/avatar:text-xs group-data-[size=xs]/avatar:text-xs',
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
