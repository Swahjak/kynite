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
  label,
}: {
  members: Member[];
  /**
   * `null` is the withheld audience of a busy-only event (see `participantsOf`)
   * and renders nothing at all — not the household, not a placeholder. Accepted
   * here rather than only at the call sites so that a caller passing the result
   * of `participantsOf` straight through cannot draw a face it was told not to.
   */
  memberIds: readonly string[] | null;
  size?: 'xs' | 'sm' | 'default';
  className?: string;
  /**
   * What the stack *says*, for a caller that dropped the names it used to
   * print beside it — the day list's rows do exactly that. Without it the
   * faces are decoration to a screen reader.
   */
  label?: string;
}) {
  if (memberIds === null) return null;

  const ids = new Set(memberIds);
  const faces: StackedFace[] = members
    .filter((member) => ids.has(member.id))
    .map((member) => ({
      id: member.id,
      name: member.displayName,
      avatarUrl: member.avatarUrl,
      surfaceClass: MEMBER_COLOR_CLASSES[member.color].surface,
    }));

  return <FaceStack faces={faces} size={size} className={className} label={label} />;
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

/**
 * Owner plus attendees, de-duplicated — who a block is "for".
 *
 * **`null` when the block is busy-only** (§7 `calendar:view_private` →
 * `busy-only`): the viewer may learn the hour is occupied and nothing else.
 * `queries.ts` blanks the title, the location and `attendeeMemberIds` on such a
 * row but passes `ownerMemberId` through — it is the block's only surviving
 * routing signal — so the owner *does* arrive here, and this is where the name
 * derived from it stops.
 *
 * `null` rather than `[]` because the two are different facts and every caller
 * of this renders them differently: `[]` is "nobody in particular", which reads
 * as "Iedereen" and draws the whole household's faces, and saying *that* about
 * a redacted hour still narrows what the hidden hour is.
 */
export function participantsOf(event: {
  ownerMemberId: string | null;
  attendeeMemberIds: string[];
  busyOnly?: boolean;
}): string[] | null {
  if (event.busyOnly) return null;

  const ids = new Set<string>(event.attendeeMemberIds);
  if (event.ownerMemberId) ids.add(event.ownerMemberId);
  return [...ids];
}
