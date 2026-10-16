import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@/modules/family';

/**
 * One header, two surfaces.
 *
 * `5dc38ee` unified the wall hub and the phone's `/today` on the principle that
 * "the hub is the app with restricted permissions, not a second product", and
 * `0fbacbb` promptly re-forked the top of the page into `TodayHeader` and a
 * `TodayHubHeader` beside it. The festive treatment (M26) then landed on the
 * phone half only — which is the whole reason a fork is expensive: nobody
 * *decided* the wall should stay quiet on Pakjesavond, it simply was not there
 * to change.
 *
 * So the tests below pin the three things the merge has to be true of:
 *
 *  1. the festive chip, the countdown and the confetti render on **both**
 *     surfaces (the drift being repaired);
 *  2. the *personal* chrome — the signed-in member's face — is driven by the
 *     `viewer` prop rather than resolved inside the header, and the page
 *     resolves a member to greet only for a member principal (a paired device
 *     has nobody signed in, §7);
 *  3. the one route renders the one header, so the fork cannot quietly come
 *     back.
 */

// A zone whose calendar day differs from the family's (Amsterdam) at the anchor
// used below, so a label formatted in the device zone is the wrong day.
process.env.TZ = 'Pacific/Kiritimati';

vi.mock('server-only', () => ({}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock('@/modules/family', async () => {
  const { MEMBER_COLOR_CLASSES } = await vi.importActual<
    typeof import('@/modules/family/ui/tokens')
  >('@/modules/family/ui/tokens');

  return {
    MEMBER_COLOR_CLASSES,
    getHouseholdFormattingLocale: async () => 'nl-NL',
    MemberAvatar: ({ displayName }: { displayName: string }) => (
      <span data-testid="today-viewer-face">{displayName}</span>
    ),
  };
});

// The clock ticks on a timer and the confetti reaches for `canvas-confetti`;
// both are covered by their own tests. What matters here is only that the
// header mounts them.
vi.mock('@/modules/today/ui/today-clock', () => ({
  TodayClock: () => <span data-testid="today-clock" />,
}));

vi.mock('@/modules/today/ui/holiday-confetti', () => ({
  HolidayConfetti: ({ dayKey }: { dayKey: string }) => (
    <span data-testid="holiday-confetti" data-day={dayKey} />
  ),
}));

const { TodayHeader } = await import('@/modules/today/ui/today-header');

const TZ = 'Europe/Amsterdam';

function member(displayName: string): Member {
  return {
    id: 'm1',
    familyId: 'family-1',
    displayName,
    role: 'parent',
    color: 'blue',
    avatarUrl: null,
    sortOrder: 0,
    birthday: null,
    starBalance: 0,
  } as unknown as Member;
}

async function renderHeader({
  surface,
  dayKey,
  greeting = 'Goedemorgen',
  viewer = null,
  members = [],
  isToday = true,
  anchorIso,
}: {
  surface: 'app' | 'hub';
  dayKey: string;
  greeting?: string;
  viewer?: Member | null;
  members?: Member[];
  isToday?: boolean;
  anchorIso?: string;
}) {
  const anchor = new Date(anchorIso ?? `${dayKey}T09:00:00.000Z`);

  const result = render(
    await TodayHeader({
      surface,
      greeting,
      anchor,
      now: anchor,
      timeZone: TZ,
      dayKey,
      isToday,
      href: '/today',
      viewer,
      members,
    })
  );

  // What came back has to actually *be* the surface that was asked for — the
  // kiosk band is `PageHeader surface="hub"`, which stamps the marker below.
  // Without this, a component that ignored the prop would satisfy every
  // assertion in this file by drawing the phone twice.
  const marker = result.container.querySelector('[data-surface-variant="hub"]');
  if (surface === 'hub') expect(marker).not.toBeNull();
  else expect(marker).toBeNull();

  return result;
}

// Pakjesavond: a special day, and one of the three that earns confetti.
const SINTERKLAAS = '2026-12-05';
// Three nights before it — the "nog 3 nachtjes slapen" chip, no confetti.
const THREE_NIGHTS_BEFORE = '2026-12-02';

describe('TodayHeader — the festive treatment reaches both surfaces', () => {
  it.each(['app', 'hub'] as const)('draws the special-day chip on %s', async (surface) => {
    const { container } = await renderHeader({ surface, dayKey: SINTERKLAAS });

    const chip = container.querySelector('[data-testid="today-special-day"]');
    expect(chip).not.toBeNull();
    expect(chip!.getAttribute('data-slug')).toBe('sinterklaas');
  });

  it.each(['app', 'hub'] as const)('fires the confetti on %s', async (surface) => {
    const { container } = await renderHeader({ surface, dayKey: SINTERKLAAS });

    const confetti = container.querySelector('[data-testid="holiday-confetti"]');
    expect(confetti).not.toBeNull();
    expect(confetti!.getAttribute('data-day')).toBe(SINTERKLAAS);
  });

  it.each(['app', 'hub'] as const)('draws the countdown chip on %s', async (surface) => {
    const { container } = await renderHeader({ surface, dayKey: THREE_NIGHTS_BEFORE });

    const countdown = container.querySelector('[data-testid="today-countdown"]');
    expect(countdown).not.toBeNull();
    expect(countdown!.getAttribute('data-slug')).toBe('sinterklaas');
    expect(container.querySelector('[data-testid="holiday-confetti"]')).toBeNull();
  });

  it.each(['app', 'hub'] as const)('stays quiet on an ordinary day on %s', async (surface) => {
    const { container } = await renderHeader({ surface, dayKey: '2026-08-15' });

    expect(container.querySelector('[data-testid="today-festive"]')).toBeNull();
    expect(container.querySelector('[data-testid="holiday-confetti"]')).toBeNull();
  });
});

describe('TodayHeader — the date pill is the family’s day', () => {
  it('labels a non-today anchor in the family zone, not the device zone', async () => {
    // 11:00 UTC on 5 Dec: noon in Amsterdam (Saturday 5th), 01:00 on the 6th in
    // Kiritimati (the pinned process zone).
    const { container } = await renderHeader({
      surface: 'app',
      dayKey: SINTERKLAAS,
      anchorIso: '2026-12-05T11:00:00.000Z',
      isToday: false,
    });

    const text = container.textContent ?? '';
    expect(text).toMatch(/za\.?,? 5 dec/);
    expect(text).not.toMatch(/zo\.?,? 6 dec/);
  });
});

describe('TodayHeader — what stays surface-shaped', () => {
  it('greets the signed-in member and shows their face on the phone', async () => {
    const { container } = await renderHeader({
      surface: 'app',
      dayKey: '2026-08-15',
      greeting: 'Goedemorgen, Sanne',
      viewer: member('Sanne'),
    });

    expect(container.querySelector('[data-testid="today-greeting"]')!.textContent).toBe(
      'Goedemorgen, Sanne'
    );
    expect(container.querySelector('[data-testid="today-viewer-face"]')).not.toBeNull();
  });

  it('greets the household on the hub, with no personal face', async () => {
    const { container } = await renderHeader({
      surface: 'hub',
      dayKey: '2026-08-15',
      greeting: 'Goedemorgen',
      // Even when a member is handed in, the wall draws no personal chrome:
      // the face row there is the *household's* (`members`), not a viewer's.
      viewer: member('Sanne'),
      members: [member('Sanne')],
    });

    expect(container.querySelector('[data-testid="today-greeting"]')!.textContent).toBe(
      'Goedemorgen'
    );
    expect(container.querySelector('[data-testid="today-viewer-face"]')).toBeNull();
  });

  it('keeps the hub’s display-scale heading and the phone’s own', async () => {
    const hub = await renderHeader({ surface: 'hub', dayKey: '2026-08-15' });
    const phone = await renderHeader({ surface: 'app', dayKey: '2026-08-15' });

    expect(hub.container.querySelector('h1')!.className).toContain('text-display-md');
    expect(phone.container.querySelector('h1')!.className).toContain('text-h2');
  });
});

describe('the one today route renders the one header', () => {
  // Vitest runs with `apps/web` as its working directory.
  const read = (relative: string) => readFileSync(resolve('src', relative), 'utf8');

  // H3 merged the wall and phone route files into one page (`(main)/today`).
  const page = read('app/[locale]/(main)/today/page.tsx');

  it('renders <TodayHeader> with the surface as a prop', () => {
    expect(page).toContain('<TodayHeader');
    // One header for both surfaces: the surface is passed in, not hard-coded.
    expect(page).toContain('surface={surface}');
  });

  it('has no second header component to drift against', () => {
    expect(page).not.toContain('TodayHubHeader');
    expect(read('modules/today/index.ts')).not.toContain('TodayHubHeader');
  });

  it('resolves a member to greet only for a member principal', () => {
    // §7: a wall tablet is physically unauthenticated. The greeting is personal
    // for a member principal only — on any surface, a laptop included — so the
    // member resolution is gated on the principal's kind, never the surface: a
    // device must not go looking for a member.
    expect(page).toMatch(/principal\?\.kind\s*===\s*'member'/);
    expect(page).not.toMatch(/surface\s*===\s*'app'\s*\?\s*await\s+getPrincipal\(\)/);
    expect(page).toContain('getMember');
    expect(page).toContain('firstNameOf');
  });
});
