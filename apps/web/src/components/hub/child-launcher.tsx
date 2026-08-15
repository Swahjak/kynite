'use client';

import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { ProgressBar } from '@/components/kynite';

/**
 * The board's per-child entry points (M19) — the Stitch "Kids' Progress" panel,
 * adapted to a product that has no streaks and no levels.
 *
 * This is how a child gets from the family's board to their own screens, and
 * it is a *face*, not a menu item: the target is the child's avatar and name at
 * wall scale, which is the only affordance a pre-reader can use. Tapping it
 * opens that child's routines; the star chip beside it opens their chart.
 *
 * What it shows about a child is one fact, stated: "3 of 5 done". Never a
 * ranking, never two children compared on one bar, never a mark on the child
 * who has nothing done yet (research §Decisions 1 and 3, enforced by
 * `tests/unit/no-negative-marking.test.ts`). A child with nothing scheduled
 * gets a plain line saying so, not an empty progress bar implying a shortfall.
 *
 * Presentational on purpose — colours and initials arrive as strings the
 * server resolved, the same seam `StoreChip` uses, because this is a client
 * component and `@/modules/family` carries `server-only` queries.
 */

export type HubChild = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  /** A member-colour surface class, resolved server-side. */
  colorClass: string;
  /** Steps done today across every routine that is due. */
  doneCount: number;
  total: number;
};

export function ChildLauncher({ entries }: { entries: readonly HubChild[] }) {
  const t = useTranslations('hub.children');

  if (entries.length === 0) return null;

  return (
    <section
      data-testid="hub-child-launcher"
      className="flex flex-col gap-3 rounded-3xl bg-surface p-4"
    >
      <h2 className="label-overline text-ink-muted">{t('title')}</h2>

      <ul
        className={cn(
          'grid gap-3',
          entries.length >= 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2'
        )}
      >
        {entries.map((child) => {
          const ratio = child.total === 0 ? 0 : child.doneCount / child.total;
          const complete = child.total > 0 && child.doneCount === child.total;

          return (
            <li
              key={child.id}
              data-testid="hub-child-card"
              data-member-id={child.id}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/10"
            >
              <Link
                href={`/hub/routines/${child.id}`}
                data-testid="hub-child-routines"
                aria-label={t('openRoutines', { name: child.displayName })}
                className={cn(
                  'flex min-h-16 min-w-0 flex-1 items-center gap-4 rounded-xl p-2 transition-colors duration-200 ease-brand',
                  'hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-ring/50'
                )}
              >
                <Avatar size="hub" className="shrink-0">
                  {child.avatarUrl ? <AvatarImage src={child.avatarUrl} alt="" /> : null}
                  <AvatarFallback className={child.colorClass}>{child.initials}</AvatarFallback>
                </Avatar>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-display text-h2 font-bold">
                    {child.displayName}
                  </span>

                  {child.total === 0 ? (
                    <span className="text-body text-ink-secondary">{t('nothingToday')}</span>
                  ) : (
                    <>
                      <span
                        data-testid="hub-child-progress"
                        className="text-body text-ink-secondary"
                      >
                        {complete
                          ? t('allDone')
                          : t('progress', { done: child.doneCount, total: child.total })}
                      </span>
                      <ProgressBar value={Math.round(ratio * 100)} />
                    </>
                  )}
                </span>
              </Link>

              <Link
                href={`/hub/stars/${child.id}`}
                data-testid="hub-child-stars"
                aria-label={t('openStars', { name: child.displayName })}
                className={cn(
                  'flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-gold/20 text-gold-ink',
                  'transition-colors duration-200 ease-brand hover:bg-gold/30 focus-visible:ring-3 focus-visible:ring-ring/50'
                )}
              >
                <Icon name="star" size="xl" filled />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
