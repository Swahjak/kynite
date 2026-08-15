import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * The section label the design sheets set above a stack — 12px, bold, tracked
 * out, quiet ink ("TITEL & ICOON", "VOOR WIE", "STAPPEN").
 *
 * It is a *label*, not a heading: the sheets use it to name a group of controls
 * inside a form, where an `<h3>` would claim a place in the document outline
 * that a field group has no business claiming. Where the same treatment names
 * an actual region, `SectionHeading` is the component with the heading levels.
 */
export function Overline({
  className,
  ...props
}: React.ComponentProps<'span'>): React.ReactElement {
  return (
    <span
      data-slot="overline"
      className={cn('label-overline block text-ink-muted', className)}
      {...props}
    />
  );
}
