'use client';

import * as React from 'react';
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';

import { cn } from '../lib/utils';
import { Icon } from './icon';

/**
 * Selection control — checkbox (`components.md` § Selection controls).
 *
 * Off: `24px, radius 6px, 2px solid #c4c5d9` (`--line`). On: same box,
 * `bg-success` (teal, `#006056`) fill, a white 16px `check` glyph that plays
 * the `kynite-anim-check` pop (`motion.md` § "Checkbox pop") the moment it
 * mounts.
 *
 * Built on Base UI's `Checkbox` (`@base-ui/react/checkbox`) rather than a
 * hand-rolled `<input>` + peer-class pair: the root already renders the
 * hidden native input a form needs (`name`/`value`/`defaultChecked`), tracks
 * `:focus-visible`, and exposes `data-checked`/`data-disabled` for styling —
 * three things `routine-dialog.tsx`'s old reward toggle re-implemented by
 * hand with a `peer` sibling. `data-slot="checkbox"` follows the other
 * primitives in this directory (`select.tsx`, `dialog.tsx`, …).
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-sm border-2 border-line bg-transparent outline-none transition-colors duration-200 ease-brand',
        'focus-visible:ring-3 focus-visible:ring-ring/50',
        'data-[checked]:border-transparent data-[checked]:bg-success',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-white"
      >
        <Icon name="check" size="xs" filled className="kynite-anim-check" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
