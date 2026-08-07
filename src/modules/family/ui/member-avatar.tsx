import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { MemberColor } from '../schema';
import { MEMBER_COLOR_CLASSES, initialsOf } from './tokens';

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
  size?: 'sm' | 'default' | 'lg' | 'hub';
  ringed?: boolean;
  className?: string;
}) {
  return (
    <Avatar
      size={size}
      className={cn(
        ringed && ['ring-2 ring-offset-2 ring-offset-card', MEMBER_COLOR_CLASSES[color].ring],
        className
      )}
    >
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className={cn(MEMBER_COLOR_CLASSES[color].surface)}>
        {initialsOf(displayName)}
      </AvatarFallback>
    </Avatar>
  );
}
