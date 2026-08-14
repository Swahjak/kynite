'use client';

import * as React from 'react';
import { Popover } from '@base-ui/react/popover';

import { cn } from '@/lib/utils';
import { Icon } from './icon';
import type { IconName } from './icon-codepoints';

/**
 * The trailing icon button + popover shared by `DateField` and `TimeField`.
 *
 * It is strictly an *addition*: the field is still a text input that a parent
 * types into, submitting the same hidden wire value it always did. Nothing
 * here is on the path between typing and submitting, so a field whose popover
 * never opens behaves exactly as it did before.
 *
 * Two details that are easy to get wrong and are the reason this is one
 * component rather than two copies:
 *
 * - **Tab order.** The button sits *after* the input in the DOM, so tabbing
 *   still lands on the input first and the picker is the next stop rather
 *   than a detour before the thing most parents want.
 * - **Focus on close.** `finalFocus` points back at the input, not at the
 *   trigger (Base UI's default), so picking a date leaves the caret where the
 *   parent would keep typing.
 *
 * The button is 36×36 (48×48 at `size="hub"`) to sit inside the field, with a
 * `::after` bleed taking the *touch* target past 44px on the small sizes
 * without pushing the field's own height around.
 */
export type FieldPickerProps = {
  icon: IconName;
  /** Accessible name — "Kies een datum" / "Pick a date". */
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  size?: 'default' | 'hub';
  /** Where focus goes when the popover closes — the field's own input. */
  finalFocus?: React.RefObject<HTMLElement | null>;
  /** What to focus when it opens, e.g. the currently selected time. */
  initialFocus?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
};

export function FieldPicker({
  icon,
  label,
  open,
  onOpenChange,
  disabled,
  size = 'default',
  finalFocus,
  initialFocus,
  children,
}: FieldPickerProps) {
  return (
    <Popover.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Popover.Trigger
        disabled={disabled}
        aria-label={label}
        data-slot="field-picker-trigger"
        data-size={size}
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-center rounded-md text-ink-secondary transition-colors duration-200 ease-brand after:absolute after:-inset-1 after:content-[''] hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-popup-open:text-brand",
          size === 'hub' ? 'w-12' : 'w-9'
        )}
      >
        <Icon name={icon} size={size === 'hub' ? 'md' : 'sm'} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="isolate z-50">
          {/* Same surface tokens as `SelectContent` — one popup look. */}
          <Popover.Popup
            data-slot="field-picker-popup"
            finalFocus={finalFocus}
            initialFocus={initialFocus}
            className="origin-(--transform-origin) rounded-2xl bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
