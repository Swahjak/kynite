import { KidStatCard as UiKidStatCard } from '@kynite/ui';
import { MEMBER_COLOR_CLASSES } from '@/modules/family';
import type { KidProgress } from '../page-data';

/**
 * `@kynite/ui`'s `KidStatCard`, with the member's colour resolved.
 *
 * Wave B moved the block itself into the design system, where it is three
 * facts and two colour classes. What stayed behind is the one thing the
 * package may not know: that a `KidProgress` carries a `MemberColor`, and that
 * `MEMBER_COLOR_CLASSES` is where a `MemberColor` turns into a Tailwind class
 * pair. Same seam as `MemberAvatar` over `MemberFace`.
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

export function KidStatCard({ kid, ...rest }: KidStatCardProps) {
  return (
    <UiKidStatCard
      memberId={kid.memberId}
      name={kid.displayName}
      avatarUrl={kid.avatarUrl}
      avatarSurfaceClass={MEMBER_COLOR_CLASSES[kid.color].surface}
      barClass={MEMBER_COLOR_CLASSES[kid.color].dot}
      starsToday={kid.starsToday}
      percent={Math.round(kid.ratio * 100)}
      {...rest}
    />
  );
}
