import { MemberAvatar, type Member } from '@/modules/family';
import { cn } from '@/lib/utils';

/**
 * The overlapping avatar stack the mockups put on every block that belongs to
 * somebody (`today_s_flow_light_mode/code.html:64-67`).
 *
 * Faces, not names: on a card sized for a glance from the other side of a
 * kitchen the face is the fastest possible answer to "whose is this", and the
 * name is still there for a screen reader through `MemberAvatar`'s fallback
 * initials and this list's own label.
 *
 * An event nobody owns renders nothing rather than an "everyone" placeholder —
 * `PersonColumns` already has a dedicated shared-events row for that, and two
 * different pictures of the same fact on one screen is one too many.
 */
export function MemberFaces({
  members,
  memberIds,
  size = 'sm',
  className,
}: {
  members: Member[];
  memberIds: readonly string[];
  size?: 'xs' | 'sm' | 'default';
  className?: string;
}) {
  const ids = new Set(memberIds);
  // Ordered by the family's own `sortOrder`, not by the order they happened to
  // be attached to the event: the same two children always stack the same way.
  const faces = members.filter((member) => ids.has(member.id));
  if (faces.length === 0) return null;

  return (
    // `role="img"`: the stack *is* the picture of "whose is this", and a bare
    // `<div>` carrying an `aria-label` is a generic container with a name no
    // assistive technology is required to announce. The role makes the group one
    // labelled image and hides the individual avatars' own text from the
    // announcement, which would otherwise repeat every name twice.
    <div
      data-slot="member-faces"
      role="img"
      className={cn('flex -space-x-2', className)}
      aria-label={faces.map((member) => member.displayName).join(', ')}
    >
      {faces.map((member) => (
        <MemberAvatar
          key={member.id}
          displayName={member.displayName}
          avatarUrl={member.avatarUrl}
          color={member.color}
          size={size}
          className="ring-2 ring-card"
        />
      ))}
    </div>
  );
}

/**
 * The display names behind a set of ids, in the family's own order.
 *
 * Ordered by `members`, never by the order the ids arrived in, for the same
 * reason the faces above are: the same two children always read the same way.
 */
export function namesOf(members: Member[], memberIds: readonly string[]): string[] {
  const ids = new Set(memberIds);
  return members.filter((member) => ids.has(member.id)).map((member) => member.displayName);
}

/**
 * `["Mila", "Daan"]` → `"Mila & Daan"`.
 *
 * Two names get the ampersand the mockups use; three or more get commas,
 * because "Tom & Lotte & Mila" reads as a list somebody forgot to finish. A
 * caller that has *everybody* should say "Iedereen" instead and never reach
 * here — that is a different fact, not a longer list.
 */
export function joinNames(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length <= 2) return names.join(' & ');
  return names.join(', ');
}

/** Owner plus attendees, de-duplicated — who a block is "for". */
export function participantsOf(event: {
  ownerMemberId: string | null;
  attendeeMemberIds: string[];
}): string[] {
  const ids = new Set<string>(event.attendeeMemberIds);
  if (event.ownerMemberId) ids.add(event.ownerMemberId);
  return [...ids];
}
