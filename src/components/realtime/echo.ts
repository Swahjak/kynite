import type { RealtimeEvent } from '@/modules/realtime';

/**
 * Echo suppression (docs/architecture.md §4: "The originating device ignores
 * echoes of its own `clientId`").
 *
 * The device that tapped has already shown the result — optimistically, before
 * the request even left. Applying the server's echo of that same write would,
 * at best, re-render something already on screen; at worst it would replace a
 * celebration mid-animation. So the tapping device drops its own events and
 * keeps everyone else's.
 *
 * Kept pure and separate from the provider so the rule is a function with a
 * truth table rather than a branch buried in an event handler.
 */

/**
 * How many of this device's own `clientId`s to remember.
 *
 * Bounded because the set only exists to catch an echo arriving within a
 * second or two of the write. A hub that runs for a month must not accumulate
 * a key per tap, and forgetting an old id is harmless: the write it belonged
 * to was reconciled long ago.
 */
export const OWN_CLIENT_ID_MEMORY = 200;

/** A bounded, insertion-ordered set of the ids this device originated. */
export class OwnClientIds {
  private readonly ids = new Set<string>();

  constructor(private readonly limit: number = OWN_CLIENT_ID_MEMORY) {}

  remember(clientId: string): void {
    // Re-inserting moves the id to the back, so a retried write does not age
    // out while it is still being retried.
    this.ids.delete(clientId);
    this.ids.add(clientId);

    while (this.ids.size > this.limit) {
      const oldest = this.ids.values().next();
      if (oldest.done) break;
      this.ids.delete(oldest.value);
    }
  }

  has(clientId: string): boolean {
    return this.ids.has(clientId);
  }

  get size(): number {
    return this.ids.size;
  }
}

/**
 * True when `event` is this device's own write coming back.
 *
 * An event with no `clientId` is never an echo — machine-originated writes
 * (Google sync, a job) have no originating tap to have already rendered.
 */
export function isOwnEcho(event: RealtimeEvent, own: Pick<OwnClientIds, 'has'>): boolean {
  const clientId = event.actor.clientId;
  return typeof clientId === 'string' && clientId.length > 0 && own.has(clientId);
}
