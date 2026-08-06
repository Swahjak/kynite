/**
 * Non-vacuity fixture for `tests/unit/realtime/event-coverage.test.ts`.
 *
 * The coverage scan is only worth anything if it can be shown to *find* things.
 * This file contains one publish call, one emitter emission and one helper call, in the
 * shapes the repository actually uses, plus two decoys that must **not** be
 * counted: a `type` property that is not a realtime event, and a realtime type
 * appearing as a filter rather than as a publication.
 *
 * Not compiled by the app (`tests/fixtures` is lint-ignored); it exists to be
 * read as text by the scanner.
 */

declare function publish(input: unknown): Promise<void>;
declare function emit(emission: unknown): Promise<void>;
declare function publishEvent(type: string, ids: string[]): Promise<void>;

export async function publishesACompletion(): Promise<void> {
  await publish({
    familyId: 'f',
    type: 'completion.created',
    entity: { id: 'c' },
    actor: { source: 'hub' },
  });
}

export async function emitsASyncStatus(): Promise<void> {
  await emit({ type: 'sync.status', familyId: 'f', entityId: 'cal' });
}

/** Shape 3: the type as a bare string argument (the calendar helper's shape). */
export async function publishesAnEventDeletion(): Promise<void> {
  await publishEvent('event.deleted', ['e1']);
}

/** Decoy 1: a `type` property that is not a realtime event type. */
export const notAnEvent = { type: 'birthday' };

/** Decoy 2: a realtime type used as a *subscription filter*, not a publication. */
export const subscribedTypes = ['timer.started', 'timer.stopped'];

/** Decoy 3: a bare string argument that is not a realtime event type. */
export async function unrelatedCall(): Promise<void> {
  await publishEvent('birthday.remembered', ['e2']);
}
