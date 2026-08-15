import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * The drag affordance on a reorderable row.
 *
 * Six dots in CSS rather than Material's `drag_indicator`, because the icon
 * font is a hard-capped 64 KB subset (`apps/web/scripts/subset-icons.mjs`,
 * 61.4 KB across 73 glyphs) and a grip is a shape, not a symbol — drawing it
 * costs nothing and adding a glyph costs a kilobyte of a kiosk's boot path.
 *
 * `aria-hidden` by default: the handle is a visual affordance on a row that
 * carries its own accessible reordering controls. A drag handle that announces
 * itself to a screen reader without being operable by one is noise.
 */
export function GripHandle({
  className,
  ...props
}: React.ComponentProps<'span'>): React.ReactElement {
  return (
    <span
      aria-hidden
      data-slot="grip-handle"
      className={cn('grid shrink-0 grid-cols-2 gap-x-1 gap-y-0.5 text-line', className)}
      {...props}
    >
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} className="size-1 rounded-full bg-current" />
      ))}
    </span>
  );
}
