import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils';
import { Icon, type IconSize } from './icon';
import { type IconName } from './icon-codepoints';

/**
 * A tinted tile with one icon in it — the single most repeated shape in the
 * product: the leading glyph on a list row, the tile beside a section heading,
 * the star medallion on the rewards board, the icon in an empty state.
 *
 * The design system does not name it as a component, but it composes it
 * everywhere: `Card/Toast`'s "leading icon badge: `width:32px;height:32px;
 * border-radius:9999px;background:rgba(93,95,239,0.25)`" and the checkbox-pop
 * specimen's "`48px` rounded-square badge (`border-radius:12px`)" are the same
 * object at two sizes and two corner treatments — hence `shape`.
 *
 * `tint` accepts an arbitrary class string too (for the 8 category hues, pass
 * `MEMBER_COLOR_CLASSES[color].surface` through `className`).
 */
const medallionVariants = cva('inline-flex shrink-0 items-center justify-center', {
  variants: {
    tint: {
      brand: 'bg-accent text-brand-ink',
      /** The filled brand tile, for a tile that has to carry weight. */
      'brand-solid': 'bg-primary text-primary-foreground',
      'brand-container': 'bg-brand-container text-brand-container-ink',
      gold: 'bg-gold/20 text-gold-ink',
      muted: 'bg-surface-container text-ink-secondary',
      success: 'bg-success/15 text-success',
      destructive: 'bg-destructive/10 text-destructive',
      none: '',
    },
    shape: {
      circle: 'rounded-full',
      /** The doc's rounded-square badge. */
      squircle: 'rounded-2xl',
    },
    size: {
      sm: 'size-8',
      md: 'size-10',
      lg: 'size-12',
      xl: 'size-14',
      '2xl': 'size-16',
      '3xl': 'size-24',
    },
  },
  defaultVariants: { tint: 'brand', shape: 'circle', size: 'lg' },
});

type MedallionSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

/** The icon size that visually fills each medallion step. */
const ICON_FOR_SIZE: Record<MedallionSize, IconSize> = {
  sm: 'sm',
  md: 'md',
  lg: 'md',
  xl: 'lg',
  '2xl': 'xl',
  '3xl': '2xl',
};

export type IconMedallionProps = Omit<React.ComponentProps<'span'>, 'children'> &
  Omit<VariantProps<typeof medallionVariants>, 'size'> & {
    size?: MedallionSize;
    icon: IconName;
    filled?: boolean;
    /** Overrides the size the medallion would pick for its own diameter. */
    iconSize?: IconSize;
    /** Accessible name. Omit when the adjacent text already says it. */
    label?: string;
  };

export function IconMedallion({
  icon,
  filled = false,
  iconSize,
  label,
  tint,
  shape,
  size = 'lg',
  className,
  ...props
}: IconMedallionProps) {
  return (
    <span
      data-slot="icon-medallion"
      className={cn(medallionVariants({ tint, shape, size }), className)}
      {...props}
    >
      <Icon name={icon} filled={filled} size={iconSize ?? ICON_FOR_SIZE[size]} label={label} />
    </span>
  );
}

export { medallionVariants };
