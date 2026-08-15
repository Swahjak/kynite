import * as React from 'react';

import { cn } from '../lib/utils';
import { FaceStack, type StackedFace } from './face-stack';
import { Icon, type IconSize } from './icon';
import type { IconName } from './icon-codepoints';

/**
 * One event, as a line in a list — the row the August sheet settled on and
 * that `modules/today/ui/today-timeline.tsx` drew by hand for the hub, the
 * phone and the agenda alike.
 *
 * Its anatomy, left to right, is fixed; the props only decide what goes in
 * each slot:
 *
 * 1. **the category rail** — 4px, `self-stretch`, fully rounded. Not a dot:
 *    eleven event types share eight hues, so the hue alone can never separate
 *    school from opvang, and a rail carries a hue over a whole row where an
 *    8px dot only tints one corner of it.
 * 2. **the time gutter** — start stacked over end. The end time is what turns
 *    "10:00 Tandarts" into a block a parent can plan around; it is the one
 *    fact the older row spent a whole second line avoiding.
 * 3. **the category glyph** — the half of the identity that colour cannot
 *    carry.
 * 4. **the title**, truncating, with an optional second line.
 * 5. **the faces** of whoever the event belongs to — a name list costs the row
 *    its second line, and the stack says the same thing inside the title's own.
 * 6. **at most one trailing status token**. One. A row that reports two things
 *    at its right edge reports neither.
 *
 * Rows carry `border-t border-line-subtle first:border-t-0`, so a stack of
 * them inside one card reads as a single object divided by hairlines rather
 * than as N floating tiles. That is the whole reason the row draws its own
 * separator instead of leaving it to the list.
 *
 * **The package does no date work.** `startTime` and `endTime` arrive already
 * formatted in the household's locale and timezone — this component would
 * otherwise need `Intl` options it cannot know, and the app already has
 * `formatDateTime`. An all-day row is simply `startTime="Hele dag"` with no
 * `endTime`.
 *
 * Colour is a class string for the same reason it is everywhere else here:
 * `railClass` / `iconClass` come from the app's `CATEGORY_CLASSES`, which maps
 * a domain category the design system has never heard of onto `--cat-*`.
 */

/** 40 / 48 / 56px rows. `default` is the hub's; `compact` is what survives at 390px. */
export type EventRowSize = 'compact' | 'default' | 'roomy';

/**
 * - `default` — an ordinary row.
 * - `now` — the one block happening right now: a tinted, rounded row with the
 *   times in the brand colour, a bold title and the status pill. Exactly one
 *   row in a list is ever in this state; it is the single thing a glance from
 *   across the kitchen should land on.
 * - `past` — already over. Dimmed and struck through, never hidden.
 *
 * Free/busy redaction is deliberately *not* one of these: see `busy` on the
 * props. A private block that is also over is both things at once, and a
 * single enum cannot say so.
 */
export type EventRowState = 'default' | 'now' | 'past';

/** Either a ready-made node, or the props to build a `FaceStack` from. */
export type EventRowFaces = React.ReactNode | { faces: readonly StackedFace[]; label?: string };

type SizeSpec = {
  row: string;
  gutter: string;
  start: string;
  end: string;
  title: string;
  subtitle: string;
  icon: IconSize;
  face: 'xs' | 'sm' | 'default';
};

/**
 * The gutter is wider than the times strictly need at every step: `08:00` and
 * `08:00–08:45` have to sit on the same left edge down a whole list, and the
 * widest string in a 12-hour locale is `12:00 PM`. 44 / 52 / 56px is what
 * holds that without the title jumping.
 */
const SIZES: Record<EventRowSize, SizeSpec> = {
  compact: {
    row: 'min-h-10 gap-2.5 px-2 py-2',
    gutter: 'w-11',
    start: 'text-caption',
    end: 'text-caption',
    title: 'text-body-sm',
    subtitle: 'text-caption',
    icon: 'sm',
    face: 'xs',
  },
  default: {
    row: 'min-h-12 gap-3 p-3',
    gutter: 'w-13',
    start: 'text-body-sm',
    end: 'text-caption',
    title: 'text-body',
    subtitle: 'text-caption',
    icon: 'md',
    face: 'sm',
  },
  roomy: {
    row: 'min-h-14 gap-3.5 p-3.5',
    gutter: 'w-14',
    start: 'text-body',
    end: 'text-body-sm',
    title: 'text-body-lg',
    subtitle: 'text-body-sm',
    icon: 'lg',
    face: 'default',
  },
};

function isFaceStackProps(
  value: EventRowFaces
): value is { faces: readonly StackedFace[]; label?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !React.isValidElement(value) &&
    Array.isArray((value as { faces?: unknown }).faces)
  );
}

export type EventRowProps = Omit<React.ComponentProps<'div'>, 'title'> & {
  size?: EventRowSize;
  state?: EventRowState;
  /**
   * A private calendar rendered free/busy: the rail goes neutral and the ink
   * muted, because the hue and the glyph *are* the category and this row is not
   * allowed to have one. The caller passes `iconName="lock"` and a title of
   * "Bezet"; nothing else about the event is knowable.
   *
   * Orthogonal to `state` rather than a value of it: a private block that is
   * already over is redacted *and* past, and it still has to read as past —
   * which is exactly what a single enum could not express.
   */
  busy?: boolean;
  /** The rail's hue, e.g. `CATEGORY_CLASSES[category].solid`. Ignored when `busy`. */
  railClass?: string;
  /** The category glyph. Pass `lock` for a busy row. */
  iconName?: IconName;
  /** The glyph's tone, e.g. `CATEGORY_CLASSES[category].icon`. Ignored when `busy`. */
  iconClass?: string;
  /** Already formatted, e.g. `08:30` — or the all-day label. */
  startTime: React.ReactNode;
  /** Omit for an all-day row; the gutter then holds one line. */
  endTime?: React.ReactNode;
  title: React.ReactNode;
  /** The optional second line — a location, a note. Truncates like the title. */
  subtitle?: React.ReactNode;
  faces?: EventRowFaces;
  /**
   * The trailing token. Defaults to `NOW` in the `now` state and to nothing
   * otherwise; pass a translated string (`t('now.eyebrowLive')`) in the app.
   */
  statusLabel?: string;
};

export function EventRow({
  size = 'default',
  state = 'default',
  busy = false,
  railClass,
  iconName,
  iconClass,
  startTime,
  endTime,
  title,
  subtitle,
  faces,
  statusLabel,
  className,
  children,
  ...props
}: EventRowProps) {
  const spec = SIZES[size];
  const live = state === 'now';
  const status = statusLabel ?? (live ? 'NOW' : null);

  return (
    <div
      data-slot="event-row"
      data-state={state}
      data-busy={busy ? 'true' : undefined}
      data-size={size}
      className={cn(
        'flex items-center border-t border-line-subtle first:border-t-0',
        spec.row,
        live && 'rounded-xl bg-primary/7',
        state === 'past' && 'opacity-50',
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn('w-1 shrink-0 self-stretch rounded-4xl', busy ? 'bg-line' : railClass)}
      />

      <div className={cn('flex shrink-0 flex-col', spec.gutter)}>
        <span
          className={cn('font-semibold tabular-nums', spec.start, live && 'font-bold text-primary')}
        >
          {startTime}
        </span>
        {endTime == null ? null : (
          <span
            className={cn('tabular-nums', spec.end, live ? 'text-primary/70' : 'text-ink-muted')}
          >
            {endTime}
          </span>
        )}
      </div>

      {iconName ? (
        <Icon
          name={iconName}
          size={spec.icon}
          className={cn('shrink-0', busy ? 'text-ink-muted' : iconClass)}
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate',
            spec.title,
            live ? 'font-bold' : 'font-semibold',
            state === 'past' && 'line-through',
            busy && 'text-ink-muted'
          )}
        >
          {title}
        </p>
        {subtitle ? (
          <p className={cn('truncate text-ink-secondary', spec.subtitle)}>{subtitle}</p>
        ) : null}
        {children}
      </div>

      {isFaceStackProps(faces) ? (
        <FaceStack faces={faces.faces} label={faces.label} size={spec.face} />
      ) : (
        faces
      )}

      {status ? (
        <span className="shrink-0 rounded-4xl bg-primary px-2 py-0.5 text-overline text-primary-foreground uppercase">
          {status}
        </span>
      ) : null}
    </div>
  );
}
