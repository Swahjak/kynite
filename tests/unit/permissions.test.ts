import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES,
  can,
  canOwn,
  decide,
  grade,
  type Capability,
  type Grade,
  type Principal,
} from '@/modules/family/authorize';

const FAMILY = '11111111-1111-4111-8111-111111111111';
const OTHER_FAMILY = '22222222-2222-4222-8222-222222222222';
const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SIBLING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const owner: Principal = { kind: 'member', familyId: FAMILY, memberId: ME, role: 'owner' };
const adult: Principal = { kind: 'member', familyId: FAMILY, memberId: ME, role: 'adult' };
const child: Principal = { kind: 'member', familyId: FAMILY, memberId: ME, role: 'child' };
const contributor: Principal = {
  kind: 'share',
  familyId: FAMILY,
  role: 'contributor',
  scope: { memberIds: [ME] },
};
const viewer: Principal = {
  kind: 'share',
  familyId: FAMILY,
  role: 'viewer',
  scope: { memberIds: [ME] },
};
const device: Principal = { kind: 'device', familyId: FAMILY, deviceId: 'hub-1' };

const PRINCIPALS = { owner, adult, child, contributor, viewer, device } as const;
type ColumnName = keyof typeof PRINCIPALS;

/**
 * docs/architecture.md §7, transcribed independently of the implementation.
 * Column order: Owner · Adult · Child (hub) · Caregiver contributor ·
 * Caregiver viewer · Device (hub).
 */
const EXPECTED: Record<Capability, [Grade, Grade, Grade, Grade, Grade, Grade]> = {
  'calendar:view': ['allow', 'allow', 'allow', 'scoped', 'scoped', 'allow'],
  'calendar:view_private': ['allow', 'own', 'deny', 'deny', 'deny', 'busy-only'],
  'event:write': ['allow', 'allow', 'deny', 'deny', 'deny', 'deny'],
  'google:link': ['allow', 'own', 'deny', 'deny', 'deny', 'deny'],
  'member:manage': ['allow', 'deny', 'deny', 'deny', 'deny', 'deny'],
  'routine:write': ['allow', 'allow', 'deny', 'deny', 'deny', 'deny'],
  'completion:write': ['allow', 'allow', 'allow', 'scoped', 'deny', 'allow'],
  'stars:award': ['allow', 'allow', 'deny', 'deny', 'deny', 'deny'],
  'stars:remove': ['deny', 'deny', 'deny', 'deny', 'deny', 'deny'],
  'redemption:request': ['allow', 'allow', 'allow', 'deny', 'deny', 'allow'],
  'redemption:approve': ['allow', 'allow', 'deny', 'deny', 'deny', 'deny'],
  'reward:manage': ['allow', 'allow', 'deny', 'deny', 'deny', 'deny'],
  'device:manage': ['allow', 'allow', 'deny', 'deny', 'deny', 'deny'],
  'share:manage': ['allow', 'allow', 'deny', 'deny', 'deny', 'deny'],
  'timer:control': ['allow', 'allow', 'allow', 'scoped', 'deny', 'allow'],
};

const COLUMNS: ColumnName[] = ['owner', 'adult', 'child', 'contributor', 'viewer', 'device'];

describe('permission matrix (docs/architecture.md §7)', () => {
  it('covers every capability', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...CAPABILITIES].sort());
  });

  for (const capability of CAPABILITIES) {
    COLUMNS.forEach((column, index) => {
      it(`${capability} · ${column} → ${EXPECTED[capability][index]}`, () => {
        expect(grade(PRINCIPALS[column], capability)).toBe(EXPECTED[capability][index]);
      });
    });
  }

  it('gives an account-holding caregiver the contributor column', () => {
    const caregiver: Principal = {
      kind: 'member',
      familyId: FAMILY,
      memberId: ME,
      role: 'caregiver',
    };

    for (const capability of CAPABILITIES) {
      expect(grade(caregiver, capability)).toBe(grade(contributor, capability));
    }
  });
});

describe('the stars invariant', () => {
  it('lets no principal remove stars — not even the owner', () => {
    const everyone: Principal[] = [
      owner,
      adult,
      child,
      contributor,
      viewer,
      device,
      { kind: 'member', familyId: FAMILY, memberId: ME, role: 'caregiver' },
    ];

    for (const principal of everyone) {
      expect(grade(principal, 'stars:remove')).toBe('deny');
      expect(can(principal, 'stars:remove')).toBe(false);
      expect(can(principal, 'stars:remove', { familyId: FAMILY, memberId: ME })).toBe(false);
      expect(can(principal, 'stars:remove', { familyId: FAMILY, ownerMemberId: ME })).toBe(false);
    }
  });
});

describe('resource resolution', () => {
  it('never lets a principal reach another household', () => {
    for (const principal of Object.values(PRINCIPALS)) {
      expect(can(principal, 'calendar:view', { familyId: OTHER_FAMILY })).toBe(false);
    }
  });

  it('resolves "own": an adult sees their own private calendar only', () => {
    expect(can(adult, 'calendar:view_private', { familyId: FAMILY, ownerMemberId: ME })).toBe(true);
    expect(can(adult, 'calendar:view_private', { familyId: FAMILY, ownerMemberId: SIBLING })).toBe(
      false
    );
    expect(can(owner, 'calendar:view_private', { familyId: FAMILY, ownerMemberId: SIBLING })).toBe(
      true
    );
  });

  it('resolves "own" for Google account linking', () => {
    expect(can(adult, 'google:link', { familyId: FAMILY, ownerMemberId: ME })).toBe(true);
    expect(can(adult, 'google:link', { familyId: FAMILY, ownerMemberId: SIBLING })).toBe(false);
  });

  it('resolves "scoped" against the share link scope', () => {
    expect(can(contributor, 'completion:write', { familyId: FAMILY, memberId: ME })).toBe(true);
    expect(can(contributor, 'completion:write', { familyId: FAMILY, memberId: SIBLING })).toBe(
      false
    );
    expect(can(viewer, 'completion:write', { familyId: FAMILY, memberId: ME })).toBe(false);
  });

  it('treats an unset scope dimension as unrestricted within the family', () => {
    const unscoped: Principal = {
      kind: 'share',
      familyId: FAMILY,
      role: 'contributor',
      scope: {},
    };

    expect(can(unscoped, 'calendar:view', { familyId: FAMILY, memberId: SIBLING })).toBe(true);
    expect(can(unscoped, 'calendar:view', { familyId: OTHER_FAMILY, memberId: SIBLING })).toBe(
      false
    );
  });

  it('fails closed when a conditional grade has no resource to test', () => {
    expect(can(adult, 'calendar:view_private')).toBe(false);
    expect(can(contributor, 'completion:write')).toBe(false);
  });

  it('fails closed when a scoped principal is restricted to members but the resource carries no subject', () => {
    // A resource with an absent memberId is untestable, not unrestricted:
    // it must be denied, never treated as a free pass.
    expect(can(contributor, 'completion:write', { familyId: FAMILY })).toBe(false);
    expect(can(contributor, 'calendar:view', { familyId: FAMILY })).toBe(false);
    expect(can(contributor, 'completion:write', { familyId: FAMILY, memberId: null })).toBe(false);
  });

  it('fails closed when a scoped principal is restricted to calendars but the resource carries no calendarId — NB-2', () => {
    // The mirror of the memberIds case above, and of
    // `sharing/domain/scope.ts`'s `coversCalendar()`: a calendar-restricted
    // link denied a resource with no `calendarId` to test is untestable, not
    // unrestricted. A native (non-Google) event carries no calendarId at all,
    // so an open reading here would have let a calendar-scoped link see and
    // act on every native event in the family regardless of its restriction.
    const calendarScoped: Principal = {
      kind: 'share',
      familyId: FAMILY,
      role: 'contributor',
      scope: { calendarIds: ['cal-1'] },
    };

    expect(can(calendarScoped, 'calendar:view', { familyId: FAMILY, memberId: ME })).toBe(false);
    expect(
      can(calendarScoped, 'calendar:view', {
        familyId: FAMILY,
        memberId: ME,
        calendarId: null,
      })
    ).toBe(false);
    expect(
      can(calendarScoped, 'calendar:view', {
        familyId: FAMILY,
        memberId: ME,
        calendarId: 'cal-2',
      })
    ).toBe(false);
    expect(
      can(calendarScoped, 'calendar:view', {
        familyId: FAMILY,
        memberId: ME,
        calendarId: 'cal-1',
      })
    ).toBe(true);
  });

  it('reports "busy-only" for a hub device, and does not count it as a grant', () => {
    expect(decide(device, 'calendar:view_private', { familyId: FAMILY })).toBe('busy-only');
    expect(can(device, 'calendar:view_private', { familyId: FAMILY })).toBe(false);
  });

  it('keeps the kiosk device out of anything a parent must confirm', () => {
    expect(can(device, 'event:write', { familyId: FAMILY })).toBe(false);
    expect(can(device, 'redemption:approve', { familyId: FAMILY })).toBe(false);
    expect(can(device, 'member:manage', { familyId: FAMILY })).toBe(false);
    expect(can(device, 'completion:write', { familyId: FAMILY, memberId: SIBLING })).toBe(true);
  });

  it('reserves member management for the owner', () => {
    expect(can(owner, 'member:manage', { familyId: FAMILY })).toBe(true);
    expect(can(adult, 'member:manage', { familyId: FAMILY })).toBe(false);
    expect(can(child, 'member:manage', { familyId: FAMILY })).toBe(false);
  });
});

describe('canOwn', () => {
  // B2 (review fix): the Google settings page (src/app/[locale]/(app)/
  // settings/google/page.tsx) and GoogleReauthBanner both gate on
  // `canOwn(principal, 'google:link')` — this exercises that exact helper,
  // not just the underlying `can()` matrix above, so a regression in the
  // helper's own resource construction (not just the matrix cell) fails here.
  const caregiver: Principal = {
    kind: 'member',
    familyId: FAMILY,
    memberId: ME,
    role: 'caregiver',
  };
  const ownerOtherFamily: Principal = {
    kind: 'member',
    familyId: OTHER_FAMILY,
    memberId: ME,
    role: 'owner',
  };

  it('allows the owner to link Google', () => {
    expect(canOwn(owner, 'google:link')).toBe(true);
  });

  it('allows an adult to see/manage their own linked accounts', () => {
    expect(canOwn(adult, 'google:link')).toBe(true);
  });

  it('denies a child login', () => {
    expect(canOwn(child, 'google:link')).toBe(false);
  });

  it('denies an account-holding caregiver — the vulnerability B2 closes', () => {
    // Before the fix, the settings page and reauth banner read linked Google
    // accounts (emails, calendars) for *any* principal with a session,
    // including a caregiver login. This is the regression check.
    expect(canOwn(caregiver, 'google:link')).toBe(false);
  });

  it('denies a share-link principal (no session, but still a Principal shape)', () => {
    expect(canOwn(contributor, 'google:link')).toBe(false);
  });

  it('denies the kiosk device', () => {
    expect(canOwn(device, 'google:link')).toBe(false);
  });

  it('still allows an owner in a different family (family scoping is on the resource, not a hardcoded id)', () => {
    expect(canOwn(ownerOtherFamily, 'google:link')).toBe(true);
  });

  it('generalizes to the other "own"-graded capability, calendar:view_private', () => {
    expect(canOwn(adult, 'calendar:view_private')).toBe(true);
    expect(canOwn(child, 'calendar:view_private')).toBe(false);
  });
});
