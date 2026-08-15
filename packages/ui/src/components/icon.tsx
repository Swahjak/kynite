import * as React from 'react';

import { cn } from '../lib/utils';
import { ICON_CODEPOINTS, type IconName } from './icon-codepoints';

/** Icon sizes from docs/design/README.md "Icon Sizes". */
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
  /**
   * Material Symbols icon name, e.g. `calendar_month`.
   *
   * Typed against the generated map, so a name the subset font does not carry
   * is a *type* error rather than a blank space at runtime. Adding an icon is
   * therefore: use it, run `pnpm icons:subset`, commit.
   */
  name: IconName;
  /** `FILL 1` variation — used for active/emphasised states. */
  filled?: boolean;
  size?: IconSize;
  /**
   * Where the icon sits relative to a label inside a primitive.
   *
   * Button, Badge and TabsTrigger already carry `has-data-[icon=inline-start]`
   * / `has-data-[icon=inline-end]` selectors that tighten the padding on the
   * icon's side, so a leading glyph does not float in a gap sized for text.
   * Those selectors match `data-icon`, which is why the *name* moved to
   * `data-icon-name` (M02 carry-forward): one attribute cannot be both a
   * layout signal and an identifier.
   */
  inline?: 'start' | 'end';
  /**
   * Accessible name. Omit for decorative icons: the icon is then hidden from
   * assistive tech, which also stops screen readers announcing the raw
   * ligature text ("calendar_month").
   */
  label?: string;
};

/**
 * Material Symbols Outlined icon, rendered from the self-hosted subset font
 * (src/lib/fonts.ts).
 *
 * Rendered by **codepoint**, not by the font's ligature feature. The ligature
 * form cannot survive subsetting — multi-part names substitute through
 * intermediate glyphs that no `cmap` reaches, so a subset keeps some icons and
 * silently blanks others (see `scripts/subset-icons.mjs`). A codepoint is a
 * direct `cmap` lookup with no layout table involved, which is what lets the
 * font ship at ~23 KB instead of 10 MB.
 *
 * The name still appears on `data-icon-name`, so tests and DevTools identify
 * an icon by name rather than by a private-use character.
 */
function Icon({
  name,
  filled = false,
  size = 'md',
  label,
  inline,
  className,
  style,
  ...props
}: IconProps) {
  const px = ICON_SIZES[size];

  return (
    <span
      data-slot="icon"
      data-icon-name={name}
      data-icon={inline ? `inline-${inline}` : undefined}
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
      {ICON_CODEPOINTS[name]}
    </span>
  );
}

export { Icon, ICON_SIZES };
