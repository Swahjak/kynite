import { cn } from '@/lib/utils';

/**
 * The circular progress ring on the NOW card
 * (`docs/design/stitch/.../today_s_flow_light_mode/code.html:38-46`).
 *
 * An inline SVG rather than a conic gradient or a border trick: it is the one
 * shape that is exact at every size, prints the same in both themes, and can be
 * given an accessible name. The product had no ring at all before M19 — timers
 * draw a linear bar (`modules/timers/ui/timer-tile.tsx`) — and this is
 * deliberately *not* that component: a timer bar counts a fixed prescription
 * down, this measures elapsed time through a block whose length comes from the
 * calendar.
 *
 * Geometry is in a 100×100 viewBox with `r=40`, so the stroke (8) never clips
 * against the box: 40 + 8/2 = 44 < 50. The circle is rotated -90° so 0% starts
 * at twelve o'clock, which is the only place a person reads a clock-shaped ring
 * from.
 *
 * `currentColor`-driven, so a caller places it on any surface — the hero uses
 * the on-primary ink at 20% for the track and the full ink for the sweep.
 */

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type ProgressRingProps = {
  /** 0–1. Clamped here as well as at the source: an SVG cannot be told twice. */
  ratio: number;
  /** Rendered in the middle — "8m", a count, a glyph. */
  children?: React.ReactNode;
  /** Accessible name for the ring itself, e.g. "8 minuten resterend". */
  label: string;
  className?: string;
  trackClassName?: string;
  sweepClassName?: string;
};

export function ProgressRing({
  ratio,
  children,
  label,
  className,
  trackClassName = 'text-current/20',
  sweepClassName = 'text-current',
}: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const offset = CIRCUMFERENCE * (1 - clamped);

  return (
    <div
      data-slot="progress-ring"
      className={cn('relative flex size-24 shrink-0 items-center justify-center', className)}
      role="img"
      aria-label={label}
    >
      <svg
        viewBox="0 0 100 100"
        className="size-full -rotate-90"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          className={trackClassName}
          cx="50"
          cy="50"
          r={RADIUS}
          fill="transparent"
          stroke="currentColor"
          strokeWidth="8"
        />
        <circle
          className={cn('transition-[stroke-dashoffset] duration-1000 ease-linear', sweepClassName)}
          cx="50"
          cy="50"
          r={RADIUS}
          fill="transparent"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-h3 font-bold">
        {children}
      </div>
    </div>
  );
}
