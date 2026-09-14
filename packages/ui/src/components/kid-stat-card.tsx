import { cloneElement, type ReactElement } from 'react';
import { cn } from '../lib/utils';
import { Icon } from './icon';
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
 *
 * **`render` makes the whole card a link, Base-UI style.** The hub dashboard
 * links each card to that child's routine page; `TodayTabSterren`'s stack and
 * `(app)/today`'s own routines tab do not, because `/hub/routines/[memberId]`
 * needs a hub device. Since this package may not import `next/link`
 * (`packages/ui/.oxlintrc.json`), the caller passes the element — an
 * already-labelled `next/link` `<Link aria-label="…" href="…" />`, same seam
 * as `Fab`'s `render` — and it is cloned as an absolute overlay across the
 * whole card, the same "transparent overlay, not a wrapper" shape
 * `RoutineCard`'s own toggle uses. A chevron appears alongside the stars to
 * say the card goes somewhere.
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
  /**
   * Element to render as the whole-card tap target — e.g. `next/link`'s
   * `Link`, already carrying its own `href` and `aria-label` (the package may
   * not translate one itself). Cloned with an absolute inset overlay and the
   * focus ring; omitted, the card stays inert.
   */
  render?: ReactElement<{ className?: string }>;
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
  render,
}: KidStatCardProps) {
  const compact = size === 'compact';

  return (
    <div
      data-slot="kid-stat-card"
      data-member-id={memberId}
      className={cn('relative flex min-h-12 flex-col gap-2.5', className)}
    >
      {render
        ? cloneElement(render, {
            className: cn(
              'absolute inset-0 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              render.props.className
            ),
          })
        : null}

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

        <div className="flex shrink-0 items-center gap-1.5">
          <StarCount value={starsToday} srLabel={starsLabel} />
          {render ? (
            <Icon name="chevron_right" size="sm" aria-hidden className="text-ink-muted" />
          ) : null}
        </div>
      </div>

      <ProgressBar value={percent} label={progressLabel} fillClassName={barClass} />
    </div>
  );
}
