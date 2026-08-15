'use client';

import { Field as FieldPrimitive } from '@base-ui/react/field';

import { cn } from '../lib/utils';

function Field({ className, ...props }: FieldPrimitive.Root.Props) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn('group/field flex w-full flex-col gap-1.5', className)}
      {...props}
    />
  );
}

/**
 * `docs/design/components.md` § Inputs — the label above a text field:
 * `font-family:'Baloo 2';font-weight:700;font-size:12px;letter-spacing:0.05em;
 * text-transform:uppercase;color:#434656;` — and, on focus, `color:#5d5fef`.
 *
 * The focus colour rides on Base UI's `data-focused` state on `Field.Root`, so
 * the label follows the input's 2px underline without a client hook.
 */
function FieldLabel({ className, ...props }: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn(
        'label-overline text-ink-secondary transition-colors duration-200 ease-brand group-data-[focused]/field:text-brand-ink',
        className
      )}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: FieldPrimitive.Description.Props) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn('text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

function FieldError({ className, ...props }: FieldPrimitive.Error.Props) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      className={cn('text-xs text-destructive', className)}
      {...props}
    />
  );
}

/** Non-`Field.Root` legend for grouped controls (color/avatar pickers). */
function FieldGroupLabel({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="field-group-label"
      className={cn('label-overline text-ink-secondary', className)}
      {...props}
    />
  );
}

export { Field, FieldDescription, FieldError, FieldGroupLabel, FieldLabel };
