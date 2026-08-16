import { NextIntlClientProvider } from 'next-intl';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@/modules/calendar/queries';
import type { Member } from '@/modules/family';
import nlMessages from '../../../messages/nl.json';

/**
 * §7 `calendar:view_private` → `busy-only`, on the NU strip.
 *
 * The strip redacted its *title* (it prints "Bezet") and then named the owner
 * right beside it: `participantsOf` resolved `ownerMemberId` — which survives
 * redaction in `queries.ts` because it is the block's only routing signal — and
 * the strip drew that as a `MemberFaces` stack and handed the joined names to
 * `NowStripMeter`, which prints them as text in front of the countdown. Both
 * the live path (through the meter) and the browsed-future path (the strip's
 * own line) did it.
 *
 * Assertions are on identity, not on a component: no display name, no avatar
 * initials, no avatar, and no "Iedereen" either — whether the hidden hour is
 * the household's or one person's is itself withheld.
 */

vi.mock('server-only', () => ({}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  Link: ({ children }: { children?: React.ReactNode }) => children,
  redirect: vi.fn(),
  usePathname: () => '/',
}));

vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl');
  const messages = (await import('../../../messages/nl.json')).default;

  return {
    getTranslations: async (namespace: string) =>
      createTranslator({ locale: 'nl', messages, namespace }),
  };
});

vi.mock('@/modules/family', () => ({
  getHouseholdFormattingLocale: async () => 'nl-NL',
  MEMBER_COLOR_CLASSES: new Proxy(
    {},
    {
      get: () => ({
        surface: 'bg-test-surface',
        text: 'text-test',
        icon: 'text-test-icon',
        solid: 'bg-test-solid',
      }),
    }
  ),
}));

const { TodayNowStrip } = await import('@/modules/today/ui/today-now-strip');

const TZ = 'Europe/Amsterdam';
const NOW = new Date('2026-03-10T09:30:00.000Z');

function member(id: string, displayName: string, sortOrder: number): Member {
  return {
    id,
    familyId: 'family-1',
    displayName,
    role: 'child',
    color: 'blue',
    avatarUrl: null,
    sortOrder,
    birthday: null,
    starBalance: 0,
  } as unknown as Member;
}

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    key: 'e1',
    seriesId: 'e1',
    // What `queries.ts` leaves on a redacted row: no title at all.
    title: '',
    description: null,
    location: null,
    startsAt: new Date('2026-03-10T09:00:00.000Z'),
    endsAt: new Date('2026-03-10T10:00:00.000Z'),
    allDay: false,
    tz: TZ,
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
    busyOnly: true,
    editable: false,
    householdWide: false,
    ...overrides,
  } as CalendarEvent;
}

const members = [member('m1', 'Mila', 0), member('m2', 'Daan', 1)];

// Initials are `displayName.trim().slice(0, 2).toUpperCase()` (`MemberFace`).
const identifying = ['Mila', 'Daan', 'MI', 'DA', 'Iedereen'];

async function renderStrip(
  calendarEvent: CalendarEvent,
  mode: 'live' | 'next' | 'preview'
): Promise<HTMLElement> {
  const { container } = render(
    <NextIntlClientProvider
      locale="nl"
      timeZone={TZ}
      messages={{ today: nlMessages.today, calendar: nlMessages.calendar }}
    >
      {await TodayNowStrip({ event: calendarEvent, mode, members, now: NOW, timeZone: TZ })}
    </NextIntlClientProvider>
  );

  const strip = container.querySelector<HTMLElement>('[data-testid="today-now"]');
  expect(strip).not.toBeNull();
  return strip!;
}

function expectAnonymous(strip: HTMLElement) {
  const html = strip.outerHTML;
  for (const fragment of identifying) {
    expect(html).not.toContain(fragment);
  }
  expect(strip.querySelector('[data-slot="avatar"]')).toBeNull();
  expect(strip.querySelector('[data-slot="member-faces"]')).toBeNull();
  expect(html).toContain('Bezet');
}

describe('TodayNowStrip — a busy-only block never names anyone', () => {
  for (const mode of ['live', 'next', 'preview'] as const) {
    it(`draws no name, initials or face for an owned redacted block (mode="${mode}")`, async () => {
      expectAnonymous(await renderStrip(event({ ownerMemberId: 'm1' }), mode));
    });
  }

  it('draws no name, initials or face when the redacted block names several people', async () => {
    expectAnonymous(
      await renderStrip(event({ ownerMemberId: 'm1', attendeeMemberIds: ['m2'] }), 'live')
    );
  });

  it('says nothing about a redacted household block either', async () => {
    expectAnonymous(await renderStrip(event({ householdWide: true, ownerMemberId: 'm1' }), 'live'));
  });

  it('still names people on a block that is not redacted', async () => {
    const strip = await renderStrip(
      event({ busyOnly: false, title: 'Tandarts', ownerMemberId: 'm1' }),
      'live'
    );

    expect(strip.outerHTML).toContain('Mila');
    expect(strip.querySelector('[data-slot="member-faces"]')).not.toBeNull();
  });
});
