import { describe, expect, it } from 'vitest';
import { OwnClientIds, isOwnEcho } from '@/components/realtime/echo';
import type { RealtimeEvent } from '@/modules/realtime/schema';

/**
 * §4: "The originating device ignores echoes of its own `clientId`."
 *
 * The rule is small enough that the risk is not getting it wrong once — it is
 * getting it wrong in one direction. Dropping too much means a device stops
 * seeing the rest of the family; dropping too little means a celebration gets
 * re-applied under a child's hands.
 */

function eventFrom(actor: Partial<RealtimeEvent['actor']>): RealtimeEvent {
  return {
    v: 1,
    id: '1',
    familyId: 'f',
    type: 'completion.created',
    at: '2026-08-06T07:00:00.000Z',
    actor: { source: 'hub', ...actor },
    entity: { id: 'c1' },
  };
}

describe('echo suppression', () => {
  it('drops this device’s own write coming back', () => {
    const own = new OwnClientIds();
    own.remember('tap-a');

    expect(isOwnEcho(eventFrom({ clientId: 'tap-a' }), own)).toBe(true);
  });

  it('keeps another device’s write', () => {
    const own = new OwnClientIds();
    own.remember('tap-a');

    // The whole point of the stream: the phone's tap must reach the hub.
    expect(isOwnEcho(eventFrom({ clientId: 'tap-b' }), own)).toBe(false);
  });

  it('keeps machine-originated events, which have no clientId', () => {
    const own = new OwnClientIds();
    own.remember('tap-a');

    expect(isOwnEcho(eventFrom({ source: 'sync' }), own)).toBe(false);
    expect(isOwnEcho(eventFrom({ clientId: '', source: 'job' }), own)).toBe(false);
  });

  it('forgets the oldest ids rather than growing without bound', () => {
    const own = new OwnClientIds(3);
    for (const id of ['a', 'b', 'c', 'd']) own.remember(id);

    expect(own.size).toBe(3);
    // 'a' aged out; the write it belonged to was reconciled long ago.
    expect(isOwnEcho(eventFrom({ clientId: 'a' }), own)).toBe(false);
    expect(isOwnEcho(eventFrom({ clientId: 'd' }), own)).toBe(true);
  });

  it('keeps a retried write alive by re-remembering it', () => {
    const own = new OwnClientIds(2);
    own.remember('retry-me');
    own.remember('other');
    // The outbox retries `retry-me`; touching it must move it to the back
    // instead of leaving it next in line to be forgotten.
    own.remember('retry-me');
    own.remember('newest');

    expect(isOwnEcho(eventFrom({ clientId: 'retry-me' }), own)).toBe(true);
    expect(isOwnEcho(eventFrom({ clientId: 'other' }), own)).toBe(false);
  });
});
