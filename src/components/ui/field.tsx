'use client';

import { Field as FieldPrimitive } from '@base-ui/react/field';

import { cn } from '@/lib/utils';

function Field({ className, ...props }: FieldPrimitive.Root.Props) {
  return (
    <FieldPrimitive.Root
      data-slot="field"
      className={cn('flex w-full flex-col gap-1.5', className)}
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn('font-display text-sm font-medium text-foreground', className)}
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
      className={cn('font-display text-sm font-medium text-foreground', className)}
      {...props}
    />
  );
}

export { Field, FieldDescription, FieldError, FieldGroupLabel, FieldLabel };
