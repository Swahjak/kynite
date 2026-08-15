import { cn } from '../lib/utils';
import { MemberFace } from './member-face';

/**
 * The overlapping avatar stack the mockups put on every block that belongs to
 * somebody (`today_s_flow_light_mode/code.html:64-67`).
 *
 * Faces, not names: on a card sized for a glance from the other side of a
 * kitchen the face is the fastest possible answer to "whose is this", and the
 * name is still there for a screen reader through the fallback initials and
 * this list's own label.
 *
 * An empty stack renders nothing rather than an "everyone" placeholder — the
 * app's `PersonColumns` has a dedicated shared-events row for that, and two
 * different pictures of the same fact on one screen is one too many.
 *
 * The faces arrive already ordered and already resolved to a colour class:
 * ordering is the family's own `sortOrder` and the hue comes from
 * `MEMBER_COLOR_CLASSES`, neither of which the design system knows about. See
 * `modules/today/ui/member-faces.tsx` for the wrapper that does both.
 */

export type StackedFace = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** `MEMBER_COLOR_CLASSES[color].surface`. */
  surfaceClass?: string;
};

export function FaceStack({
  faces,
  size = 'sm',
  label,
  className,
}: {
  faces: readonly StackedFace[];
  size?: 'xs' | 'sm' | 'default';
  /** Accessible name of the group. Defaults to the names, comma-separated. */
  label?: string;
  className?: string;
}) {
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
      aria-label={label ?? faces.map((face) => face.name).join(', ')}
    >
      {faces.map((face) => (
        <MemberFace
          key={face.id}
          name={face.name}
          avatarUrl={face.avatarUrl}
          surfaceClass={face.surfaceClass}
          size={size}
          className="ring-2 ring-card"
        />
      ))}
    </div>
  );
}
