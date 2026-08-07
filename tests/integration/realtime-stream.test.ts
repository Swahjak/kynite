import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MAX_STREAMS_PER_FAMILY,
  StreamCapExceededError,
  closeListenPool,
  getListenPool,
  listenPoolStats,
  subscribe,
} from '@/modules/realtime/listen-pool';
import { publish } from '@/modules/realtime/publish';
import { openFamilyStream } from '@/modules/realtime/stream';
import {
  createTestDb,
  databaseUrl,
  seedHousehold,
  type Household,
  type TestDb,
} from './support/db';

/**
 * The SSE stream and its connection budget (docs/architecture.md §4).
 *
 * The leak test is the one that earns its keep. A stream that forgets to
 * release its `LISTEN` connection does not fail — it works perfectly, for a
 * while, and then the pool is exhausted and every request in the process
 * blocks. Nothing short of cycling connections and *counting* catches that, so
 * that is what this does: 50 connect/disconnect cycles, then the pool has to be
 * back where it started.
 */

const RUN = databaseUrl ? describe : describe.skip;

function decodeFrames(chunks: Uint8Array[]): string {
  return new TextDecoder().decode(
    chunks.reduce<Uint8Array>((all, chunk) => {
      const next = new Uint8Array(all.length + chunk.length);
      next.set(all);
      next.set(chunk, all.length);
      return next;
    }, new Uint8Array())
  );
}

/**
 * Pump a stream into a growing buffer in the background.
 *
 * A background pump rather than a read-with-timeout: racing `reader.read()`
 * against a timer abandons the read, and the chunk it eventually resolves with
 * is delivered to nobody — so a perfectly healthy stream reads as silent. One
 * loop that owns the reader for the whole test is the only shape without that
 * hazard.
 */
function pump(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  let stopped = false;

  const loop = (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || stopped) return;
        if (value) chunks.push(value);
      }
    } catch {
      // The stream was cancelled out from under us; that is the end of it.
    }
  })();

  return {
    /** Everything received since the last `clear()`. */
    text: () => decodeFrames(chunks),
    clear: () => {
      chunks.length = 0;
    },
    stop: async () => {
      stopped = true;
      await reader.cancel().catch(() => {});
      await loop;
    },
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Poll until the stream has said something, rather than sleeping for a
 * plausible-looking interval. NOTIFY delivery is fast but not synchronous, and
 * a fixed sleep is a flake waiting for a loaded machine.
 */
async function waitForFrame(read: () => string, needle: string, budgetMs = 5000): Promise<string> {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const text = read();
    if (text.includes(needle) || Date.now() > deadline) return text;
    await wait(50);
  }
}

RUN('SSE streams and the listen pool', () => {
  let db: TestDb;
  let pool: { end: () => Promise<void> };
  let household: Household;

  beforeAll(async () => {
    // `openFamilyStream()`/`subscribe()` go through the app's own `getDb()`,
    // which validates the whole server env at first use. Same shim the
    // Google integration suites use — the values are never exercised, only
    // parsed.
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

    const created = createTestDb();
    db = created.db;
    pool = created.pool;
    household = await seedHousehold(db, 'Stream');
  });

  afterAll(async () => {
    await closeListenPool();
    await pool?.end();
  });

  it('releases every connection across 50 connect/disconnect cycles', async () => {
    // `pg` hands the *same* client object back out of the pool, so a channel
    // that releases without detaching its `notification`/`error` handlers piles
    // them up on a connection somebody else is now using. Node only complains
    // at eleven, and only as a warning — so the warning is made fatal here.
    const warnings: string[] = [];
    const onWarning = (warning: Error) => warnings.push(warning.name);
    process.on('warning', onWarning);

    // Warm the pool so the baseline is a steady state, not "nothing yet".
    const warm = await subscribe(household.familyId, () => {});
    await warm.unsubscribe();

    const baseline = listenPoolStats();
    expect(baseline.streams).toBe(0);
    expect(baseline.channels).toBe(0);

    for (let cycle = 0; cycle < 50; cycle += 1) {
      const subscription = await subscribe(household.familyId, () => {});
      // Mid-flight the fan-out holds exactly one channel for this family.
      expect(listenPoolStats().channels).toBe(1);
      await subscription.unsubscribe();
    }

    const after = listenPoolStats();
    expect(after.streams).toBe(0);
    expect(after.channels).toBe(0);
    // The measurement that matters: connections did not accumulate. A stream
    // that leaked one per cycle would show 50 here.
    expect(after.totalConnections).toBeLessThanOrEqual(baseline.totalConnections);
    expect(getListenPool().waitingCount).toBe(0);

    // Give the warning a tick to surface before asserting its absence.
    await new Promise((resolve) => setTimeout(resolve, 50));
    process.off('warning', onWarning);
    expect(warnings).not.toContain('MaxListenersExceededWarning');
  }, 60_000);

  it('fans one connection out to many streams of the same family', async () => {
    // Twenty devices in one household must not cost twenty connections — that
    // is the whole reason the channel map exists.
    const subscriptions = await Promise.all(
      Array.from({ length: MAX_STREAMS_PER_FAMILY }, () => subscribe(household.familyId, () => {}))
    );

    const stats = listenPoolStats();
    expect(stats.streams).toBe(MAX_STREAMS_PER_FAMILY);
    expect(stats.channels).toBe(1);
    expect(stats.totalConnections).toBeLessThanOrEqual(2);

    await Promise.all(subscriptions.map((subscription) => subscription.unsubscribe()));
    expect(listenPoolStats().streams).toBe(0);
  }, 30_000);

  it('refuses the stream past the per-family cap, and frees the slot again', async () => {
    const subscriptions = await Promise.all(
      Array.from({ length: MAX_STREAMS_PER_FAMILY }, () => subscribe(household.familyId, () => {}))
    );

    await expect(subscribe(household.familyId, () => {})).rejects.toBeInstanceOf(
      StreamCapExceededError
    );

    // Refusing must not have consumed a slot of its own, or a family would
    // ratchet itself permanently closed by retrying.
    expect(listenPoolStats().streams).toBe(MAX_STREAMS_PER_FAMILY);

    await subscriptions[0].unsubscribe();
    const replacement = await subscribe(household.familyId, () => {});
    expect(listenPoolStats().streams).toBe(MAX_STREAMS_PER_FAMILY);

    await replacement.unsubscribe();
    await Promise.all(subscriptions.slice(1).map((subscription) => subscription.unsubscribe()));
    expect(listenPoolStats().streams).toBe(0);
  }, 30_000);

  it('opens with the documented frames and streams a live event', async () => {
    const controller = new AbortController();
    const stream = await openFamilyStream({
      familyId: household.familyId,
      cursor: null,
      signal: controller.signal,
      // 25s is the production cadence; a test that waited for it would take
      // 25s to learn one thing.
      heartbeatIntervalMs: 120,
    });

    const stream$ = pump(stream.getReader());
    await wait(300);

    const opening = stream$.text();
    expect(opening).toContain('retry: ');
    expect(opening).toContain('event: control');
    expect(opening).toContain('"type":"hello"');

    // Cleared *before* the publish, not after: `publish()` resolves on commit
    // and the NOTIFY can land within a microsecond of it, so clearing
    // afterwards throws away the very frame this test is waiting for. (That
    // race was a real ~1-in-8 flake, and it looked exactly like a broken
    // stream: nothing but heartbeats.)
    stream$.clear();

    const event = await publish({
      familyId: household.familyId,
      type: 'timer.started',
      entity: { id: 'timer-live' },
      actor: { source: 'mobile' },
    });

    const live = await waitForFrame(() => stream$.text(), `id: ${event.id}\n`);

    expect(live).toContain(`id: ${event.id}\n`);
    expect(live).toContain('event: kynite');
    expect(live).toContain('"timer.started"');
    // §4's heartbeat, at the cadence this stream was opened with.
    expect(await waitForFrame(() => stream$.text(), ': ping\n\n')).toContain(': ping\n\n');

    controller.abort();
    await stream$.stop();
    // The abort is what returns the connection; without it the cap would fill
    // up with sockets whose browsers are long gone.
    await wait(100);
    expect(listenPoolStats().streams).toBe(0);
  }, 30_000);

  it('closes a device stream on its own revocation, and releases its slot (review finding 3)', async () => {
    // Before this: a revoked device's own SSE stream kept its `LISTEN`
    // fan-out slot and connection for up to an hour — the client-side
    // `DeviceSessionWatcher` reacts to `device.revoked` and refreshes, but
    // nothing on the server told *this stream* to stop holding its slot.
    const revoking = await seedHousehold(db, 'RevokedStream');
    const deviceId = 'device-under-test';

    const controller = new AbortController();
    const stream = await openFamilyStream({
      familyId: revoking.familyId,
      cursor: null,
      signal: controller.signal,
      heartbeatIntervalMs: 10_000,
      selfDeviceId: deviceId,
    });

    const reader = stream.getReader();
    const stream$ = pump(reader);
    await waitForFrame(() => stream$.text(), '"type":"hello"');

    expect(listenPoolStats().streams).toBe(1);
    stream$.clear();

    // A different device's revocation must not close this stream.
    await publish({
      familyId: revoking.familyId,
      type: 'device.revoked',
      entity: { id: 'someone-elses-device' },
      actor: { source: 'mobile' },
    });
    await wait(200);
    expect(listenPoolStats().streams).toBe(1);

    // This stream's own device, revoked — the frame still has to arrive
    // (the client needs to see it to redirect), and then the stream closes
    // and the slot is freed on its own, with no `controller.abort()`.
    const event = await publish({
      familyId: revoking.familyId,
      type: 'device.revoked',
      entity: { id: deviceId },
      actor: { source: 'mobile' },
    });

    const text = await waitForFrame(() => stream$.text(), `id: ${event.id}\n`);
    expect(text).toContain('"device.revoked"');

    // The stream ends on its own — `reader.read()` resolves `done: true`
    // without this test ever calling `abort()`.
    await stream$.stop();
    await wait(100);
    expect(listenPoolStats().streams).toBe(0);
  }, 30_000);

  it('replays the gap before going live on reconnect', async () => {
    const reconnecting = await seedHousehold(db, 'Reconnect');

    const first = await publish({
      familyId: reconnecting.familyId,
      type: 'routine.updated',
      entity: { id: 'before-cursor' },
      actor: { source: 'job' },
    });
    const missed = await publish({
      familyId: reconnecting.familyId,
      type: 'routine.updated',
      entity: { id: 'missed-while-away' },
      actor: { source: 'job' },
    });

    const controller = new AbortController();
    const stream = await openFamilyStream({
      familyId: reconnecting.familyId,
      cursor: BigInt(first.id),
      signal: controller.signal,
      heartbeatIntervalMs: 10_000,
    });

    const stream$ = pump(stream.getReader());
    const text = await waitForFrame(() => stream$.text(), 'missed-while-away');

    expect(text).toContain('missed-while-away');
    // Strictly after the cursor: the event the client already had must not be
    // re-sent, or a resync would re-apply history on every reconnect.
    expect(text).not.toContain('before-cursor');
    expect(text).toContain(`id: ${missed.id}\n`);

    controller.abort();
    await stream$.stop();
  }, 30_000);

  it('tells a client with an unreplayable gap to resync', async () => {
    const stale = await seedHousehold(db, 'StaleStream');
    await publish({
      familyId: stale.familyId,
      type: 'routine.updated',
      entity: { id: 'only-row' },
      actor: { source: 'job' },
    });

    // A cursor from a log that has since been trimmed to nothing it can reach.
    const controller = new AbortController();
    const stream = await openFamilyStream({
      familyId: stale.familyId,
      cursor: 1n,
      signal: controller.signal,
      heartbeatIntervalMs: 10_000,
    });

    const stream$ = pump(stream.getReader());
    const text = await waitForFrame(() => stream$.text(), '"type":"resync"');

    expect(text).toContain('"type":"resync"');
    expect(text).toContain('"reason":"retention"');
    // A control frame carries no id — the client must not adopt it as a cursor.
    expect(text.split('event: control')[1]?.split('\n\n')[0]).not.toContain('id:');

    controller.abort();
    await stream$.stop();
  }, 30_000);
});
