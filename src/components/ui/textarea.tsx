import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Multi-line text, styled as the exact sibling of `input.tsx` (M18).
 *
 * Base UI has no textarea primitive — there is no behaviour to wrap, only a
 * native element — so this is the raw element plus the same `cva` variants the
 * `Input` carries, including the `hub` size. Sharing the variant *shape* rather
 * than importing `inputVariants` is deliberate: the two differ in exactly one
 * respect (a textarea has a minimum height and no fixed one), and a shared
 * `cva` with a height override at every call site would be the worse copy.
 */
const textareaVariants = cva(
  'w-full min-w-0 rounded-t-md rounded-b-none border-0 border-b-2 border-line bg-surface-container text-ink transition-colors duration-200 ease-brand outline-none placeholder:text-ink-muted focus-visible:border-line-focus focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
  {
    variants: {
      size: {
        default: 'min-h-16 px-3 py-2 text-base md:text-sm',
        /** Kiosk/hub target: roomy enough to type on a tablet. */
        hub: 'min-h-24 px-4 py-3 text-base',
      },
    },
    defaultVariants: { size: 'default' },
  }
);

function Textarea({
  className,
  size = 'default',
  ...props
}: Omit<React.ComponentProps<'textarea'>, 'size'> & VariantProps<typeof textareaVariants>) {
  return (
    <textarea
      data-slot="textarea"
      data-size={size}
      className={cn(textareaVariants({ size }), className)}
      {...props}
    />
  );
}

export { Textarea, textareaVariants };
