'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn, type PillTabItem, PillTabs, PillTabsPanel } from '@kynite/ui';
import type { IconName } from '@kynite/ui';
import { TODAY_TABS, useTodayTab, type TodayTab } from './use-today-tab';

/**
 * `/today`'s four views and the control that picks between them.
 *
 * This replaces the day board's own combined/columns switcher on this page: the
 * board's two arrangements are now two of *four* peers ("Dagoverzicht" and "Per
 * persoon"), sitting beside the routine and star overviews a parent used to
 * have to scroll past everything else to reach.
 *
 * Only the switch is a client concern. Every panel is handed in already
 * rendered, so the page loads all four tabs' data on the server in one pass and
 * flipping between them is a re-render over data that is already here — no
 * request, no spinner, no loading state to design.
 */

const TAB_ICONS: Record<TodayTab, IconName> = {
  dag: 'calendar_month',
  personen: 'view_column',
  routines: 'checklist',
  sterren: 'bar_chart',
};

export type TodayTabsProps = Record<TodayTab, ReactNode> & {
  /**
   * Which tab this surface opens on before anyone has picked one *on this
   * device*. The parent app takes the slice's own default; the wall hub maps
   * `family.hubDefaultView` onto it (FR28), so the Controller's "default view"
   * control still decides what the wall shows on a cold boot.
   */
  defaultTab?: TodayTab;
  /**
   * The panel takes the height it is given and scrolls inside it.
   *
   * What the wall needs, and only the wall: a kiosk header that scrolled away
   * would take the clock and the day with it, and those are the two things a
   * glance from across the room is looking for. In the parent app the page
   * scrolls as one, which is what a thumb expects.
   */
  fill?: boolean;
};

export function TodayTabs({ dag, personen, routines, sterren, defaultTab, fill }: TodayTabsProps) {
  const t = useTranslations('today');
  const { tab, setTab } = useTodayTab(defaultTab);

  const items: PillTabItem<TodayTab>[] = TODAY_TABS.map((value) => ({
    value,
    label: t(`tabs.${value}`),
    icon: TAB_ICONS[value],
  }));

  const panels: Record<TodayTab, ReactNode> = { dag, personen, routines, sterren };

  return (
    <PillTabs
      items={items}
      value={tab}
      onValueChange={setTab}
      label={t('tabs.label')}
      data-testid="today-tabs"
      className={cn('min-h-0 flex-1', fill && 'flex-col')}
      listClassName={fill ? 'shrink-0' : undefined}
    >
      {TODAY_TABS.map((value) => (
        <PillTabsPanel
          key={value}
          value={value}
          data-testid={`today-tab-${value}`}
          className={fill ? 'min-h-0 flex-1 overflow-y-auto' : undefined}
        >
          {panels[value]}
        </PillTabsPanel>
      ))}
    </PillTabs>
  );
}
