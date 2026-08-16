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
 *
 * `2xs` is the time-grid block's stack (see `Avatar`'s note on the size). At
 * 16px the 8px overlap of the larger sizes eats half the face, so it steps
 * down with it. The sheet draws the overlap at 5px of 16
 * (`Kalender.dc.html`:108); `-space-x-1.5` is 6px, the nearest step on the
 * spacing scale — the 1px is not worth a literal outside the scale.
 *
 * **`2xs` carries no ring.** The design system's Avatars section is explicit:
 * *"16 alleen inline in tekst en in dichte lijsten, zonder witte rand"*. The
 * white ring is the *stack's* device (`Avatar/Stack`: `box-shadow:0 0 0 2px
 * #ffffff` at 40px), and 16 is the one step the sheet withholds it from — a
 * ring is 12% of a 16px face's diameter, and it was thinning the face rather
 * than separating it. This used to be `ring-1 ring-card`, which was the code
 * splitting the difference; the sheet now settles it.
 *
 * What still separates two overlapping 16px faces is `Avatar`'s own hairline
 * (`after:border-border`, `mix-blend-darken`). That is deliberately *not*
 * removed with the ring: it is a 1px edge in the line tone rather than a white
 * rand, its job is to stop a pale face dissolving into a pale card, and the
 * sheet's flat saturated swatches are drawn where such an edge would be
 * invisible either way. The design withheld the ring, not the edge.
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
  size?: '2xs' | 'xs' | 'sm' | 'default';
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
      className={cn('flex', size === '2xs' ? '-space-x-1.5' : '-space-x-2', className)}
      aria-label={label ?? faces.map((face) => face.name).join(', ')}
    >
      {faces.map((face) => (
        <MemberFace
          key={face.id}
          name={face.name}
          avatarUrl={face.avatarUrl}
          surfaceClass={face.surfaceClass}
          size={size}
          className={size === '2xs' ? undefined : 'ring-2 ring-card'}
        />
      ))}
    </div>
  );
}
