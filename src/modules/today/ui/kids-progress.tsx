import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/ui/icon';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { ProgressBar, StarCount } from '@/components/kynite';
import { MemberAvatar } from '@/modules/family';
import type { KidProgress } from '../page-data';

/**
 * "Kids' Progress" — `docs/design/stitch/.../today_s_flow_light_mode/code.html:108-171`.
 *
 * The mockup's card carries a flame + "5 Day Streak", a star pill, and a
 * `LEVEL 3 / 40% TO LEVEL 4` bar over a shimmering gold track. Streaks and
 * levels/XP are a **deliberate PRD cut** (`docs/rebuild-design-gaps.md` root
 * cause 7; the reasoning is at `modules/rewards/ui/savings-goal-card.tsx:14`),
 * and M19 is a re-composition, not a re-litigation of that decision. So the
 * three slots are kept and refilled with facts this product does keep:
 *
 * - flame + streak → today's routine progress, `3 van 5 klaar`;
 * - star pill → stars earned **today** (the ledger is append-only, so this
 *   number cannot fall during the afternoon);
 * - level bar → the same today ratio as a bar, with no level either side of it.
 *
 * The bar therefore measures a day and resets with it. Nothing here counts
 * consecutive days, and nothing compares one child to another beyond the plain
 * fact of sitting in the same list — this is a parent's screen, which is the
 * only place research §Decisions 3 permits even that.
 */

export type KidsProgressProps = {
  kids: KidProgress[];
  className?: string;
};

export async function KidsProgress({ kids, className }: KidsProgressProps) {
  const t = await getTranslations('today');

  return (
    <aside
      data-testid="today-kids-progress"
      className={cn('flex flex-col gap-4 rounded-3xl bg-surface-container p-4 sm:p-6', className)}
    >
      <h3 className="font-display text-h3">{t('kids.title')}</h3>

      {kids.length === 0 ? (
        <p className="text-body-sm text-ink-secondary">{t('kids.empty')}</p>
      ) : (
        // M23: the panel moved out of a narrow right-hand column and under the
        // full-width day board, so the cards lay out across the width instead
        // of stacking one 1200px-wide card per child. It is still a single
        // column wherever the panel is narrow — a phone, or any future caller
        // that puts it back in a sidebar.
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {kids.map((kid) => (
            <Link
              key={kid.memberId}
              // The builder, not a per-child deep link: `/routines` takes no
              // member parameter, and inventing one here would be a promise this
              // page cannot keep.
              href="/routines"
              data-slot="kid-progress-card"
              data-member-id={kid.memberId}
              className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-sm transition-shadow duration-200 ease-brand hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <div className="flex items-center gap-3">
                <MemberAvatar
                  displayName={kid.displayName}
                  avatarUrl={kid.avatarUrl}
                  color={kid.color}
                  size="lg"
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-display text-h3">{kid.displayName}</span>
                  <span className="flex items-center gap-1 text-body-sm text-ink-secondary">
                    <Icon name="task_alt" size="sm" />
                    {kid.totalSteps === 0
                      ? t('kids.noRoutines')
                      : t('kids.steps', { done: kid.doneSteps, total: kid.totalSteps })}
                  </span>
                </div>
                <StarCount
                  className="ml-auto"
                  value={kid.starsToday}
                  srLabel={t('kids.starsToday', { count: kid.starsToday })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-overline text-ink-muted uppercase">
                  <span>{t('kids.progressLabel')}</span>
                  <span className="tabular-nums">
                    {t('kids.balance', { count: kid.starBalance })}
                  </span>
                </div>
                {/* `aria-hidden`: the same numbers are already spelled out above,
                  and a second announcement of the same ratio is noise. */}
                <ProgressBar value={Math.round(kid.ratio * 100)} tone="gold" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
