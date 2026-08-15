import { cn } from '../lib/utils';
import { MemberFace } from './member-face';
import { ProgressBar } from './progress-bar';
import { StarCount } from './star-count';

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
 * row this is. Which is also why the two colour classes arrive as props rather
 * than as a `MemberColor`: `MEMBER_COLOR_CLASSES` is the family slice's table,
 * and the package draws the hue without knowing whose it is
 * (`modules/today/ui/kid-stat-card.tsx` is the wrapper that looks it up).
 *
 * There is no streak and no level here, deliberately: both are a PRD cut (the
 * reasoning is at `savings-goal-card.tsx`), and this block is built from the
 * facts this product actually keeps.
 */

export type KidStatCardProps = {
  /** Echoed as `data-member-id`, which the e2e assertions read. */
  memberId?: string;
  name: string;
  avatarUrl?: string | null;
  /** `MEMBER_COLOR_CLASSES[color].surface` — the initials fallback's ground. */
  avatarSurfaceClass?: string;
  /** `MEMBER_COLOR_CLASSES[color].dot` — the bar's fill, in the child's hue. */
  barClass?: string;
  starsToday: number;
  /** 0..100. */
  percent: number;
  /** Already-translated copy — this component owns no strings. */
  stepsLabel: string;
  starsLabel: string;
  progressLabel: string;
  size?: 'compact' | 'default';
  className?: string;
};

export function KidStatCard({
  memberId,
  name,
  avatarUrl,
  avatarSurfaceClass,
  barClass,
  starsToday,
  percent,
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
      data-member-id={memberId}
      className={cn('flex flex-col gap-2.5', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <MemberFace
            name={name}
            avatarUrl={avatarUrl}
            surfaceClass={avatarSurfaceClass}
            size={compact ? 'default' : 'lg'}
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body-sm font-semibold">{name}</span>
            <span className="truncate text-caption text-ink-secondary">{stepsLabel}</span>
          </div>
        </div>

        <StarCount value={starsToday} srLabel={starsLabel} />
      </div>

      <ProgressBar value={percent} label={progressLabel} fillClassName={barClass} />
    </div>
  );
}
