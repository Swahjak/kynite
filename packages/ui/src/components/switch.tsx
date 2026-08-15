'use client';

import * as React from 'react';
import { Switch as SwitchPrimitive } from '@base-ui/react/switch';

import { cn } from '../lib/utils';

/**
 * Selection control — switch.
 *
 * The one control in the system that means "on, from now on" rather than
 * "done, just now". A routine in the parent's beheer list is either running or
 * paused (`Routines.dc.html`, the beheer column): that is a *setting*, and a
 * checkbox — which in this system pops, celebrates and pays out a star — would
 * read as an achievement instead of a preference.
 *
 * Built on Base UI's `Switch` for the same reasons as `Checkbox`: it renders
 * the hidden native input a form needs, tracks `:focus-visible`, and exposes
 * `data-checked`/`data-disabled` to style against. The geometry follows the
 * design's `38 × 22` track with a 16px thumb, kept at a 48px tap target by the
 * row it sits in rather than by padding on the control itself.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full border-0 bg-line-subtle p-[3px] outline-none transition-colors duration-200 ease-brand',
        'focus-visible:ring-3 focus-visible:ring-ring/50',
        'data-[checked]:bg-primary',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="size-4 rounded-full bg-surface-container-lowest shadow-sm transition-transform duration-200 ease-brand data-[checked]:translate-x-4"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
