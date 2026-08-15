import * as React from 'react';

import { cn } from '../lib/utils';
import { Badge } from './badge';
import { Icon, type IconSize } from './icon';
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
 * plus a leading filled star at `font-size:18px`. **The star leads and the
 * number follows** — "★ 12" — everywhere the design sheets draw this object:
 * the hub header, the due card, the store tile, the parent's routine row. The
 * glyph is what makes the number a *star* count at a glance, so it comes first
 * the way a currency symbol does.
 *
 * Two tones, and the difference is whether the count is an object or an
 * annotation:
 *
 * - `chip` (default) — the peach pill. A star count that stands on its own:
 *   the balance in a header, the price on a queue card.
 * - `bare` — the same star and number in orange with no pill at all
 *   (`Routines.dc.html` r216-225, `Beloningen.dc.html` r271-282). What a
 *   *row* carries, where a filled pill beside a title, a schedule line and a
 *   switch is one competing surface too many.
 *
 * The visible number is `aria-hidden` and paired with a real, translated
 * sentence in `srLabel` — "12" next to a star glyph is not a sentence, and the
 * unit has to survive into the accessibility tree.
 */
export function StarCount({
  value,
  srLabel,
  size = 'md',
  tone = 'chip',
  className,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & {
  value: number;
  /** Full translated phrase, e.g. `t('stars', { count: value })`. */
  srLabel: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'chip' | 'bare';
}) {
  const badgeSize = ({ sm: 'default', md: 'md', lg: 'lg' } as const)[size];
  const iconSize = ({ sm: 'xs', md: 'sm', lg: 'md' } as const)[size];

  const body = (
    <>
      <Icon name="star" filled size={iconSize} />
      <span aria-hidden>{value}</span>
      <span className="sr-only">{srLabel}</span>
    </>
  );

  if (tone === 'bare') {
    return (
      <span
        data-slot="star-count"
        className={cn(
          'tnum inline-flex shrink-0 items-center gap-1 font-display font-bold text-gold-ink',
          { sm: 'text-body-sm', md: 'text-body', lg: 'text-h3' }[size],
          className
        )}
        {...props}
      >
        {body}
      </span>
    );
  }

  return (
    <Badge
      variant="gold"
      size={badgeSize}
      className={cn('tnum gap-1.5', className)}
      render={<span {...props}>{body}</span>}
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
