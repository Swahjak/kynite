import { describe, expect, it } from 'vitest';
import {
  attributeEvent,
  isStatusOnly,
  NO_ATTRIBUTION,
  STATUS_ONLY_EVENT_TYPES,
} from '@/modules/google/domain/mapping';
import { initialSyncEnabled, isStorableCalendar } from '@/modules/google/domain/calendar-list';
import type { MemberDirectory } from '@/modules/google/domain/types';
import { googleEvent } from './support/fixtures';

/**
 * M18, the pure half of three fixes:
 *
 *  - Google's status entries (`workingLocation`/`focusTime`/`outOfOffice`) are
 *    not appointments and must never reach the wall board.
 *  - Attendees are matched to family members by email, case-insensitively,
 *    with unmatched addresses ignored.
 *  - A newly discovered calendar starts synced only if Google itself says the
 *    person looks at it.
 */

const PARENT = '11111111-1111-4111-8111-111111111111';
const OTHER_PARENT = '22222222-2222-4222-8222-222222222222';

const directory: MemberDirectory = {
  memberIdFor(email) {
    const table: Record<string, string> = {
      'parent@example.test': PARENT,
      'other@example.test': OTHER_PARENT,
    };
    return table[email.toLowerCase()] ?? null;
  },
};

/** One of the parent's own calendars — primary or a secondary they created. */
const calendar = { ownerMemberId: PARENT };

/**
 * A subscription or a colleague's shared diary on the same account. M23 moved
 * the distinction upstream: discovery leaves `owner_member_id` null for a
 * calendar the account holder does not own, so "whose calendar is this" is a
 * value here rather than a rule in `attributeEvent`.
 */
const subscription = { ownerMemberId: null };

describe('isStatusOnly', () => {
  it('names exactly the three status types', () => {
    expect([...STATUS_ONLY_EVENT_TYPES].sort()).toEqual([
      'focusTime',
      'outOfOffice',
      'workingLocation',
    ]);
  });

  it('rejects a status entry and keeps everything else', () => {
    for (const eventType of STATUS_ONLY_EVENT_TYPES) {
      expect(isStatusOnly(googleEvent({ eventType }))).toBe(true);
    }

    expect(isStatusOnly(googleEvent({ eventType: 'default' }))).toBe(false);
    expect(isStatusOnly(googleEvent({ eventType: 'birthday' }))).toBe(false);
    // Google adds values to this enum without notice; an unknown one is an
    // ordinary event, never a silently dropped one.
    expect(isStatusOnly(googleEvent({ eventType: 'somethingNew' }))).toBe(false);
    // The overwhelming majority of resources carry no `eventType` at all.
    expect(isStatusOnly(googleEvent())).toBe(false);
  });
});

describe('attributeEvent', () => {
  it('matches an attendee by email, case-insensitively', () => {
    const attributed = attributeEvent(
      googleEvent({ attendees: [{ email: 'OTHER@Example.TEST' }] }),
      calendar,
      directory
    );

    expect(attributed.attendeeMemberIds).toContain(OTHER_PARENT);
  });

  it('ignores an attendee nobody in the family owns', () => {
    const attributed = attributeEvent(
      googleEvent({ attendees: [{ email: 'dentist@clinic.example' }] }),
      calendar,
      directory
    );

    // The dentist invents no member, and does not stop the calendar owner from
    // being attributed.
    expect(attributed.attendeeMemberIds).toEqual([PARENT]);
  });

  it('resolves multiple attendees, matched and unmatched together, without duplicates', () => {
    const attributed = attributeEvent(
      googleEvent({
        attendees: [
          { email: 'parent@example.test' },
          { email: 'other@example.test' },
          { email: 'colleague@work.example' },
          // A room is a resource, not a person, even with an address.
          { email: 'boardroom@work.example', resource: true },
        ],
      }),
      calendar,
      directory
    );

    expect(attributed.attendeeMemberIds.sort()).toEqual([PARENT, OTHER_PARENT].sort());
  });

  it('always includes the calendar owner, attendee list or not', () => {
    // This is the rule that makes the feature visible at all: most events on a
    // parent's personal calendar list no attendees whatsoever.
    expect(attributeEvent(googleEvent(), calendar, directory)).toEqual({
      ownerMemberId: PARENT,
      attendeeMemberIds: [PARENT],
    });
  });

  it('lets a matched organizer own the row, over the calendar owner', () => {
    const attributed = attributeEvent(
      googleEvent({ organizer: { email: 'other@example.test' } }),
      calendar,
      directory
    );

    expect(attributed.ownerMemberId).toBe(OTHER_PARENT);
    // …and the calendar's owner is still a participant of their own calendar.
    expect(attributed.attendeeMemberIds.sort()).toEqual([PARENT, OTHER_PARENT].sort());
  });

  it('falls back to the creator, then to the calendar owner', () => {
    expect(
      attributeEvent(googleEvent({ creator: { email: 'other@example.test' } }), calendar, directory)
        .ownerMemberId
    ).toBe(OTHER_PARENT);

    expect(
      attributeEvent(
        googleEvent({ organizer: { email: 'stranger@work.example' } }),
        calendar,
        directory
      ).ownerMemberId
    ).toBe(PARENT);
  });

  it('attributes nothing when the calendar has no owner and nobody matches', () => {
    expect(
      attributeEvent(
        googleEvent({ attendees: [{ email: 'stranger@work.example' }] }),
        { ownerMemberId: null },
        directory
      )
    ).toEqual(NO_ATTRIBUTION);
  });

  it('skips an attendee who declined', () => {
    const attributed = attributeEvent(
      googleEvent({
        attendees: [
          { email: 'other@example.test', responseStatus: 'declined' },
          { email: 'parent@example.test', responseStatus: 'accepted' },
        ],
      }),
      calendar,
      directory
    );

    // Somebody who said no is not going, so they are not in that day's column.
    expect(attributed.attendeeMemberIds).toEqual([PARENT]);
  });

  it('attributes a secondary calendar its member created, not just the primary one', () => {
    // The M23 report: an invited adult connected Google, and every event on
    // the "Werk" calendar she made herself rendered in the shared "Iedereen"
    // block. It is not `primary`, but it is hers, so discovery gives it an
    // owning member and every event on it is hers.
    const attributed = attributeEvent(
      googleEvent({ summary: 'Sprintreview' }),
      { ownerMemberId: OTHER_PARENT },
      directory
    );

    expect(attributed.ownerMemberId).toBe(OTHER_PARENT);
    expect(attributed.attendeeMemberIds).toEqual([OTHER_PARENT]);
  });

  describe('calendars with no owning member', () => {
    it('falls back to the account owner when nobody else matches', () => {
      // The ESS Shifts case: a shift roster the employer shares read-only.
      // The calendar is not `accessRole: 'owner'`, so discovery gives it no
      // owning member — but every event on it is still one person's day, and
      // that person is whoever linked the account it hangs off.
      const attributed = attributeEvent(
        googleEvent({ summary: 'Late dienst' }),
        { ownerMemberId: null, accountOwnerMemberId: PARENT },
        directory
      );

      expect(attributed).toEqual({
        ownerMemberId: PARENT,
        attendeeMemberIds: [PARENT],
      });
    });

    it('still lets a matched organizer own the row, over the account owner', () => {
      const attributed = attributeEvent(
        googleEvent({
          organizer: { email: 'other@example.test' },
          attendees: [{ email: 'other@example.test' }],
        }),
        { ownerMemberId: null, accountOwnerMemberId: PARENT },
        directory
      );

      expect(attributed.ownerMemberId).toBe(OTHER_PARENT);
      // The account owner is a fallback, not a participant of somebody
      // else's matched event.
      expect(attributed.attendeeMemberIds).toEqual([OTHER_PARENT]);
    });

    it('attributes nothing when there is no account owner either', () => {
      // A member deletion nulls both columns; nobody is still nobody.
      expect(
        attributeEvent(googleEvent({ summary: 'Koningsdag' }), subscription, directory)
      ).toEqual(NO_ATTRIBUTION);
    });
  });
});

describe('isStorableCalendar', () => {
  it('accepts the calendars the account holder created — primary and secondary alike', () => {
    expect(isStorableCalendar({ id: 'primary', primary: true, accessRole: 'owner' })).toBe(true);
    expect(isStorableCalendar({ id: 'werk', accessRole: 'owner' })).toBe(true);
  });

  it('accepts shared and subscribed calendars whose events we can read', () => {
    // The ESS Shifts case: an employer's shift roster shared read-only is
    // indistinguishable from any other `reader` calendar, so the machine
    // stores it and the parent decides in the picker. None of these start
    // synced — that is `initialSyncEnabled`'s job, and it is primary-only.
    expect(isStorableCalendar({ id: 'ess-shifts@company.example', accessRole: 'reader' })).toBe(
      true
    );
    expect(isStorableCalendar({ id: 'jeroen@toppy.nl', accessRole: 'writer' })).toBe(true);
    expect(isStorableCalendar({ id: 'holidays', accessRole: 'reader', selected: true })).toBe(true);
  });

  it('rejects what has no readable events to offer', () => {
    // Busy blocks only — there is nothing to sync.
    expect(isStorableCalendar({ id: 'room-3', accessRole: 'freeBusyReader' })).toBe(false);
    // A meeting room, even when its events are readable: rooms are not diaries.
    expect(
      isStorableCalendar({
        id: 'boardroom@resource.calendar.google.com',
        accessRole: 'reader',
      })
    ).toBe(false);
    // Google omitting the role is not a licence to store the calendar.
    expect(isStorableCalendar({ id: 'unknown' })).toBe(false);
  });

  it('rejects a deleted calendar even when it was ours', () => {
    expect(isStorableCalendar({ id: 'werk', accessRole: 'owner', deleted: true })).toBe(false);
  });
});

describe('initialSyncEnabled', () => {
  it('switches on the primary calendar and nothing else on a first link', () => {
    expect(initialSyncEnabled({ id: 'a', primary: true })).toBe(true);
    expect(initialSyncEnabled({ id: 'a', primary: true }, 'primary-only')).toBe(true);
  });

  it('ignores Google’s `selected` flag — a ticked holiday feed is not a family calendar', () => {
    expect(initialSyncEnabled({ id: 'b', selected: true })).toBe(false);
    expect(initialSyncEnabled({ id: 'c' })).toBe(false);
    expect(initialSyncEnabled({ id: 'd', selected: false })).toBe(false);
    expect(initialSyncEnabled({ id: 'e', primary: false, selected: false })).toBe(false);
  });

  it('switches on nothing at all on a relink, primary included', () => {
    // A calendar missing from our database on a relink is one the parent
    // *removed* (`removeCalendar` deletes the row), so re-discovering it must
    // not resurrect it — the picker offers it back, ticked off.
    expect(initialSyncEnabled({ id: 'a', primary: true }, 'none')).toBe(false);
    expect(initialSyncEnabled({ id: 'b', selected: true }, 'none')).toBe(false);
  });
});
