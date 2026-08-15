import * as React from 'react';

import { cn } from '../lib/utils';
import {
  CONFETTI_BURST_PIECES,
  CONFETTI_BURST_PIECES_BIG,
  type ConfettiPieceSpec,
} from './celebration-presets';

/**
 * A confetti burst drawn in CSS, from the shared piece specs.
 *
 * This is the *inside-a-card* burst: the one the design system's motion sheet
 * shows in a 140px specimen tile, the one a celebration panel carries behind
 * its heading, the one that still animates in a static Storybook build. The
 * full-screen burst a tap fires is `canvas-confetti`, dynamically imported by
 * the app (`components/celebration/confetti-burst.ts`) off
 * `CELEBRATION_PRESETS` — the package deliberately does not depend on it, so a
 * consumer of `@kynite/ui` never pays for a canvas library.
 *
 * Both read from `celebration-presets.ts`, which is the point: the palette and
 * the geometry are one source, and the two renderers are two ways of drawing
 * it rather than two designs.
 *
 * **`loop` is for specimens.** Confetti in product UI fires once, on a tap,
 * because that is what marks a moment; confetti that repeats forever is
 * wallpaper, and wallpaper next to a child's routine is noise. A looping burst
 * is still non-strobing — one piece's cycle is 1.6–1.8s, so well under the 3Hz
 * WCAG 2.3.1 threshold even repeating — but it belongs on a documentation page,
 * not above a checklist.
 */

export type ConfettiBurstProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  /** `standard` is the five-piece burst; `big` the eight-piece one, with gold. */
  intensity?: 'standard' | 'big';
  /** Where the pieces come from, as CSS lengths. Defaults to the card's centre. */
  origin?: { left: string; top: string };
  /** Repeat forever. Specimen sheets only — see the note above. */
  loop?: boolean;
};

function Piece({
  piece,
  big,
  loop,
  origin,
}: {
  piece: ConfettiPieceSpec;
  big: boolean;
  loop: boolean;
  origin: { left: string; top: string };
}) {
  return (
    <span
      className={cn(
        'absolute',
        big ? 'kynite-confetti-piece-big' : 'kynite-confetti-piece',
        piece.shape === 'round' ? 'rounded-full' : 'rounded-[2px]'
      )}
      style={{
        left: origin.left,
        top: origin.top,
        width: piece.size,
        height: piece.size,
        background: piece.color,
        animationDelay: `${piece.delay}s`,
        animationIterationCount: loop ? 'infinite' : 1,
        // A single fire has to *end* somewhere: without `forwards` the last
        // keyframe (scale .5, opacity 0) snaps back to the invisible 0% frame,
        // which reads as the piece flashing back into place before it goes.
        animationFillMode: loop ? undefined : 'forwards',
        ['--tx' as string]: `${piece.tx}px`,
        ['--ty' as string]: `${piece.ty}px`,
        ['--tr' as string]: `${piece.tr}deg`,
      }}
    />
  );
}

export function ConfettiBurst({
  intensity = 'standard',
  origin = { left: '50%', top: '50%' },
  loop = false,
  className,
  ...props
}: ConfettiBurstProps) {
  const big = intensity === 'big';
  const pieces = big ? CONFETTI_BURST_PIECES_BIG : CONFETTI_BURST_PIECES;

  return (
    <span
      data-slot="confetti-burst"
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      {...props}
    >
      {pieces.map((piece, index) => (
        <Piece key={index} piece={piece} big={big} loop={loop} origin={origin} />
      ))}
    </span>
  );
}
