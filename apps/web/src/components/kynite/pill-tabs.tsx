'use client';

import * as React from 'react';

import { cn, Icon, type IconName, Tabs, TabsContent, TabsList, TabsTrigger } from '@kynite/ui';

/**
 * A row of standalone pills that switch between panels.
 *
 * The design system already has one tab control — the segmented pill
 * (`ui/tabs.tsx` at `variant="default"`), a *track* with an inner marker, used
 * where a switch sits inside another component's chrome (the calendar header,
 * a section heading). This is the other shape the mockups use: separate white
 * pills with their own border and shadow, sitting directly on the cream page,
 * with the active one filled in primary. It reads as page-level navigation
 * rather than as a setting on the thing below it, which is exactly what
 * `/today`'s four views are.
 *
 * It is a *composite over the primitive*, not a re-implementation: Base UI's
 * `Tabs` still owns roving focus, `aria-selected`, arrow-key movement and the
 * panel wiring. Only the skin differs — which is the whole reason this lives in
 * `components/kynite/` rather than as a fifth variant inside `ui/tabs.tsx`.
 *
 * Panels are `children`, so a server component can be handed straight through:
 * the page loads every tab's data server-side and only the *switch* is a client
 * concern.
 */

export type PillTabItem<Value extends string> = {
  value: Value;
  label: string;
  icon: IconName;
};

export function PillTabs<Value extends string>({
  items,
  value,
  onValueChange,
  label,
  className,
  listClassName,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onChange'> & {
  items: readonly PillTabItem<Value>[];
  value: Value;
  onValueChange: (next: Value) => void;
  /** Accessible name of the tablist — it has no visible heading. */
  label: string;
  listClassName?: string;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next as Value)}
      className={cn('min-w-0 gap-4', className)}
      {...props}
    >
      <TabsList
        variant="line"
        aria-label={label}
        // No track: the pills *are* the control. `-mx-1 px-1` keeps the focus
        // ring of the first and last pill from being clipped by the horizontal
        // scroller a phone needs.
        className={cn(
          // `min-w-0` matters as much as `overflow-x-auto` here: this list is
          // a flex item in the Tabs root's flex-col, and without it the item's
          // content-based intrinsic width wins over `w-full`, so the row grows
          // past the viewport instead of shrinking to it and scrolling
          // internally — the page scrolls horizontally and the last pill is
          // cut off instead. `[scrollbar-width:none]` + the webkit pseudo hide
          // the scrollbar; there's no existing "no-scrollbar" utility to reuse.
          '-mx-1 w-full max-w-full min-w-0 justify-start overflow-x-auto px-1 py-1 [scrollbar-width:none] group-data-horizontal/tabs:h-auto [&::-webkit-scrollbar]:hidden',
          listClassName
        )}
      >
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            data-testid={`pill-tab-${item.value}`}
            className={cn(
              'h-10 shrink-0 grow-0 gap-2 rounded-4xl border-line-subtle bg-card px-4 font-display text-body-sm font-bold whitespace-nowrap text-ink-secondary shadow-sm',
              'hover:bg-surface-container hover:text-ink',
              // `ui/tabs.tsx`'s `line` variant — which this skin builds on for
              // its transparent, trackless list — styles its *own* active tab
              // as an underline: `data-active:bg-transparent` scoped to
              // `group-data-[variant=line]/tabs-list:`, plus an `after:`
              // pseudo-element opacity toggle for the underline bar itself.
              // Those declarations use a different variant chain than a plain
              // `data-active:bg-primary`, so `cn()` (tailwind-merge) never
              // recognizes them as the same conflict and drops neither — both
              // land in the generated CSS with equal specificity, and which
              // one wins becomes an accident of Tailwind's internal class
              // order rather than of source order in this file. That's what
              // produced the outlined pill with invisible text (the primary
              // background lost to `bg-transparent`, leaving white text on a
              // transparent/white pill) and the stray underline beneath it.
              // The fix is to override with the *exact same variant chain* so
              // tailwind-merge treats them as one group and this call's value
              // deterministically wins, and to kill the underline's box
              // outright via `content-none` rather than fight its opacity
              // toggle.
              'data-active:border-primary data-active:bg-primary data-active:text-primary-foreground data-active:shadow-brand',
              'group-data-[variant=line]/tabs-list:data-active:bg-primary dark:group-data-[variant=line]/tabs-list:data-active:bg-primary dark:group-data-[variant=line]/tabs-list:data-active:border-primary dark:data-active:text-primary-foreground',
              'after:content-none'
            )}
          >
            <Icon name={item.icon} size="sm" />
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {children}
    </Tabs>
  );
}

export { TabsContent as PillTabsPanel };
