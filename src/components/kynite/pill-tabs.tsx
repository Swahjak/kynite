'use client';

import * as React from 'react';

import { Icon } from '@/components/ui/icon';
import type { IconName } from '@/components/ui/icon-codepoints';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

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
          '-mx-1 w-full max-w-full justify-start overflow-x-auto px-1 py-1 group-data-horizontal/tabs:h-auto',
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
              // Filled primary, and white on it — the mockup's active pill.
              'data-active:border-primary data-active:bg-primary data-active:text-primary-foreground data-active:shadow-brand dark:data-active:bg-primary dark:data-active:text-primary-foreground'
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
