import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * `Chip/Category` and its dot — `docs/design/colors.md` § "Category palette".
 *
 * ```css
 * display:inline-flex;align-items:center;gap:8px;
 * padding:8px 16px;border-radius:9999px;
 * background: oklch(94% 0.025 H);
 * border: 1px solid oklch(85% 0.05 H);
 * color: oklch(32% 0.08 H);
 * font-family:'Baloo 2';font-weight:600;font-size:13px;
 * ```
 *
 * The hue lives in the `--cat-*` tokens, so a chip takes the *class triplet*
 * for its category rather than a colour: pass the classes from
 * `modules/calendar/ui/tokens.ts` (events) or `MEMBER_COLOR_CLASSES` (people).
 *
 * `CategoryDot` is the same palette in its other documented form: "Small
 * dot-only usage (calendar strip/month grid event markers):
 * `width/height: 4-8px; border-radius: 9999px;`".
 */
export function CategoryChip({
  surfaceClass,
  borderClass,
  dot = false,
  dotClass,
  className,
  children,
  ...props
}: React.ComponentProps<'span'> & {
  /** `bg-cat-<hue>-surface text-cat-<hue>-fg`. */
  surfaceClass?: string;
  /** `border-cat-<hue>-border`. */
  borderClass?: string;
  /** Renders the solid hue as a leading dot inside the chip. */
  dot?: boolean;
  /** `bg-cat-<hue>-solid`. */
  dotClass?: string;
}) {
  return (
    <span
      data-slot="category-chip"
      className={cn(
        'inline-flex w-fit items-center gap-2 rounded-4xl border px-4 py-2 font-display text-caption font-semibold',
        surfaceClass,
        borderClass,
        className
      )}
      {...props}
    >
      {dot ? <span className={cn('size-2 shrink-0 rounded-full', dotClass)} /> : null}
      {children}
    </span>
  );
}

export function CategoryDot({
  size = 'md',
  className,
  ...props
}: React.ComponentProps<'span'> & { size?: 'xs' | 'sm' | 'md' }) {
  return (
    <span
      data-slot="category-dot"
      aria-hidden
      className={cn(
        'inline-block shrink-0 rounded-full',
        { xs: 'size-1', sm: 'size-1.5', md: 'size-2' }[size],
        className
      )}
      {...props}
    />
  );
}
