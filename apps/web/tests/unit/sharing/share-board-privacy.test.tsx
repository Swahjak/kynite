import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ShareDay, ShareEvent, ShareMember } from '@/modules/sharing/view/load';

/**
 * §7 `calendar:view_private` → `busy-only`, on the *share* board.
 *
 * The three sibling leaks fixed before this one were in-household surfaces: a
 * wall tablet that already knows who lives there learning which of them a
 * hidden hour belongs to. This one is worse in kind — a share link is handed to
 * a babysitter, a grandparent, an ex-partner's household. `ShareDayRow` redacted
 * the title (`titleOf` → "Bezet") and gated the location on `busyOnly`, and then
 * printed `memberIds` as joined display names with no gate at all. `queries.ts`
 * blanks a redacted row's attendees but passes `ownerMemberId` through — it is
 * the row's only surviving routing signal — so `toShareEvent` handed the owner
 * straight to that line, and the link said whose the hidden hour was.
 *
 * Assertions are on identity in the rendered HTML, not on a component having
 * mounted: no display name, no initials, no avatar, and no "Iedereen" fallback
 * either — whether the hidden hour is one person's or the whole household's is
 * itself a fact about the household.
 */

vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl');
  const messages = (await import('../../../messages/nl.json')).default;

  return {
    getTranslations: async (namespace: string) =>
      createTranslator({ locale: 'nl', messages, namespace }),
  };
});

const { ShareDayRow } = await import('@/modules/sharing/view/share-board');

const TZ = 'Europe/Amsterdam';

const members: ShareMember[] = [
  { id: 'm1', displayName: 'Mila', avatarUrl: null, color: 'blue' },
  { id: 'm2', displayName: 'Daan', avatarUrl: null, color: 'green' },
];

// Initials are `displayName.trim().slice(0, 2).toUpperCase()` (`MemberFace`).
const identifying = ['Mila', 'Daan', 'MI', 'DA', 'Iedereen'];

function event(overrides: Partial<ShareEvent> = {}): ShareEvent {
  return {
    key: 'e1',
    // A redacted row carries the calendar slice's busy sentinel, which
    // `titleOf` replaces with `t('busy')`; its value is irrelevant here.
    title: '',
    startsAt: Date.parse('2026-03-10T09:00:00.000Z'),
    endsAt: Date.parse('2026-03-10T10:00:00.000Z'),
    allDay: false,
    location: null,
    memberIds: [],
    busyOnly: true,
    ...overrides,
  } as ShareEvent;
}

async function renderDay(events: ShareEvent[]): Promise<HTMLElement[]> {
  const day: ShareDay = { dateKey: '2026-03-10', events };

  const { container } = render(
    await ShareDayRow({ day, members, timeZone: TZ, formattingLocale: 'nl-NL' })
  );

  const rows = [...container.querySelectorAll<HTMLElement>('[data-testid="share-event"]')];
  expect(rows.length).toBe(events.length);
  return rows;
}

function expectAnonymous(rows: HTMLElement[]) {
  for (const row of rows) {
    const html = row.outerHTML;
    for (const fragment of identifying) {
      expect(html).not.toContain(fragment);
    }
    expect(row.querySelector('[data-slot="avatar"]')).toBeNull();
    expect(row.querySelector('[data-slot="member-faces"]')).toBeNull();
    expect(html).toContain('Bezet');
  }
}

describe('ShareDayRow — a busy-only event never names anyone', () => {
  it('names nobody on a redacted event the link’s own member owns', async () => {
    expectAnonymous(await renderDay([event({ memberIds: ['m1'] })]));
  });

  it('names nobody on a redacted event with several participants', async () => {
    expectAnonymous(await renderDay([event({ memberIds: ['m1', 'm2'] })]));
  });

  it('does not fall back to "Iedereen" for a redacted household-wide event', async () => {
    expectAnonymous(await renderDay([event({ memberIds: [] })]));
  });

  // The shape `toShareEvent` actually ships for a redacted event: the audience
  // withheld at the derivation, so it is absent from the RSC payload too.
  it('renders nothing for an event whose audience the loader withheld', async () => {
    expectAnonymous(await renderDay([event({ memberIds: null })]));
  });

  it('still names the people on an event that is not redacted', async () => {
    const [row] = await renderDay([
      event({ busyOnly: false, title: 'Tandarts', memberIds: ['m1', 'm2'] }),
    ]);

    expect(row.outerHTML).toContain('Mila');
    expect(row.outerHTML).toContain('Daan');
  });
});
