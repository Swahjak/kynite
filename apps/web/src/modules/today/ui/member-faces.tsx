import { FaceStack, type StackedFace } from '@kynite/ui';
import { MEMBER_COLOR_CLASSES, type Member } from '@/modules/family';

/**
 * The overlapping avatar stack, for a set of member ids.
 *
 * Wave B moved the stack itself into `@kynite/ui` as `FaceStack`. What stays
 * here is the half the package may not have: resolving ids against the family
 * roster, in the family's own `sortOrder` rather than in the order they
 * happened to be attached to the event (the same two children always stack the
 * same way), and turning each `MemberColor` into its class pair.
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
  const faces: StackedFace[] = members
    .filter((member) => ids.has(member.id))
    .map((member) => ({
      id: member.id,
      name: member.displayName,
      avatarUrl: member.avatarUrl,
      surfaceClass: MEMBER_COLOR_CLASSES[member.color].surface,
    }));

  return <FaceStack faces={faces} size={size} className={className} />;
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
