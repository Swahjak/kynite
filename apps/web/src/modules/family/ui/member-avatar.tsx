import { MemberFace } from '@kynite/ui';
import type { MemberColor } from '../schema';
import { MEMBER_COLOR_CLASSES } from './tokens';

/**
 * A member's face: their avatar if picked, their initials on their own color
 * otherwise.
 *
 * `ringed` (M19 phase 2) draws the 2px ring in the member's colour that the
 * mockups use as the identity marker on roster surfaces. It is opt-in rather
 * than the default because the shell's header avatar and the hub's person
 * columns already carry their own ring treatment, and two rings is none.
 */
export function MemberAvatar({
  displayName,
  avatarUrl,
  color,
  size = 'lg',
  ringed = false,
  className,
}: {
  displayName: string;
  avatarUrl: string | null;
  color: MemberColor;
  size?: 'xs' | 'sm' | 'default' | 'lg' | 'hub';
  ringed?: boolean;
  className?: string;
}) {
  return (
    <MemberFace
      name={displayName}
      avatarUrl={avatarUrl}
      surfaceClass={MEMBER_COLOR_CLASSES[color].surface}
      ringClass={MEMBER_COLOR_CLASSES[color].ring}
      size={size}
      ringed={ringed}
      className={className}
    />
  );
}
