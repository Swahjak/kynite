'use client';

import type * as React from 'react';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

import { cn } from '../lib/utils';
import { MemberFace } from './member-face';

/**
 * A family member as a chip: their face, their name, and whether this one is
 * the one being looked at.
 *
 * The same object does three jobs across the design sheets, and they are the
 * same shape on purpose — a face in a pill always means "this person":
 *
 * - the store's header chips, which are *navigation* between one child's shelf
 *   and another's (never a scoreboard: the chip carries no totals, and there is
 *   nowhere it could put one);
 * - "voor wie" in the routine builder, where it is a multi-select;
 * - "aan wie" in the give-stars sheet, where it is a single choice.
 *
 * It renders a `<span>` by default and takes Base UI's `render` prop for the
 * cases where it has to be a link or a label — the package cannot import
 * `next/link`, so the app hands one in.
 */
export function MemberChip({
  name,
  avatarUrl,
  initials,
  surfaceClass,
  selected = false,
  size = 'md',
  className,
  render,
  ...props
}: useRender.ComponentProps<'span'> & {
  name: string;
  avatarUrl?: string | null;
  initials?: string;
  surfaceClass?: string;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const faceSize = ({ sm: 'xs', md: 'xs', lg: 'sm' } as const)[size];

  // Base UI types `mergeProps` against the intrinsic element's props, which do
  // not include arbitrary `data-*` keys in an object literal position.
  const dataAttributes = {
    'data-slot': 'member-chip',
    'data-selected': selected ? 'true' : 'false',
  } as React.ComponentProps<'span'>;

  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      dataAttributes,
      {
        className: cn(
          'inline-flex w-fit items-center gap-2 rounded-4xl py-1.5 pr-3.5 pl-1.5 font-display font-bold transition-colors duration-200 ease-brand',
          { sm: 'text-caption', md: 'text-body-sm', lg: 'gap-2.5 pr-4.5 text-h3' }[size],
          // Selected is a *ring plus a wash*, never a colour swap of the face:
          // the face is the person and it looks the same whoever is chosen.
          selected
            ? 'border-2 border-primary bg-accent text-ink'
            : 'border border-line-subtle bg-card text-ink-secondary hover:bg-surface-container',
          className
        ),
        children: (
          <>
            <MemberFace
              name={name}
              avatarUrl={avatarUrl}
              initials={initials}
              surfaceClass={surfaceClass}
              size={faceSize}
            />
            {name}
          </>
        ),
      },
      props
    ),
    render,
    state: { slot: 'member-chip', selected },
  });
}
