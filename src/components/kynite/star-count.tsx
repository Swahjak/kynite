import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Icon, type IconSize } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { IconMedallion } from './icon-medallion';

/**
 * `Chip/Star count` — `docs/design/components.md` § "Chips & badges":
 *
 * ```css
 * display:inline-flex;align-items:center;gap:6px;
 * background:rgba(239,141,93,0.16);color:#ef8d5d;
 * font-family:'Poppins';font-weight:700;font-size:14px;
 * padding:7px 14px;border-radius:9999px;
 * ```
 *
 * plus a leading filled star at `font-size:18px`. The star sits *after* the
 * number in the product's own reading order ("12 ★"), matching how the count
 * is spoken.
 *
 * The visible number is `aria-hidden` and paired with a real, translated
 * sentence in `srLabel` — "12" next to a star glyph is not a sentence, and the
 * unit has to survive into the accessibility tree.
 */
export function StarCount({
  value,
  srLabel,
  size = 'md',
  className,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & {
  value: number;
  /** Full translated phrase, e.g. `t('stars', { count: value })`. */
  srLabel: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const badgeSize = ({ sm: 'default', md: 'md', lg: 'lg' } as const)[size];
  const iconSize = ({ sm: 'xs', md: 'sm', lg: 'md' } as const)[size];

  return (
    <Badge
      variant="gold"
      size={badgeSize}
      className={cn('tnum gap-1.5', className)}
      render={
        <span {...props}>
          <span aria-hidden>{value}</span>
          <Icon name="star" filled size={iconSize} />
          <span className="sr-only">{srLabel}</span>
        </span>
      }
    />
  );
}

/**
 * The star *medallion* — the same currency shown as a tile rather than a chip:
 * the rewards balance headline, the star tile on a child launcher, the icon
 * beside a page title. Five hand-rolled copies of this existed at four sizes.
 */
export function StarMedallion({
  size = 'lg',
  shape = 'circle',
  label,
  animate = false,
  className,
  ...props
}: Omit<React.ComponentProps<typeof IconMedallion>, 'icon' | 'tint' | 'filled'> & {
  /** Adds the `kynite-anim-pop` idle celebrate from `motion.md`. */
  animate?: boolean;
  iconSize?: IconSize;
}) {
  return (
    <IconMedallion
      icon="star"
      filled
      tint="gold"
      shape={shape}
      size={size}
      label={label}
      className={cn(animate && 'kynite-anim-pop', className)}
      {...props}
    />
  );
}
