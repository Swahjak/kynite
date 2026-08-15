import { ProgressBar, StarCount } from '@/components/kynite';
import { cn } from '@kynite/ui';
import { MEMBER_COLOR_CLASSES, MemberAvatar } from '@/modules/family';
import type { KidProgress } from '../page-data';

/**
 * One child's day, as a stat block: face, how much of today's routine work is
 * done, the stars it has earned, and a bar in that child's own colour.
 *
 * Shared by two tabs — "Routines" draws a grid of the compact size, "Sterren"
 * stacks the large one beside the star matrix — because it is the same three
 * facts either way, and two copies would drift the moment one of them gained a
 * fourth.
 *
 * The colour of the bar is the *member's*, not a semantic tone: on a screen
 * showing four children at once the hue is the fastest thing that says whose
 * row this is. Everything a token could carry still comes from one
 * (`MEMBER_COLOR_CLASSES`).
 *
 * There is no streak and no level here, deliberately: both are a PRD cut (the
 * reasoning is at `modules/rewards/ui/savings-goal-card.tsx`), and this block
 * is built from the facts this product actually keeps.
 */

export type KidStatCardProps = {
  kid: KidProgress;
  /** Already-translated copy — this component owns no strings. */
  stepsLabel: string;
  starsLabel: string;
  progressLabel: string;
  size?: 'compact' | 'default';
  className?: string;
};

export function KidStatCard({
  kid,
  stepsLabel,
  starsLabel,
  progressLabel,
  size = 'default',
  className,
}: KidStatCardProps) {
  const compact = size === 'compact';

  return (
    <div
      data-slot="kid-stat-card"
      data-member-id={kid.memberId}
      className={cn('flex flex-col gap-2.5', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <MemberAvatar
            displayName={kid.displayName}
            avatarUrl={kid.avatarUrl}
            color={kid.color}
            size={compact ? 'default' : 'lg'}
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body-sm font-semibold">{kid.displayName}</span>
            <span className="truncate text-caption text-ink-secondary">{stepsLabel}</span>
          </div>
        </div>

        <StarCount value={kid.starsToday} srLabel={starsLabel} />
      </div>

      <ProgressBar
        value={Math.round(kid.ratio * 100)}
        label={progressLabel}
        fillClassName={MEMBER_COLOR_CLASSES[kid.color].dot}
      />
    </div>
  );
}
