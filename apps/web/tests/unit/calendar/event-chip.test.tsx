import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormattingLocaleProvider } from '@/components/formatting';
import { EventChip } from '@/modules/calendar/ui/event-chip';
import type { CalendarEvent } from '@/modules/calendar/queries';
import type { Member } from '@/modules/family';
import calendarMessages from '../../../messages/en.json';
import dutchMessages from '../../../messages/nl.json';

/**
 * BLOCKING 2 coverage: `EventChip` formats through `useDateTimeFormat()`,
 * which has no zone of its own — it reads whatever `NextIntlClientProvider`'s
 * `timeZone` was given (the household's convention and the timezone are two
 * separate, next-intl-independent-vs-native props now — see
 * `FormattingLocaleProvider`'s doc comment for why formatting locale can't
 * live on `NextIntlClientProvider`'s own `locale`). `(app)/layout.tsx` and
 * `(hub)/layout.tsx` resolve the zone from the family row and pass it down
 * explicitly, instead of letting the *server's* zone (this test runner's
 * container, effectively UTC) leak into what a family reads as the event's
 * wall time.
 *
 * The regression this guards against: a family in a zone other than the
 * server's — proven here with `America/New_York`, which is never the CI
 * container's zone — must see the *New York* wall clock on the chip, not
 * whatever the process's local zone happens to render.
 */

function baseEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    key: 'series-1',
    seriesId: 'series-1',
    title: 'Tandarts',
    description: null,
    location: null,
    startsAt: new Date('2026-01-15T02:30:00.000Z'),
    endsAt: new Date('2026-01-15T03:00:00.000Z'),
    allDay: false,
    tz: 'America/New_York',
    ownerMemberId: null,
    attendeeMemberIds: [],
    eventType: 'school',
    category: 'blue',
    calendarId: null,
    calendarSummary: null,
    isRecurringInstance: false,
    recurring: false,
    rrule: null,
    pendingSync: false,
    busyOnly: false,
    editable: true,
    householdWide: false,
    ...overrides,
  };
}

describe('EventChip — timezone-aware formatting (BLOCKING 2)', () => {
  it('renders the wall time of the family zone the provider is given, not the server zone', () => {
    const event = baseEvent();
    const zone = 'America/New_York';

    // `en-GB`, not bare `en`: `EventChip` formats through the household's
    // convention (`FormattingLocaleProvider`), and `en-GB` is what an English
    // household gets by default — bare `en` has no convention of its own and
    // is exactly the ambiguity this split exists to remove.
    const expectedStart = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zone,
    }).format(event.startsAt);
    const expectedEnd = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zone,
    }).format(event.endsAt);

    // Sanity: the New York wall time actually differs from a naive
    // UTC/Amsterdam read of the same instant, so this test would fail if the
    // zone prop were silently ignored.
    const utcStart = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(event.startsAt);
    expect(expectedStart).not.toBe(utcStart);

    render(
      <NextIntlClientProvider
        locale="en"
        timeZone={zone}
        messages={{ calendar: calendarMessages.calendar }}
      >
        <FormattingLocaleProvider formattingLocale="en-GB">
          <EventChip event={event} />
        </FormattingLocaleProvider>
      </NextIntlClientProvider>
    );

    const chip = screen.getByText('Tandarts').closest('[data-slot="event-chip"]');
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toContain(expectedStart);
    expect(chip!.textContent).toContain(expectedEnd);
  });
});

/**
 * The chip used to compare against a locally re-declared `(no title)` literal
 * and had no emptiness check at all; it now asks `titleOf` (`domain/
 * event-title.ts`), which is the one place the three ways an event can reach a
 * surface without a usable name are decided. Dutch, because `calendar.untitled`
 * in English is itself the string "(no title)" — the assertion would pass in
 * English whether or not the sentinel was translated.
 */
describe('EventChip — what an event is called', () => {
  const renderDutch = (event: CalendarEvent) =>
    render(
      <NextIntlClientProvider
        locale="nl"
        timeZone="Europe/Amsterdam"
        messages={{ calendar: dutchMessages.calendar }}
      >
        <FormattingLocaleProvider formattingLocale="nl-NL">
          <EventChip event={event} />
        </FormattingLocaleProvider>
      </NextIntlClientProvider>
    );

  it('translates the sentinel a nameless synced event carries', () => {
    renderDutch(baseEvent({ title: '(no title)' }));
    expect(screen.getByText('(zonder titel)')).toBeTruthy();
  });

  it('names a whitespace-only title untitled rather than drawing a blank chip', () => {
    renderDutch(baseEvent({ title: '   ' }));
    expect(screen.getByText('(zonder titel)')).toBeTruthy();
  });

  it('leaves a real title that merely contains the sentinel alone', () => {
    renderDutch(baseEvent({ title: 'Vergadering (no title) bespreken' }));
    expect(screen.getByText('Vergadering (no title) bespreken')).toBeTruthy();
  });

  it('shows the busy label instead of a redacted event’s stored title', () => {
    renderDutch(baseEvent({ title: 'Therapie', busyOnly: true }));
    expect(screen.getByText('Bezet')).toBeTruthy();
    expect(screen.queryByText('Therapie')).toBeNull();
  });
});

/**
 * A grid block used to be the one shape in the product that said *neither*
 * what kind of thing it is nor whose it is: the chip suppressed both the type
 * glyph and the face on `variant="block"`, so `/calendar?view=day` drew a
 * coloured rectangle with a title where `/today`'s timeline drew a tinted
 * glyph and a stack of faces for the very same event.
 *
 * `docs/design/claude-design/Kalender.dc.html`:108–115 draws the block with
 * both — a 14px category glyph, the title, and a 16px face (or a `groups`
 * chip) trailing — and it fits, because the sheet's avatar is 16px rather than
 * the 24px the suppression was argued from.
 *
 * The one row that stays redacted is the free/busy one: a lock, "Bezet", and
 * nobody's face.
 */
describe('EventChip — what a time-grid block says about an event', () => {
  const members: Member[] = [
    { id: 'm1', displayName: 'Mila', color: 'purple', avatarUrl: null } as unknown as Member,
    { id: 'm2', displayName: 'Daan', color: 'green', avatarUrl: null } as unknown as Member,
    { id: 'm3', displayName: 'Tom', color: 'blue', avatarUrl: null } as unknown as Member,
  ];

  const renderBlock = (event: CalendarEvent) =>
    render(
      <NextIntlClientProvider
        locale="nl"
        timeZone="Europe/Amsterdam"
        messages={{ calendar: dutchMessages.calendar }}
      >
        <FormattingLocaleProvider formattingLocale="nl-NL">
          <EventChip event={event} variant="block" showOwner members={members} />
        </FormattingLocaleProvider>
      </NextIntlClientProvider>
    );

  const chipOf = () => document.querySelector('[data-slot="event-chip"]')!;

  it('draws the event-type glyph, the same one the Vandaag timeline draws', () => {
    renderBlock(baseEvent({ eventType: 'school' }));

    expect(chipOf().querySelector('[data-icon-name="school"]')).not.toBeNull();
  });

  it('draws the faces of everyone the block is for, not just its owner', () => {
    renderBlock(baseEvent({ ownerMemberId: 'm1', attendeeMemberIds: ['m2'] }));

    const faces = chipOf().querySelector('[data-slot="member-faces"]');
    expect(faces).not.toBeNull();
    expect(faces!.getAttribute('aria-label')).toBe('Mila & Daan');
    // Two faces, in the family's own order — not a third for the parent who
    // is not on this event.
    expect(faces!.querySelectorAll('[data-slot="avatar"]')).toHaveLength(2);
  });

  it('says "Iedereen" once, with a glyph, for a household-wide block', () => {
    renderBlock(baseEvent({ householdWide: true }));

    expect(chipOf().querySelector('[data-icon-name="group"]')).not.toBeNull();
    expect(chipOf().querySelector('[data-slot="member-faces"]')).toBeNull();
  });

  it('keeps a busy-only block to a lock — no type glyph, no title, no faces', () => {
    renderBlock(
      baseEvent({
        title: 'Therapie',
        eventType: 'school',
        busyOnly: true,
        ownerMemberId: 'm1',
        attendeeMemberIds: ['m2'],
      })
    );

    expect(chipOf().querySelector('[data-icon-name="lock"]')).not.toBeNull();
    expect(chipOf().querySelector('[data-icon-name="school"]')).toBeNull();
    expect(chipOf().querySelector('[data-slot="member-faces"]')).toBeNull();
    expect(screen.queryByText('Therapie')).toBeNull();
    expect(screen.getByText('Bezet')).toBeTruthy();
  });
});

/**
 * §7 `calendar:view_private` → `busy-only`. A device principal (the wall
 * tablet) may learn that an hour is *occupied*; it may not learn by whom. The
 * chip is the last gate on that, and it has to hold on **every** variant —
 * `queries.ts` blanks the title, the location and `attendeeMemberIds` for a
 * redacted row but still passes `ownerMemberId` through, because the day view
 * needs it to put the block in the right member column.
 *
 * The old assertion here (`[data-slot="member-faces"]` is null) proved the
 * *vehicle* was absent, not the identity: the `card` variant leaked the same
 * fact through two other shapes — the names joined into its meta line, and a
 * lone `MemberFace` for the owner, whose `title` attribute and initials
 * fallback both spell the person out. So these assert on the rendered HTML:
 * no name, no initials, no avatar, no accessible label naming anyone.
 */
describe('EventChip — a busy-only event never names anyone', () => {
  const members: Member[] = [
    { id: 'm1', displayName: 'Mila', color: 'purple', avatarUrl: null } as unknown as Member,
    { id: 'm2', displayName: 'Daan', color: 'green', avatarUrl: null } as unknown as Member,
    { id: 'm3', displayName: 'Tom', color: 'blue', avatarUrl: null } as unknown as Member,
  ];

  // Initials are `displayName.slice(0, 2).toUpperCase()` (`MemberFace`), so
  // these are the exact strings an avatar fallback would render.
  const identifying = ['Mila', 'Daan', 'Tom', 'MI', 'DA', 'TO'];

  /**
   * The three variants that have an audience to leak. `dot` and `line` are
   * deliberately **not** in the loop: neither draws a "whose is this" shape at
   * all — `dot` returns a bare `CategoryDot` before any of the participant
   * derivation runs, and `line` renders only a pip and the title — so asserting
   * on them proved nothing and made this read as five-fold coverage when it is
   * three-fold. If either ever grows a face, a name or an owner glyph, put it
   * back here.
   */
  const variants = ['card', 'row', 'block'] as const;

  const renderBusy = (variant: (typeof variants)[number]) =>
    render(
      <NextIntlClientProvider
        locale="nl"
        timeZone="Europe/Amsterdam"
        messages={{ calendar: dutchMessages.calendar }}
      >
        <FormattingLocaleProvider formattingLocale="nl-NL">
          <EventChip
            event={baseEvent({
              title: 'Therapie',
              busyOnly: true,
              ownerMemberId: 'm1',
              attendeeMemberIds: ['m2'],
            })}
            variant={variant}
            showOwner
            showPeople
            members={members}
          />
        </FormattingLocaleProvider>
      </NextIntlClientProvider>
    );

  for (const variant of variants) {
    it(`renders no name, initials or face on variant="${variant}"`, () => {
      const { container } = renderBusy(variant);
      const html = container.innerHTML;

      for (const fragment of identifying) {
        expect(html).not.toContain(fragment);
      }
      expect(container.querySelector('[data-slot="avatar"]')).toBeNull();
      expect(container.querySelector('[data-slot="member-faces"]')).toBeNull();
      expect(screen.queryByText('Therapie')).toBeNull();
    });
  }

  it('says nothing about who a redacted household event belongs to either', () => {
    const { container } = render(
      <NextIntlClientProvider
        locale="nl"
        timeZone="Europe/Amsterdam"
        messages={{ calendar: dutchMessages.calendar }}
      >
        <FormattingLocaleProvider formattingLocale="nl-NL">
          <EventChip
            event={baseEvent({ busyOnly: true, householdWide: true })}
            variant="card"
            showOwner
            showPeople
            members={members}
          />
        </FormattingLocaleProvider>
      </NextIntlClientProvider>
    );

    // Not even "Iedereen": whether a redacted hour is the household's or one
    // person's is itself part of what free/busy withholds.
    expect(container.innerHTML).not.toContain('Iedereen');
    expect(container.querySelector('[data-icon-name="group"]')).toBeNull();
  });
});

/**
 * The all-day band (`time-grid.tsx`) renders `variant="row"` with `showOwner`,
 * and `row` is the default variant — it falls through the same tree the grid
 * block does. Which cue it draws is therefore a decision, not a side effect.
 *
 * `Kalender.dc.html`:164 draws the band's chip as
 * `[14px beach_access] [Zomerkamp Daan] [16px face]` — the type glyph leading,
 * the face *trailing* at 16px — i.e. the same shape as the timed block on
 * :180. So the trailing stack is what the sheet asks for, and the older
 * leading 24px single owner face is not.
 */
describe('EventChip — the all-day band’s "whose" cue', () => {
  const members: Member[] = [
    { id: 'm1', displayName: 'Mila', color: 'purple', avatarUrl: null } as unknown as Member,
    { id: 'm2', displayName: 'Daan', color: 'green', avatarUrl: null } as unknown as Member,
    { id: 'm3', displayName: 'Tom', color: 'blue', avatarUrl: null } as unknown as Member,
  ];

  it('draws the type glyph first and the face stack last, as the sheet does', () => {
    const { container } = render(
      <NextIntlClientProvider
        locale="nl"
        timeZone="Europe/Amsterdam"
        messages={{ calendar: dutchMessages.calendar }}
      >
        <FormattingLocaleProvider formattingLocale="nl-NL">
          <EventChip
            event={baseEvent({
              title: 'Zomerkamp Daan',
              allDay: true,
              eventType: 'other',
              ownerMemberId: 'm2',
            })}
            variant="row"
            showTime={false}
            showOwner
            members={members}
          />
        </FormattingLocaleProvider>
      </NextIntlClientProvider>
    );

    const stack = container.querySelector('[data-slot="member-faces"]');
    expect(stack).not.toBeNull();
    expect(stack!.getAttribute('aria-label')).toBe('Daan');

    // Trailing, not leading: the title sits between the glyph and the faces.
    const row = container.querySelector('[data-slot="event-chip"] > div')!;
    const title = screen.getByText('Zomerkamp Daan');
    expect(row.contains(stack)).toBe(true);
    expect(title.compareDocumentPosition(stack!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

/**
 * The recurrence glyph and the faces were made mutually exclusive by keying the
 * glyph off the `showOwner` *prop*. But `showOwner` only says the surface is
 * willing to draw faces, not that any were drawn: a busy-only block never draws
 * them (above), and below the 6.5rem container gate neither does anything else.
 * On both, the chip lost its "repeats" cue and gained nothing in exchange.
 */
describe('EventChip — the recurrence cue', () => {
  const members: Member[] = [
    { id: 'm1', displayName: 'Mila', color: 'purple', avatarUrl: null } as unknown as Member,
  ];

  const renderChip = (
    event: CalendarEvent,
    props: Partial<React.ComponentProps<typeof EventChip>>
  ) =>
    render(
      <NextIntlClientProvider
        locale="nl"
        timeZone="Europe/Amsterdam"
        messages={{ calendar: dutchMessages.calendar }}
      >
        <FormattingLocaleProvider formattingLocale="nl-NL">
          <EventChip event={event} variant="block" {...props} />
        </FormattingLocaleProvider>
      </NextIntlClientProvider>
    );

  it('keeps the repeat glyph on a busy-only block, which never draws faces', () => {
    const { container } = renderChip(
      baseEvent({ busyOnly: true, recurring: true, ownerMemberId: 'm1' }),
      { showOwner: true, members }
    );

    expect(container.querySelector('[data-icon-name="repeat"]')).not.toBeNull();
  });

  it('keeps the repeat glyph when the surface offers faces but there is no roster', () => {
    const { container } = renderChip(baseEvent({ recurring: true, ownerMemberId: 'm1' }), {
      showOwner: true,
    });

    expect(container.querySelector('[data-icon-name="repeat"]')).not.toBeNull();
  });

  it('still renders the glyph when faces do draw, hidden only above the face gate', () => {
    const { container } = renderChip(baseEvent({ recurring: true, ownerMemberId: 'm1' }), {
      showOwner: true,
      members,
    });

    const repeat = container.querySelector('[data-icon-name="repeat"]');
    expect(repeat).not.toBeNull();
    // The two cues swap at the same container width the faces appear at, so
    // the narrow chip keeps "repeats" and the wide one shows who it is for.
    expect(repeat!.className).toContain('@min-[6.5rem]/chip:hidden');
  });
});
