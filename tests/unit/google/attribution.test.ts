import { describe, expect, it } from 'vitest';
import {
  attributeEvent,
  isStatusOnly,
  NO_ATTRIBUTION,
  STATUS_ONLY_EVENT_TYPES,
} from '@/modules/google/domain/mapping';
import { initialSyncEnabled } from '@/modules/google/domain/calendar-list';
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

/** The account's own calendar: the only one whose owner is a participant. */
const calendar = { ownerMemberId: PARENT, isPrimary: true };

/** A subscription or a colleague's shared diary on the same account. */
const subscription = { ownerMemberId: PARENT, isPrimary: false };

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
        { ownerMemberId: null, isPrimary: true },
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

  describe('non-primary calendars', () => {
    it('never falls back to the account owner — a subscription is nobody’s event', () => {
      // "Nederlandse feestdagen" is on the account, not on the parent's day.
      expect(
        attributeEvent(googleEvent({ summary: 'Koningsdag' }), subscription, directory)
      ).toEqual(NO_ATTRIBUTION);
    });

    it('still attributes a real match on a colleague’s shared calendar', () => {
      const attributed = attributeEvent(
        googleEvent({
          organizer: { email: 'other@example.test' },
          attendees: [{ email: 'other@example.test' }],
        }),
        subscription,
        directory
      );

      expect(attributed.ownerMemberId).toBe(OTHER_PARENT);
      // …and the account owner is *not* dragged in alongside them.
      expect(attributed.attendeeMemberIds).toEqual([OTHER_PARENT]);
    });
  });
});

describe('initialSyncEnabled', () => {
  it('switches on the primary calendar and anything Google says is selected', () => {
    expect(initialSyncEnabled({ id: 'a', primary: true })).toBe(true);
    expect(initialSyncEnabled({ id: 'b', selected: true })).toBe(true);
  });

  it('leaves everything else off — a work account is not fifteen wall calendars', () => {
    expect(initialSyncEnabled({ id: 'c' })).toBe(false);
    expect(initialSyncEnabled({ id: 'd', selected: false })).toBe(false);
    expect(initialSyncEnabled({ id: 'e', primary: false, selected: false })).toBe(false);
  });
});
