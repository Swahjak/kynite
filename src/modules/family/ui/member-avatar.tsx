import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { MemberColor } from '../schema';
import { MEMBER_COLOR_CLASSES, initialsOf } from './tokens';

/** A member's face: their avatar if picked, their initials on their own color otherwise. */
export function MemberAvatar({
  displayName,
  avatarUrl,
  color,
  size = 'lg',
  className,
}: {
  displayName: string;
  avatarUrl: string | null;
  color: MemberColor;
  size?: 'sm' | 'default' | 'lg' | 'hub';
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className={cn(MEMBER_COLOR_CLASSES[color].surface)}>
        {initialsOf(displayName)}
      </AvatarFallback>
    </Avatar>
  );
}
