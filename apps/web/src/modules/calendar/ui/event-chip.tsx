'use client';

import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { CategoryDot, cn, FaceStack, Icon, MemberFace, type StackedFace } from '@kynite/ui';
// Type-only: `@/modules/family` is `server-only` (it re-exports its query
// module), so a value import here would pull the database driver into this
// client component's bundle. `person-columns.tsx` establishes the same
// pattern for the same reason.
import type { Member } from '@/modules/family';
import { titleOf } from '../domain/event-title';
import type { CalendarEvent } from '../queries';
import { CATEGORY_CLASSES, EVENT_TYPE_ICONS } from './tokens';

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
   * chip's fill. This restores the answer as a small face stack *trailing* the
   * title — the slot the recurrence glyph used to occupy, since the two would
   * otherwise compete for the same corner, so a chip that actually draws faces
   * drops that glyph (and one that does not — a redacted block, a chip below
   * the width gate — keeps it).
   *
   * It is the faces of everyone the event is for, not only its owner: a block
   * both children are on says so with two faces, which is what
   * `Kalender.dc.html`:108 draws and what `TodayTimeline` has always shown for
   * the same event. Surfaces that answer "whose" some other way — the agenda's
   * names, the day board's lists — leave this off and keep the recurrence cue.
   */
  showOwner?: boolean;
  /** The roster `showOwner` resolves `event.ownerMemberId` against. */
  members?: Member[];
  /**
   * It already finished. The calendar draws that the way the design sheet does
   * — `opacity:0.55` and a line through the title ("Kalender.dc.html":106 on
   * the tablet, :299 on the phone) — which is the same fact Vandaag's timeline
   * and the per-person columns have always shown and the calendar never did.
   *
   * Opacity on the whole chip rather than muted ink, unlike `DayAgendaRow`:
   * a grid block is a *shape in the day* before it is a line of text, and the
   * shape is what has to recede. The label inside it is already the quietest
   * type on the screen.
   */
  past?: boolean;
  /**
   * The `card` variant names who it is for after the time — "09:15 – 11:30 ·
   * Mila & Daan" ("Kalender.dc.html":337). Off by default: the day board's
   * lists already answer "whose" with a column, and saying it twice on one row
   * is noise. `members` is what it resolves against.
   */
  showPeople?: boolean;
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
  past = false,
  showPeople = false,
  className,
  style,
}: EventChipProps) {
  const t = useTranslations('calendar');
  const formatDateTime = useDateTimeFormat();
  const palette = CATEGORY_CLASSES[event.category];

  /**
   * **The privacy gate, and the only one.** A busy-only event exists because
   * the viewer's principal has `calendar:view_private` = `busy-only` (§7): it
   * may learn that a slot is occupied, never by whom or for what. So no
   * variant of this chip may render a member's name, their initials, their
   * avatar, or an accessible label naming them.
   *
   * It is resolved once, here, ahead of every derived value — `participants`,
   * `people`, `faces`, `ownerMember` and the "Iedereen" glyph all read from it
   * — rather than as a `!event.busyOnly` next to each shape that can name
   * somebody. Scattered, it was already incomplete: the `block` variant
   * guarded its face stack while `card` both printed the names into its meta
   * line and drew the owner's `MemberFace`, so the phone agenda and the mobile
   * month named one person on every redacted hour. A gate this high is one a
   * future variant cannot forget to ask.
   *
   * The server does not make it redundant. `../queries.ts` blanks the
   * title, the location and `attendeeMemberIds` for a redacted row, but
   * deliberately passes `ownerMemberId` through — `groupByMember` needs it to
   * put the block in the right member column on the wall tablet. The name
   * therefore *does* reach this component; this is where it stops.
   */
  const identifiable = !event.busyOnly;

  // The owner's face, when there is one to show and the surface asked for it.
  // No fallback to an attendee: the request is specifically "the owner's
  // face", and a household event's face is the group glyph below instead —
  // resolving an attendee here would draw a face for an event that has none
  // of its own attribution.
  const ownerMember =
    identifiable && showOwner && event.ownerMemberId
      ? (members?.find((member) => member.id === event.ownerMemberId) ?? null)
      : null;

  // A redacted event has no title to show — it is a shape in the day, which is
  // exactly what free/busy means (§7 `calendar:view_private` → `busy-only`) —
  // and a synced event with no summary carries a sentinel rather than a name.
  // Both, plus the empty-title case this used to miss, are decided once in
  // `domain/event-title.ts`; the labels are translated here, at the UI
  // boundary, rather than stored pre-translated.
  const title = titleOf(event, { untitled: t('untitled'), busy: t('busy') });

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
    'data-past': past || undefined,
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

  /**
   * Who the block is for: the owner *and* the attendees, resolved against the
   * roster in the family's own order rather than in the order they happened to
   * be attached to the event — the same rule `modules/today/ui/member-faces.tsx`
   * applies, so the two children always stack the same way on both screens.
   */
  const participantIds = new Set(event.attendeeMemberIds);
  if (event.ownerMemberId) participantIds.add(event.ownerMemberId);

  const participants = identifiable
    ? (members?.filter((member) => participantIds.has(member.id)) ?? [])
    : [];

  /**
   * "Iedereen" is a *different fact* from a list of every name, not a longer
   * one — an event on the household calendar, an event nobody is named on, and
   * an event everybody is named on all say it.
   */
  const forEveryone =
    identifiable &&
    !!members &&
    (event.householdWide ||
      participants.length === 0 ||
      participants.length >= (members.length || 1));

  /**
   * Nobody in particular — a household event, or one carrying no attribution
   * this roster can resolve. That is the case with no faces to draw, so it gets
   * the "Iedereen" glyph the member day grid's shared lane already uses.
   *
   * Distinct from `forEveryone`: an event that happens to name every member
   * *does* have faces, and drawing them is how `TodayTimeline` answers the same
   * question — only the label collapses to "Iedereen".
   *
   * Never on a redacted event: "Bezet, and it is the household's" is still a
   * fact about whose hour it is, and one that narrows the alternative — a
   * redacted hour that is *not* the household's belongs to somebody in
   * particular.
   */
  const unattributed =
    identifiable && !!members && (event.householdWide || participants.length === 0);

  /**
   * The same set as words, for the `card` variant's meta line and as the face
   * stack's accessible name.
   */
  const people =
    !identifiable || !members
      ? ''
      : forEveryone
        ? t('everyone')
        : participants.map((member) => member.displayName).join(' & ');

  /**
   * `CATEGORY_CLASSES`, not `MEMBER_COLOR_CLASSES`: the two tables are keyed by
   * the same hue names and this is a *client* component, so reaching for the
   * family slice's copy would pull `server-only` (and the database driver) into
   * the bundle. Same reason the owner face above resolves its surface here.
   */
  const faces: StackedFace[] = participants.map((member) => ({
    id: member.id,
    name: member.displayName,
    avatarUrl: member.avatarUrl,
    surfaceClass: CATEGORY_CLASSES[member.color].surface,
  }));

  /**
   * Whether this chip has a "whose" cue to draw at all — the group glyph or
   * the stack. Above the 6.5rem container gate it takes the trailing slot the
   * recurrence glyph would otherwise occupy; below it, neither is drawn and
   * the recurrence glyph keeps the slot.
   */
  const facesShown = showOwner && (unattributed || faces.length > 0);

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
          past && 'opacity-55',
          interactive && 'cursor-pointer hover:bg-surface-container-low',
          className
        )}
      >
        <CategoryDot size="xs" className={cn('shrink-0', palette.solid)} />
        <span className={cn('truncate text-caption text-ink', past && 'line-through')}>
          {title}
        </span>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        {...shellProps}
        className={cn(
          'flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl border border-line-subtle bg-card px-3 py-2.5 text-left',
          past && 'opacity-55',
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
            className={cn(
              'block truncate font-semibold text-ink',
              hub ? 'text-h3' : 'text-body-sm',
              past && 'line-through'
            )}
          >
            {title}
          </span>
          <span
            className={cn(
              'tabular-time block truncate text-ink-secondary',
              hub ? 'text-body' : 'text-caption'
            )}
          >
            {timeRange}
            {showPeople && people ? ` · ${people}` : ''}
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
        {/* Both of these read through `identifiable` — the group glyph
            directly, the face because `ownerMember` is already null on a
            redacted event. See the gate's note above. */}
        {showOwner && identifiable && event.householdWide && (
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
        // The rail is 4px, the width `calendar.md` § "Event list item" states
        // and the width every other rail in this codebase is drawn at
        // (`member-day-grid`'s day rule, `StepRow`'s live accent). It read 3px
        // for a while because `Kalender.dc.html` draws the grid block at
        // `border-left:3px` — a single mockup export against a documented
        // scale, and the only 3px border anywhere in the product. One pixel is
        // not worth a fourth border width.
        // `rounded-md` (8px) and no shadow: the sheet draws every grid block
        // at `border-radius:8px` with nothing under it ("Kalender.dc.html":106
        // and following). The 12px of `rounded-lg` plus a resting shadow made
        // a 44px block read as a floating card rather than as a slice of the
        // hour it occupies. `py-1` for the same reason — the sheet fits a
        // title *and* a time inside 44px, which 6px of vertical padding does
        // not (gap 25).
        'group/chip @container/chip relative flex min-w-0 flex-col justify-start gap-0.5 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left',
        palette.surface,
        palette.rule,
        past && 'opacity-55',
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
        {/* The leading glyph, on a grid block too.

            It used to be suppressed on `block` on the argument that the sheet's
            blocks "carry a title and a time and nothing else". They do not:
            `Kalender.dc.html`:108–115 draws every day *and* week block as
            `[14px glyph] [title] [16px face]` over the time line, and the
            suppression was the reason `/calendar?view=day` was the one surface
            in the product that never said what kind of thing an event was
            while `/today`'s timeline said it for the very same row.

            A redacted block gets `lock` rather than nothing — the same glyph
            `TodayTimeline` gives it. "This hour is spoken for and you may not
            know what by" is a fact worth a symbol; an unlabelled hatch made the
            viewer work it out from the texture. */}
        <Icon
          name={event.busyOnly ? 'lock' : EVENT_TYPE_ICONS[event.eventType]}
          size={hub ? 'sm' : 'xs'}
          className={cn('shrink-0', event.busyOnly ? 'text-ink-secondary' : palette.text)}
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate font-display font-semibold',
            past && 'line-through',
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
        {/* A chip already busy answering "whose" has no room left to also flag
            "repeats", so the two trade places — but the trade is settled by
            whether faces are *actually drawn*, not by whether the surface
            offered to draw them.

            `showOwner` is only the offer. A busy-only block never draws a face
            (the privacy gate), and neither does any chip narrower than the
            6.5rem container gate the stack itself is behind — so keying the
            glyph off the prop took the recurrence cue away from chips that got
            nothing in exchange. The swap now happens at that same gate, in CSS,
            because the width it turns on is a fact only the browser has. */}
        {event.recurring && !event.pendingSync && (
          <Icon
            name="repeat"
            size="xs"
            label={t('recurring')}
            className={cn(
              'ml-auto shrink-0 opacity-60',
              facesShown && '@min-[6.5rem]/chip:hidden',
              palette.text
            )}
          />
        )}

        {/* Whose it is — trailing, which is where both the sheet
            (`Kalender.dc.html`:108) and `EventRow` put it, and the opposite
            corner from the glyph that says *what* it is.

            Never on a busy-only block. Identity is exactly as much of a detail
            as the title on a calendar the viewer may only read as free/busy:
            "Bezet, and it is Mila's" narrows a redacted hour to one person, so
            the hatch keeps the hour and drops the name.

            Gated on the chip's own rendered width (`@container/chip` above),
            not the viewport: a week column is a week column whether the glass
            is a phone or a wall tablet, and below ~104px the faces would take
            the room the title needs. Height is no longer the constraint it was
            — the stack is the design system's 16px `2xs`, the same height as
            the 14px glyph beside it, so a block carrying faces is exactly as
            tall as one without. */}
        {showOwner && unattributed && (
          <span className="hidden shrink-0 @min-[6.5rem]/chip:inline-flex">
            <Icon
              name="group"
              size={hub ? 'sm' : 'xs'}
              label={t('everyone')}
              className={palette.text}
            />
          </span>
        )}
        {showOwner && !unattributed && faces.length > 0 && (
          <FaceStack
            faces={faces}
            size={hub ? 'xs' : '2xs'}
            label={people}
            className="hidden shrink-0 @min-[6.5rem]/chip:flex"
          />
        )}
      </div>

      {showTime && !event.allDay && (
        <span
          className={cn(
            // A week column is ~150px wide whatever the glass is, and the
            // sheet's week block is a *title only* at 11px
            // ("Kalender.dc.html":179–204) — the hour is already readable off
            // the gutter the block is aligned to. Below 10rem of chip the time
            // line is what makes the title truncate, so it is what goes.
            variant === 'block' && 'hidden @min-[10rem]/chip:block',
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
