'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon } from '@kynite/ui';
import { Link } from '@/i18n/navigation';
import { useTodayTab } from './use-today-tab';

/**
 * The board's quick-action grid — the four things somebody walking past the
 * screen actually does, as buttons rather than as a route they have to find.
 *
 * One filled and the rest outlined: starting a timer is the one that happens
 * mid-task, with wet hands, from two steps away. The others are deliberate acts
 * and can afford to be quieter. All of them are 56px tall, because this is a
 * wall device and a thumb aiming from an arm's length away needs the target.
 *
 * ## Why the grid is often shorter than the design sheet's
 *
 * The sheet draws four tiles on the wall tablet. Three of them are exactly what
 * the §7 matrix denies a *device* principal: `event:write` and `task:write` are
 * `deny` (the hub deliberately offers no event FAB and no task quick-add), and
 * only `completion:write` is `allow`. So each tile is gated on the permission
 * the action would need, and the wall ends up with the two it may perform —
 * the same rule the rest of the hub follows: offer no write rather than one
 * that would be refused on submit.
 *
 * The parent app, where a signed-in adult is the principal, gets all four.
 */

export type TodayQuickActionsProps = {
  /** `/timers` in the parent app, `/hub/timers` on the wall. */
  timersHref: string;
  /**
   * "Taak erbij", already resolved by the caller. Same reason as
   * `newEventAction`: the composer belongs to the tasks slice, whose barrel is
   * `server-only` and therefore unreachable from this client component.
   * `null` where `task:write` is denied.
   */
  taskAction?: ReactNode;
  /**
   * "Nieuw event", already resolved by the caller: the dialog lives in the
   * calendar slice, and this component may not import it (`server-only` in
   * that barrel). `null` where `event:write` is denied.
   */
  newEventAction?: ReactNode;
  /** `completion:write` — gates the tile that jumps to the star matrix. */
  canGiveStars: boolean;
};

export function TodayQuickActions({
  timersHref,
  taskAction,
  newEventAction,
  canGiveStars,
}: TodayQuickActionsProps) {
  const t = useTranslations('today');
  const { setTab } = useTodayTab();

  const tile = 'min-h-14 justify-start gap-2.5 rounded-2xl px-4 font-display text-body font-bold';

  return (
    <div data-testid="today-quick-actions" className="grid grid-cols-2 gap-2.5">
      <Button className={tile} nativeButton={false} render={<Link href={timersHref} />}>
        <Icon name="timer" size="md" />
        {t('tasks.startTimer')}
      </Button>

      {taskAction}
      {newEventAction}

      {canGiveStars ? (
        /* Not a route: the star matrix is a tab of this very page, and the tab
           state is a shared store (`use-today-tab.ts`), so the button that
           sends you there is the same switch the pills use. */
        <Button
          variant="outline"
          data-testid="today-action-stars"
          className={tile}
          onClick={() => setTab('sterren')}
        >
          <Icon name="star" size="md" filled className="text-gold" />
          {t('actions.giveStar')}
        </Button>
      ) : null}
    </div>
  );
}
