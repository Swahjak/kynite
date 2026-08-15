import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The progress track — `docs/design/components.md` § `Card/Stat`:
 *
 * ```css
 * width:100%;height:8px;border-radius:9999px;background:#e1e3e4;overflow:hidden;
 * ```
 *
 * with the fill at the percentage width, also `border-radius:9999px`. The
 * streak specimen in `motion.md` uses the same object at `10px` with a shimmer
 * overlay — hence `shimmer`.
 *
 * Six hand-rolled copies of this existed, disagreeing about the track colour,
 * the corner radius and, more importantly, about accessibility: only one
 * exposed `role="progressbar"`. Here that is a prop with a deliberate default
 * — a bar that repeats a number the adjacent text already gives is decorative,
 * so pass `label` when it is the *only* place the number appears.
 */
export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  tone = 'brand',
  fillClassName,
  shimmer = false,
  label,
  orientation = 'horizontal',
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  value: number;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  tone?: 'brand' | 'gold' | 'success' | 'inverse';
  /**
   * Overrides the tone's fill colour with an arbitrary class.
   *
   * For the one case a token cannot express: a bar drawn in a *member's* own
   * hue (`MEMBER_COLOR_CLASSES[color].dot`), where the colour identifies a
   * person rather than a meaning. Tones stay the default so nothing else is
   * tempted to hand-pick a fill.
   */
  fillClassName?: string;
  /** The `kynite-shimmer-sweep` overlay from `motion.md`. */
  shimmer?: boolean;
  /**
   * Accessible name. Provided ⇒ the bar becomes a `progressbar` with
   * `aria-valuenow`; omitted ⇒ it is `aria-hidden` decoration.
   */
  label?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  const safeMax = max <= 0 ? 1 : max;
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100));
  const vertical = orientation === 'vertical';

  const trackSize = {
    xs: vertical ? 'w-1' : 'h-1',
    sm: vertical ? 'w-1.5' : 'h-1.5',
    md: vertical ? 'w-2' : 'h-2',
    lg: vertical ? 'w-2.5' : 'h-2.5',
  }[size];

  const fillTone = {
    brand: 'bg-primary',
    gold: 'bg-gold',
    success: 'bg-success',
    /** On a filled card, where the track is the card's own tinted ground. */
    inverse: 'bg-card',
  }[tone];

  return (
    <div
      data-slot="progress-bar"
      className={cn(
        'overflow-hidden rounded-4xl bg-surface-container-highest',
        vertical ? 'flex h-full items-end' : 'w-full',
        trackSize,
        className
      )}
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(percent) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      <span
        className={cn(
          'relative block overflow-hidden rounded-4xl ease-brand',
          fillClassName ?? fillTone,
          vertical
            ? 'w-full transition-[height] duration-500'
            : 'h-full transition-[width] duration-500'
        )}
        style={vertical ? { height: `${percent}%` } : { width: `${percent}%` }}
      >
        {shimmer ? (
          <span className="kynite-shimmer-sweep absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        ) : null}
      </span>
    </div>
  );
}
