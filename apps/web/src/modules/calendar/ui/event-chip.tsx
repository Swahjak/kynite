'use client';

import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { CategoryDot, cn, Icon, MemberFace } from '@kynite/ui';
// Type-only: `@/modules/family` is `server-only` (it re-exports its query
// module), so a value import here would pull the database driver into this
// client component's bundle. `person-columns.tsx` establishes the same
// pattern for the same reason.
import type { Member } from '@/modules/family';
import type { CalendarEvent } from '../queries';
import { CATEGORY_CLASSES, EVENT_TYPE_ICONS } from './tokens';

/**
 * Mirrors `UNTITLED` in `modules/google/domain/mapping.ts` — not imported
 * from there, deliberately: that slice is the Google sync integration, and
 * this calendar-UI component has no business depending on it for anything
 * but a string constant. Both sides are covered by
 * `tests/unit/i18n/hardcoded-strings.test.ts`-adjacent unit coverage on the
 * mapping module, so a drift between the two literals fails loudly.
 */
const UNTITLED_SENTINEL = '(no title)';

/**
 * Free/busy is a **texture, not a colour** (`Kalender.dc.html`; the argument is
 * spelled out in `stories/pages/kalender.stories.tsx`): every hue in the
 * category palette already means "this kind of thing", so none of them is free
 * to mean "you may not know what this is". A 45° hatch says it without
 * borrowing a meaning.
 *
 * Both stops are design tokens, not literals — the rule in `docs/design` is
 * that no colour is written outside `packages/ui/src/styles/tokens.css`, and a
 * gradient is no exception.
 */
const BUSY_HATCH =
  'repeating-linear-gradient(45deg, var(--color-surface-container-low) 0 6px, var(--color-line-subtle) 6px 12px)';

/**
 * One event, as it appears in every view. The chip is the single place that
 * decides how an event *reads*, so a busy-only block, a pending-sync pip and a
 * recurring instance look the same in the day grid as in the agenda list.
 */

export type EventChipProps = {
  event: CalendarEvent;
  /**
   * `block` fills a time-grid slot; `row` is a list line; `dot` is a month pip;
   * `card` is the phone's agenda line — a white card with a rounded colour bar
   * rather than a tinted fill (`Kalender.dc.html`, mobile week and mobile
   * month). The card exists because a list of tinted chips at 390px reads as a
   * stack of coloured blocks with no edges; the design gives the phone a card
   * with a real border and moves the hue into a 4px rail.
   */
  variant?: 'block' | 'row' | 'dot' | 'card' | 'line';
  /** Hub surfaces render at 6-foot legibility. */
  hub?: boolean;
  showTime?: boolean;
  onSelect?: (event: CalendarEvent) => void;
  /** Drag start, for the time-grid blocks that can be rescheduled. */
  onPointerDown?: (pointerEvent: React.PointerEvent<HTMLElement>, event: CalendarEvent) => void;
  /**
   * Asked once per click, before `onSelect`. A pointer gesture that actually
   * moved still ends in a synthetic `click`, and opening the editor from it
   * would seed the dialog with the *pre-drag* times — saving would then quietly
   * undo the reschedule the user just performed. The drag hook owns the
   * "did this move?" fact, so it answers this rather than the chip guessing.
   */
  suppressClick?: () => boolean;
  /** The block starts before the rendered grid window — draw the clip cue. */
  continuesBefore?: boolean;
  /** The block ends after the rendered grid window. */
  continuesAfter?: boolean;
  /**
   * Week and month grids lost their "whose is this" cue when M23 made the
   * chip's color and icon a pure function of event *type* — a family member's
   * color is now identity-only, carried by their avatar rather than the
   * chip's fill. This restores the answer as a small face top-left, in the
   * slot the recurrence glyph used to occupy: the two would otherwise
   * compete for the same corner, so a chip carrying a face drops the glyph.
   * Other surfaces (agenda, the day board, the member day grid) already
   * answer "whose" some other way — a name, a column — so they leave this
   * off and keep the recurrence cue.
   */
  showOwner?: boolean;
  /** The roster `showOwner` resolves `event.ownerMemberId` against. */
  members?: Member[];
  className?: string;
  style?: React.CSSProperties;
};

export function EventChip({
  event,
  variant = 'row',
  hub = false,
  showTime = true,
  onSelect,
  onPointerDown,
  suppressClick,
  continuesBefore = false,
  continuesAfter = false,
  showOwner = false,
  members,
  className,
  style,
}: EventChipProps) {
  const t = useTranslations('calendar');
  const formatDateTime = useDateTimeFormat();
  const palette = CATEGORY_CLASSES[event.category];

  // The owner's face, when there is one to show and the surface asked for it.
  // No fallback to an attendee: the request is specifically "the owner's
  // face", and a household event's face is the group glyph below instead —
  // resolving an attendee here would draw a face for an event that has none
  // of its own attribution.
  const ownerMember =
    showOwner && event.ownerMemberId
      ? (members?.find((member) => member.id === event.ownerMemberId) ?? null)
      : null;

  // A redacted event has no title to show — it is a shape in the day, which is
  // exactly what free/busy means (§7 `calendar:view_private` → `busy-only`).
  //
  // A synced Google event with no summary persists the `UNTITLED` sentinel
  // (`modules/google/domain/mapping.ts`) into `event.title` — deliberately:
  // the row needs *a* string, and re-deriving "was this untitled?" from an
  // empty string at read time would be one more place to get it wrong. The
  // sentinel is translated here, at the UI boundary, the same way `busy-only`
  // is — not stored pre-translated, which would hardcode English into the
  // database for every locale a family ever opens the event in.
  const title = event.busyOnly
    ? t('busy')
    : event.title === UNTITLED_SENTINEL
      ? t('untitled')
      : event.title;

  if (variant === 'dot') {
    return (
      // `calendar.md` § "Month view / date picker": "a `4px × 4px` dot at
      // `border-radius:9999px;background:oklch(58% 0.14 H)`" — a round pip in
      // the day's category hue, not a bar. It was `h-1.5 w-full`, which drew a
      // stretched lozenge; the size now comes from the shared `CategoryDot`
      // (`size-1` = the documented 4px) and the hue from the same solid token
      // the event card's rule uses.
      <CategoryDot
        data-slot="event-dot"
        data-category={event.category}
        aria-hidden={undefined}
        title={title}
        size="xs"
        className={cn(palette.solid, className)}
      />
    );
  }

  const interactive = onSelect !== undefined && event.editable;

  /**
   * Everything that makes a chip a chip *except* how it looks — the data
   * attributes every view and every test select on, and the click/drag
   * contract. Hoisted out of the JSX so the `card` shape below can be a
   * genuinely different tree without re-stating (or drifting from) the
   * post-drag click guard.
   */
  const shellProps = {
    'data-slot': 'event-chip',
    'data-category': event.category,
    'data-busy-only': event.busyOnly || undefined,
    'data-pending-sync': event.pendingSync || undefined,
    'data-recurring': event.recurring || undefined,
    'data-event-id': event.seriesId,
    'data-occurrence-start': event.startsAt.toISOString(),
    'data-continues-before': continuesBefore || undefined,
    'data-continues-after': continuesAfter || undefined,
    role: interactive ? ('button' as const) : undefined,
    tabIndex: interactive ? 0 : undefined,
    onClick: interactive
      ? () => {
          if (suppressClick?.()) return;
          onSelect(event);
        }
      : undefined,
    onPointerDown: onPointerDown
      ? (pointerEvent: React.PointerEvent<HTMLElement>) => onPointerDown(pointerEvent, event)
      : undefined,
    onKeyDown: interactive
      ? (keyboardEvent: React.KeyboardEvent<HTMLElement>) => {
          if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
            keyboardEvent.preventDefault();
            onSelect(event);
          }
        }
      : undefined,
    style: event.busyOnly ? { ...style, backgroundImage: BUSY_HATCH } : style,
  };

  const timeRange = event.allDay
    ? t('allDay')
    : `${formatDateTime(event.startsAt, { hour: '2-digit', minute: '2-digit' })} – ${formatDateTime(
        event.endsAt,
        { hour: '2-digit', minute: '2-digit' }
      )}`;

  if (variant === 'line') {
    /**
     * The month cell's line: a 4px pip in the category hue and the title, on
     * the cell's own ground. A month cell is ~120px wide and 24px tall per
     * row; a tinted chip with a rail and its own padding fits two words there,
     * where a dot and plain text fit four — and the hue survives either way,
     * which is what makes a month scannable without reading it.
     */
    return (
      <div
        {...shellProps}
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-sm',
          interactive && 'cursor-pointer hover:bg-surface-container-low',
          className
        )}
      >
        <CategoryDot size="xs" className={cn('shrink-0', palette.solid)} />
        <span className="truncate text-caption text-ink">{title}</span>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        {...shellProps}
        className={cn(
          'flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl border border-line-subtle bg-card px-3 py-2.5 text-left',
          // The wall board reads from across the kitchen, so the card grows
          // rather than the type shrinking to fit it.
          hub && 'min-h-16 gap-4 rounded-2xl px-5 py-4',
          interactive &&
            'cursor-pointer transition-all duration-200 ease-brand hover:shadow-md active:scale-95',
          className
        )}
      >
        {/* The hue moved out of the fill and into a rail: a white card with a
            real border is what separates two agenda lines at 390px, and a
            tinted card cannot also carry a visible edge. */}
        <span
          aria-hidden
          className={cn(
            'shrink-0 self-stretch rounded-full',
            hub ? 'w-1.5' : 'w-1',
            event.busyOnly ? 'bg-line' : palette.solid
          )}
        />
        <div className="min-w-0 flex-1">
          <span
            className={`block truncate font-semibold text-ink ${hub ? 'text-h3' : 'text-body-sm'}`}
          >
            {title}
          </span>
          <span
            className={`tabular-time block truncate text-ink-secondary ${hub ? 'text-body' : 'text-caption'}`}
          >
            {timeRange}
            {event.location ? ` · ${event.location}` : ''}
          </span>
        </div>
        {event.pendingSync && (
          <span
            data-testid="pending-sync-pip"
            title={t('pendingSync')}
            aria-label={t('pendingSync')}
            role="img"
            className="size-1.5 shrink-0 rounded-full bg-warning"
          />
        )}
        {showOwner && event.householdWide && (
          <Icon
            name="group"
            size={hub ? 'md' : 'sm'}
            label={t('everyone')}
            className="shrink-0 text-ink-muted"
          />
        )}
        {showOwner && !event.householdWide && ownerMember && (
          <MemberFace
            name={ownerMember.displayName}
            avatarUrl={ownerMember.avatarUrl}
            surfaceClass={CATEGORY_CLASSES[ownerMember.color].surface}
            size={hub ? 'default' : 'xs'}
            className="shrink-0"
          />
        )}
      </div>
    );
  }

  return (
    <div
      {...shellProps}
      className={cn(
        // The design system's event card: a `oklch(94% 0.025 H)` tint carrying
        // a 4px left rule in the category's *solid* hue (`calendar.md` §
        // "Event list item": "Category color bar: `width:4px;…;background:
        // oklch(58% 0.14 H)`"). The rule used to take `palette.border`, which
        // is the pale `oklch(85% 0.05 H)` **chip outline** — a tenth of the
        // contrast the bar is drawn at in the spec.
        // `@container/chip`: the owner glyph below queries this, not the
        // viewport — a week-view column and a month cell are narrow for
        // reasons that have nothing to do with the device (seven days is
        // seven days), so the space it has to work with is the chip's own
        // rendered width, not a breakpoint.
        // 3px, not 4: `Kalender.dc.html` draws every grid block's rail at
        // `border-left:3px solid oklch(58% 0.14 H)`. The 4px figure in
        // `calendar.md` is the *list* item's bar, which this component no
        // longer draws — the phone's list is the `card` variant above.
        'group/chip @container/chip relative flex min-w-0 flex-col justify-start gap-0.5 overflow-hidden rounded-lg border-l-3 px-2 py-1.5 text-left shadow-sm',
        palette.surface,
        palette.rule,
        variant === 'block' && 'absolute inset-x-1 select-none',
        hub ? 'gap-1 px-3 py-2' : '',
        interactive &&
          'cursor-pointer transition-all duration-200 ease-brand hover:-translate-y-px hover:shadow-md',
        // The press convention (`components.md`: every interactive shape is
        // pressed, not just hovered). Not on a `block`, whose `transform` is
        // owned by the drag hook — a `scale` class there would be overwritten
        // mid-gesture by the inline `translateX`, i.e. visibly flicker.
        interactive && variant !== 'block' && 'active:scale-95',
        // Free/busy blocks are deliberately quieter than the events you can
        // actually read — they are context, not information. The recede is on
        // the *fill and border*, not the whole chip: `opacity-70` on the
        // container took the "Bezet" label's text down with it, the same
        // contrast hazard the past-event treatment in `person-columns.tsx`
        // was fixed for in M17 — draining the category tint to a neutral
        // surface reads as "just context" just as well and leaves the label
        // legible. The dashed border stays; it is the shape cue, not the
        // contrast problem.
        // …and the hatch replaces the category rule entirely rather than
        // sitting next to it: a left rail in a hue would still be saying
        // "this kind of thing" about a block whose kind is precisely what is
        // withheld. The fill comes from `BUSY_HATCH` above, on `style`.
        event.busyOnly && 'border-l-0 bg-transparent shadow-none',
        className
      )}
    >
      {/* Clip cues: the grid renders `GRID_START_HOUR`–`GRID_END_HOUR`, so a
          block reaching outside that window is drawn against the edge. Without
          a mark it would read as starting at 06:00 / ending at 23:00, which is
          a different fact from the one in the database. */}
      {continuesBefore && (
        <Icon
          name="arrow_upward"
          size="xs"
          label={t('continuesBefore')}
          className={cn('absolute top-0.5 right-0.5 opacity-70', palette.text)}
        />
      )}
      {continuesAfter && (
        <Icon
          name="arrow_downward"
          size="xs"
          label={t('continuesAfter')}
          className={cn('absolute right-0.5 bottom-0.5 opacity-70', palette.text)}
        />
      )}

      <div className="flex min-w-0 items-center gap-1">
        {/* Owner face (M24): top-left, ahead of the type glyph. Identity is
            not the thing a busy-only block redacts — the content is — so this
            renders even when the type icon below it is suppressed. A
            household event gets the same "Iedereen" glyph the member day
            grid's shared column already uses, rather than a stack of every
            member's face, which the design system has no precedent for.

            Gated on the chip's own rendered width (`@container/chip` above),
            not the viewport: a week view is seven columns wide regardless of
            whether the glass is a phone or a wall tablet, and a chip that
            narrow has no room left for a title once a 24px face and its gap
            are added on top of the type icon — the row would rather drop the
            face than silently collapse the title to zero width. `hidden` by
            default is the same "no glyph, full room for the title" shape the
            chip drew before this feature existed. */}
        {showOwner && event.householdWide && (
          <span className="hidden shrink-0 @min-[6.5rem]/chip:inline-flex">
            <Icon
              name="group"
              size={hub ? 'sm' : 'xs'}
              label={t('everyone')}
              className={palette.text}
            />
          </span>
        )}
        {showOwner && !event.householdWide && ownerMember && (
          <span className="hidden shrink-0 @min-[6.5rem]/chip:inline-flex">
            <MemberFace
              name={ownerMember.displayName}
              avatarUrl={ownerMember.avatarUrl}
              surfaceClass={CATEGORY_CLASSES[ownerMember.color].surface}
              size={hub ? 'sm' : 'xs'}
            />
          </span>
        )}
        {!event.busyOnly && (
          <Icon
            name={EVENT_TYPE_ICONS[event.eventType]}
            size={hub ? 'sm' : 'xs'}
            className={cn('shrink-0', palette.text)}
          />
        )}
        <span
          className={cn(
            'truncate font-display font-semibold',
            // A hatched block carries no hue, so its label takes the neutral
            // secondary ink rather than a category foreground it no longer
            // has a fill to sit on.
            event.busyOnly ? 'text-ink-secondary' : palette.text,
            hub ? 'text-body-lg' : 'text-caption'
          )}
        >
          {title}
        </span>

        {/* Non-blocking sync pip (§5): the edit landed locally, Google has not
            caught up yet. Never a modal, never an error — a dot. */}
        {event.pendingSync && (
          <span
            data-testid="pending-sync-pip"
            title={t('pendingSync')}
            aria-label={t('pendingSync')}
            role="img"
            className="ml-auto size-1.5 shrink-0 rounded-full bg-warning"
          />
        )}
        {/* Week and month chips trade this for the owner face: a chip
            already busy answering "whose" does not have room left to also
            flag "repeats" without crowding the row. Other surfaces keep it. */}
        {event.recurring && !event.pendingSync && !showOwner && (
          <Icon
            name="repeat"
            size="xs"
            label={t('recurring')}
            className={cn('ml-auto shrink-0 opacity-60', palette.text)}
          />
        )}
      </div>

      {showTime && !event.allDay && (
        <span
          className={cn(
            // No `opacity-*` on coloured text: an 80% blend of
            // `--cat-blue-fg` over its own tint lands at 4.13:1, which is a
            // WCAG AA failure the M17 axe sweep caught the moment `cn()`
            // stopped silently dropping `palette.text` (see `lib/utils.ts`).
            // The chip is already visually secondary through size and tint.
            'tabular-time truncate',
            event.busyOnly ? 'text-ink-secondary' : palette.text,
            hub ? 'text-body' : 'text-caption'
          )}
        >
          {timeRange}
        </span>
      )}

      {event.location && variant !== 'block' && (
        <span className={cn('flex min-w-0 items-center gap-1 text-caption', palette.text)}>
          <Icon name="location_on" size="xs" className="shrink-0" />
          <span className="truncate">{event.location}</span>
        </span>
      )}
    </div>
  );
}
