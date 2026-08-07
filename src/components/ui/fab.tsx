'use client';

import type { ComponentProps } from 'react';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/icon';
import type { IconName } from '@/components/ui/icon-codepoints';
import { FAB_SLOT_ID, SlotPortal } from '@/components/ui/slot-portal';
import { cn } from '@/lib/utils';

/**
 * The floating action button — `calendar_today_light_mode/code.html:201`.
 *
 * 64px, `rounded-2xl`, filled primary, bottom-right, with the glyph rotating
 * 90° on hover. The shell owns the *position* (`FabSlot`, rendered by
 * `(app)/layout.tsx` clear of the mobile bottom bar and the safe-area inset);
 * a page owns the *action* and renders `<Fab>` anywhere in its own tree.
 *
 * Exactly one `<Fab>` should be mounted at a time. Two pages cannot both be
 * mounted in the App Router, so that falls out of the routing rather than
 * needing to be enforced here.
 */
export type FabProps = {
  icon: IconName;
  /** Accessible name. Required — a FAB with no label is an unlabelled button. */
  label: string;
  className?: string;
} & (
  | ({ href: string } & Omit<ComponentProps<typeof Link>, 'href' | 'className'>)
  | ({ href?: undefined } & Omit<ComponentProps<'button'>, 'className'>)
);

const fabClass =
  'group/fab flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg transition-all duration-200 ease-brand hover:bg-brand-hover active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const fabIconClass = 'transition-transform duration-200 ease-brand group-hover/fab:rotate-90';

export function Fab({ icon, label, className, ...props }: FabProps) {
  const content = <Icon name={icon} size="xl" className={fabIconClass} />;

  return (
    <SlotPortal id={FAB_SLOT_ID}>
      {props.href !== undefined ? (
        <Link {...props} href={props.href} aria-label={label} className={cn(fabClass, className)}>
          {content}
        </Link>
      ) : (
        <button
          type="button"
          {...props}
          aria-label={label}
          className={cn(fabClass, className)}
          data-slot="fab"
        >
          {content}
        </button>
      )}
    </SlotPortal>
  );
}

/**
 * The shell-side half: an empty, fixed container in the corner the mockups put
 * the FAB in. `pointer-events-none` so an empty slot never eats a click on the
 * content beneath it; the FAB itself takes them back.
 */
export function FabSlot() {
  return (
    <div
      id={FAB_SLOT_ID}
      className="pb-safe pointer-events-none fixed right-4 bottom-20 z-40 flex justify-end sm:right-8 sm:bottom-8 [&>*]:pointer-events-auto"
    />
  );
}
