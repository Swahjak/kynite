import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';

/**
 * A person's face — avatar image if they picked one, initials on their own
 * colour otherwise. `docs/design/components.md` § Avatars.
 *
 * This is the **presentational** half of the pattern: it takes already-resolved
 * strings (`initials`, `surfaceClass`, `ringClass`) rather than a `MemberColor`,
 * so it can be rendered from a client component or from a surface that has no
 * access to `@/modules/family` (which is `server-only`). `MemberAvatar` in
 * `modules/family/ui/member-avatar.tsx` is the domain-aware wrapper that
 * resolves a member row onto this component — use that one whenever you have a
 * member, and this one when all you have is a colour class and initials.
 *
 * Every avatar in the product goes through one of those two. Changing the ring,
 * the fallback weight or the size ramp is then a single edit here (or in
 * `ui/avatar.tsx` for the sizes themselves).
 */
/**
 * The initials rule, owned here so every surface spells it the same way.
 * `modules/family/ui/tokens.ts` re-states it as `initialsOf` for the server
 * side of the app; this is the copy a client component can reach (the module
 * boundary rule forbids deep-importing a slice's `ui/tokens`).
 */
export const initialsFor = (displayName: string): string =>
  displayName.trim().slice(0, 2).toUpperCase();

export function MemberFace({
  name,
  avatarUrl,
  initials,
  surfaceClass,
  ringClass,
  size = 'lg',
  ringed = false,
  className,
}: {
  /** The member's display name. Also the source of the initials, if not given. */
  name?: string;
  avatarUrl?: string | null;
  /** Overrides the derived initials. */
  initials?: string;
  /** e.g. `MEMBER_COLOR_CLASSES[color].surface`. */
  surfaceClass?: string;
  /** e.g. `MEMBER_COLOR_CLASSES[color].ring`. Required when `ringed`. */
  ringClass?: string;
  size?: '2xs' | 'xs' | 'sm' | 'default' | 'lg' | 'hub';
  ringed?: boolean;
  className?: string;
}) {
  return (
    <Avatar
      size={size}
      title={name}
      className={cn(ringed && ['ring-2 ring-offset-2 ring-offset-card', ringClass], className)}
    >
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className={surfaceClass}>
        {initials ?? initialsFor(name ?? '')}
      </AvatarFallback>
    </Avatar>
  );
}
