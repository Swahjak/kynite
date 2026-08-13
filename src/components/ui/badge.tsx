import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Chips & badges — `docs/design/components.md` § "Chips & badges".
 *
 * Everything here is a pill (`border-radius:9999px`) set in Baloo 2. The doc
 * distinguishes four shapes and this `cva` carries all of them:
 *
 * - `Badge/Count`  — `rgba(186,26,26,0.1)` on `#ba1a1a`, 10px/0.05em → `count`
 * - `Badge/Status` — solid `#5d5fef` on white, 10px/0.05em      → `status`
 * - `Chip/Star count` — `rgba(239,141,93,0.16)` on `#ef8d5d`     → `gold`
 *   (deliberate AA deviation: `#ef8d5d` is only 2.43:1 on white and cannot be
 *   text, so `gold` renders in `text-gold-ink` (`#9a4f14`, 6.00:1) instead of
 *   the doc's literal `#ef8d5d` — see `globals.css`'s `--gold-ink` note)
 * - `Chip/Removable` — `#e7e8e9` on `#434656`, 13px             → `muted`
 *
 * `Chip/Category` is the eight-hue `oklch()` set in `colors.md`; it stays with
 * the calendar's category tokens rather than becoming a variant here.
 */
const badgeVariants = cva(
  'group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 font-display text-xs font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
        secondary: 'bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80',
        destructive:
          'bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/15 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20',
        outline: 'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
        ghost: 'hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
        link: 'text-brand-ink underline-offset-4 hover:underline',
        now: 'bg-now text-now-foreground',
        today: 'bg-primary text-primary-foreground',
        gold: 'bg-gold/16 font-body font-bold text-gold-ink',
        /** `Chip/Removable` — the quiet meta pill (duration, member, "+2 more"). */
        muted: 'bg-surface-container-high text-ink-secondary',
        /** `Chip` on a card's own tinted surface, one step lighter than `muted`. */
        soft: 'bg-surface-container text-ink-secondary',
        /** `Badge/Status` — `background:#5d5fef;color:#ffffff`, 10px caps. */
        status: 'bg-primary text-[10px] font-bold tracking-[0.05em] text-primary-foreground',
        /** `Badge/Count` — `rgba(186,26,26,0.1)` on `#ba1a1a`, 10px caps. */
        count: 'bg-destructive/10 text-[10px] font-bold tracking-[0.05em] text-destructive',
      },
      size: {
        default: 'h-5',
        /** `Chip/Removable` / `Chip/Category`: `padding:8px 16px`, 13px. */
        md: 'h-8 px-4 text-caption',
        /** `Chip/Star count`: `padding:7px 14px`, 14px. */
        lg: 'h-9 gap-1.5 px-3.5 text-body-sm',
        hub: 'h-12 px-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Badge({
  className,
  variant = 'default',
  size = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: 'badge',
      variant,
      size,
    },
  });
}

export { Badge, badgeVariants };
