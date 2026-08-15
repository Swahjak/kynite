import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * One piece of ambient decoration — a balloon, a leaf, a gift, a snowflake.
 *
 * The theme banner's right-hand edge carries three to five of these ("Vandaag
 * met thema's"), and the whole effect depends on them *not* agreeing: each one
 * sits at its own percentage across the card, at its own angle, on its own
 * duration and its own delay. Four shapes on identical timing read as a
 * machine; the same four staggered read as weather, which is the register the
 * banner wants — decoration a child notices without being asked to look.
 *
 * Four motions, all from the design sheet's keyframes:
 *
 * - `drift` — bobs 8px and back. Balloons, gifts, eggs, flowers, flags.
 * - `fall` — enters above the card and falls past it, fading in and out.
 *   Leaves, snow, stars. Give it no `top`: the keyframe supplies the travel.
 * - `fly` — a slow figure-of-eight with a matching roll. Bats, pumpkins.
 * - `spin` — one slow turn. The summer sun, and nothing else so far.
 *
 * The piece is `aria-hidden` and non-interactive by construction. The banner's
 * eyebrow already names the day in words; this layer adds nothing a screen
 * reader should have to hear, and a decoration that could take a tap would be
 * stealing one from the routine underneath.
 */

export type FloatingMotion = 'drift' | 'fall' | 'fly' | 'spin';

const MOTION_CLASS: Record<FloatingMotion, string> = {
  drift: 'kynite-drift',
  fall: 'kynite-fall',
  fly: 'kynite-fly',
  spin: 'kynite-spin-slow',
};

export type FloatingPieceProps = Omit<React.ComponentProps<'span'>, 'style'> & {
  motion: FloatingMotion;
  /** Position across the card, e.g. `'76%'` — the pieces live in its right third. */
  left: string;
  /** Position down the card. Omitted for `fall`, whose keyframe owns the Y axis. */
  top?: string;
  /** Box size in px; an icon child is sized to match. */
  size?: number;
  /** The piece's resting angle, in degrees — `--rot` in every keyframe. */
  rotate?: number;
  /** Seconds. Defaults to the token for this motion; vary it per piece. */
  duration?: number;
  /** Seconds. The other half of the stagger. */
  delay?: number;
};

export function FloatingPiece({
  motion,
  left,
  top,
  size,
  rotate = 0,
  duration,
  delay,
  className,
  children,
  ...props
}: FloatingPieceProps) {
  return (
    <span
      data-slot="floating-piece"
      aria-hidden="true"
      className={cn('pointer-events-none absolute', MOTION_CLASS[motion], className)}
      style={{
        left,
        top,
        width: size,
        height: size,
        fontSize: size,
        animationDuration: duration === undefined ? undefined : `${duration}s`,
        animationDelay: delay === undefined ? undefined : `${delay}s`,
        ['--rot' as string]: `${rotate}deg`,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
