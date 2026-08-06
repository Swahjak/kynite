import * as React from 'react';

import { cn } from '@/lib/utils';

/** Icon sizes from docs/brand-guideline.md "Icon Sizes". */
const ICON_SIZES = {
  xs: 14,
  sm: 18,
  md: 24,
  lg: 28,
  xl: 32,
  '2xl': 40,
} as const;

export type IconSize = keyof typeof ICON_SIZES;

export type IconProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  /** Material Symbols ligature name, e.g. `calendar_month`. */
  name: string;
  /** `FILL 1` variation — used for active/emphasised states. */
  filled?: boolean;
  size?: IconSize;
  /**
   * Accessible name. Omit for decorative icons: the icon is then hidden from
   * assistive tech, which also stops screen readers announcing the raw
   * ligature text ("calendar_month").
   */
  label?: string;
};

/**
 * Material Symbols Outlined icon, rendered from the self-hosted variable font
 * (src/lib/fonts.ts). Ligature-based: the element's text content is the icon
 * name, which the font maps to a glyph.
 */
function Icon({ name, filled = false, size = 'md', label, className, style, ...props }: IconProps) {
  const px = ICON_SIZES[size];

  return (
    <span
      data-slot="icon"
      data-icon={name}
      className={cn(
        'material-symbols-outlined shrink-0 select-none',
        filled && 'icon-filled',
        className
      )}
      style={{ fontSize: px, width: px, height: px, ...style }}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      translate="no"
      {...props}
    >
      {name}
    </span>
  );
}

export { Icon, ICON_SIZES };
