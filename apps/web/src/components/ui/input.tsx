import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Text fields — `docs/design/components.md` § Inputs.
 *
 * The design system's text field is an **underline** field, not a boxed one:
 *
 * ```css
 * background:#f5f3ee;border:none;border-bottom:2px solid #c4c5d9;
 * border-radius:8px 8px 0 0;      // top corners only — underline style
 * padding:12px 14px;font-size:16px;color:#191c1d;outline:none;
 * ```
 *
 * Focused, the bottom border becomes `#5d5fef` (and the label goes with it —
 * see `FieldLabel`). The underline still carries the brand focus color, but
 * it is not the whole affordance on its own — `outline-none` drops the
 * browser's native focus outline, so a `focus-visible:ring` is kept as the
 * WCAG 1.4.11-compliant indicator (≥3:1 against the surrounding surface);
 * the underline colors it to match rather than doubling as a second, louder
 * signal.
 *
 * `variant="search"` is the doc's pill search field: `border-radius:9999px;
 * height:48px;padding:0 16px`, with the leading `search` icon supplied by the
 * caller. Height is forced to the doc's 48px regardless of `size` — see the
 * `compoundVariants` below.
 */
const inputVariants = cva(
  'w-full min-w-0 border-0 bg-surface-container text-ink transition-colors duration-200 ease-brand outline-none focus-visible:ring-3 focus-visible:ring-ring/50 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-muted disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
  {
    variants: {
      variant: {
        default:
          'rounded-t-md rounded-b-none border-b-2 border-line focus-visible:border-line-focus',
        search: 'rounded-4xl',
        /** Fully unstyled — for an input already inside a styled shell. */
        bare: 'bg-transparent',
      },
      size: {
        default: 'h-9 px-3 py-1 text-base md:text-sm',
        /** Kiosk/hub target: 48px minimum height, the doc's own field height. */
        hub: 'h-12 min-h-12 px-4 text-base',
      },
    },
    compoundVariants: [
      // The doc's search field is 48px regardless of context — `size="hub"`
      // already lands there, so only the `default` size needs forcing up.
      { variant: 'search', size: 'default', class: 'h-12 min-h-12' },
    ],
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

function Input({
  className,
  type,
  variant = 'default',
  size = 'default',
  ...props
}: Omit<React.ComponentProps<'input'>, 'size'> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-size={size}
      data-variant={variant}
      className={cn(inputVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants };
