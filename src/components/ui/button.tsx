import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Buttons — `docs/design/components.md` § Buttons.
 *
 * "All buttons: `font-family:'Baloo 2',sans-serif;font-weight:700;` pill-shaped
 * (`border-radius:9999px`) … Standard height `48px`, padding `0 24px`." That
 * 48px is the `hub` size here and the floor `motion.md` sets for any tap
 * target; the smaller steps are the dense in-card sizes the docs also show
 * ("Card-context buttons at a smaller size also appear … `height:34px`").
 *
 * `active:scale-95` is the house press effect and lives on the base class, so
 * every button — and every component that reuses `buttonVariants` — presses.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-4xl border border-transparent bg-clip-padding font-display font-bold whitespace-nowrap transition-all duration-200 ease-brand outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** `Button/Primary` — `box-shadow:0 2px 8px rgba(93,95,239,0.28)`. */
        default: 'bg-primary text-primary-foreground shadow-brand hover:bg-brand-hover',
        gold: 'bg-gold text-gold-foreground hover:bg-gold-hover',
        /** `Button/Secondary` — `border:2px solid #5d5fef`, transparent fill. */
        'brand-outline':
          'border-2 border-primary bg-transparent text-brand-ink hover:bg-accent aria-expanded:bg-accent',
        /** `Button/Icon` — `border:1px solid #c4c5d9;background:#ffffff`. */
        outline:
          'border-border bg-card text-ink-secondary hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        /** `Button/Ghost` — `background:transparent;color:#434656`. */
        ghost:
          'text-ink-secondary hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        /** `Button/Destructive` — `background:#ba1a1a;color:#ffffff`, solid. */
        destructive:
          // Dark mode's `--destructive` is the lightened `#ffb4ab` salmon, so
          // `dark:text-ink` (the dark theme's near-white text token, ~1.5:1 on
          // that fill) was wrong on both counts — wrong theme's ink *and* the
          // wrong lightness direction. `--background` in dark mode is `#191c1d`
          // (this app never flips to a light dark-mode background), so
          // `dark:text-background` gives fixed dark ink on the salmon — 10.1:1.
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:text-background dark:focus-visible:ring-destructive/40',
        /** A tinted destructive, for a delete that sits inside a quiet card. */
        'destructive-soft':
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/15 dark:hover:bg-destructive/25 dark:focus-visible:ring-destructive/40',
        // The accessible on-light brand token. It resolves to the primary
        // indigo itself (4.83:1 on white, 4.59:1 on the cream background); it
        // stayed a separate token because it is the one that is *guaranteed*
        // legible as text, and the brand fill is not obliged to be.
        link: 'font-semibold text-brand-ink underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-8 gap-1.5 px-3 text-sm has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-3 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 gap-1.5 px-4 text-sm has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        /**
         * The design system's standard button: `height:48px;padding:0 24px`,
         * and the 48px kiosk/tap-target floor in both axes.
         */
        hub: "h-12 min-h-12 min-w-12 gap-2 px-6 text-body-sm [&_svg:not([class*='size-'])]:size-6",
        /** `motion.md`: "64px on tablet vs. 48px minimum" for primary actions. */
        tablet: "h-16 min-h-16 min-w-16 gap-2 px-8 text-body [&_svg:not([class*='size-'])]:size-8",
        icon: 'size-8',
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-7',
        'icon-lg': 'size-9',
        'icon-hub': "size-12 [&_svg:not([class*='size-'])]:size-6",
        'icon-tablet': "size-16 [&_svg:not([class*='size-'])]:size-8",
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
