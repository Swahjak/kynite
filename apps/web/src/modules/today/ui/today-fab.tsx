'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { FabSpeedDial, type FabSpeedDialAction } from '@/components/ui/fab';
import { Link } from '@/i18n/navigation';
import { useTodayTab } from './use-today-tab';

/**
 * The day board's quick-action FAB — a speed dial replacing what used to be
 * two separate affordances: `(app)/today`'s `NewEventFab` and the wall's
 * `TodayQuickActions` grid.
 *
 * Both surfaces mount this at the page level, beside `TodayTabDag` rather
 * than inside it — the same seam `NewEventFab` used to sit on, and for the
 * same reason: `FabSpeedDial` portals into the shell's `FAB_SLOT_ID`
 * regardless of where in the tree it renders, so there is nothing to gain by
 * threading it through the day panel's own props.
 *
 * `newEventAction` and `taskAction` are the two actions this component cannot
 * build itself: the dialog behind the first (`AddEventFabAction`,
 * `@/modules/calendar`) and the composer trigger behind the second
 * (`TaskComposerFabAction`, `@/modules/tasks`) belong to other slices, and
 * this module may not import either slice's barrel from a client component —
 * both re-export `server-only` queries, so pulling one into the browser graph
 * fails the build (`eslint.config.mjs`'s boundary rule). So the page resolves
 * both, the same way it used to resolve `taskAction` / `newEventAction` for
 * the old grid, and hands down finished elements sized to be a
 * `FabSpeedDialAction`'s `render`.
 *
 * `undefined`/`null` on the wall for both: `event:write` and `task:write` are
 * `deny` for a device principal (§7), and the hub never resolves either
 * action at all rather than building one that would be refused on submit —
 * its dial stays at two actions where the phone's has four.
 */
export type TodayFabProps = {
  /** The surface's own timers route — `/timers` in the app, `/hub/timers` on the wall. */
  timersHref: string;
  /** `completion:write` — gates the "Ster geven" action. */
  canGiveStars: boolean;
  /**
   * "Nieuw event", already resolved by the page as one action's `render`
   * (`AddEventFabAction`, cloned by `FabSpeedDial` like any other action).
   * Absent on the wall, where `event:write` is `deny` for every principal.
   */
  newEventAction?: ReactElement<{
    className?: string;
    children?: unknown;
  }> | null;
  /**
   * "Taak erbij", already resolved by the page as one action's `render`
   * (`TaskComposerFabAction`). Absent on the wall, where `task:write` is
   * `deny` for every principal — the same gate `newEventAction` follows.
   */
  taskAction?: ReactElement<{
    className?: string;
    children?: unknown;
  }> | null;
};

export function TodayFab({ timersHref, canGiveStars, newEventAction, taskAction }: TodayFabProps) {
  const t = useTranslations('today');
  const { setTab } = useTodayTab();

  const actions: FabSpeedDialAction[] = [];

  if (newEventAction) {
    actions.push({
      id: 'add-event',
      icon: 'add',
      label: t('actions.newEvent'),
      render: newEventAction,
    });
  }

  if (taskAction) {
    actions.push({
      id: 'add-task',
      icon: 'add_task',
      label: t('tasks.add'),
      render: taskAction,
    });
  }

  actions.push({
    id: 'timer',
    icon: 'timer',
    label: t('tasks.startTimer'),
    render: <Link href={timersHref} />,
  });

  if (canGiveStars) {
    actions.push({
      id: 'stars',
      icon: 'star',
      label: t('actions.giveStar'),
      // Not a route: the star matrix is a tab of this very page, and the tab
      // state is a shared store (`use-today-tab.ts`), so the action that
      // sends you there is the same switch `TodayTabSterren`'s pills use.
      onClick: () => setTab('sterren'),
    });
  }

  return <FabSpeedDial label={t('actions.quickActions')} actions={actions} />;
}
