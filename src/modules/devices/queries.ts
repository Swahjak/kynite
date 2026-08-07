import 'server-only';
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { getDb, type Database } from '@/server/db';
// The schema assembly point, not a slice barrel (same note as every other
// slice's `queries.ts`): a barrel re-exports client components.
import { member } from '@/server/db/schema';
import {
  PAIRING_CODE_TTL_MS,
  PAIRING_FAILURE_WINDOW_MS,
  PAIRING_GLOBAL_MAX_FAILURES,
  PAIRING_MAX_FAILURES,
  PAIRING_MAX_LIVE_CODES_PER_FAMILY,
  deviceSessionExpiry,
  generateDeviceToken,
  generatePairingCode,
  hashDeviceToken,
  hashPairingCode,
} from '@/lib/device-session';
import {
  device,
  devicePairingAttempt,
  devicePairingCode,
  deviceSession,
  type Device,
  type DeviceKind,
} from './schema';

/**
 * Reads and credential lifecycle for the devices slice (M12).
 *
 * `server-only`: every function here either reads a bearer-secret hash or
 * writes one, and none of it may ever be reachable from a client bundle.
 * Family scoping is by `where`, never by the caller remembering to filter.
 */

/** The transaction executor `db.transaction(async (tx) => ...)` hands back. */
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Serialize every reader/writer of a bucket behind a Postgres advisory lock,
 * scoped to the current transaction (released automatically on commit or
 * rollback — never leaked across a crashed request).
 *
 * This is the fix for the brute-force TOCTOU (reviewer finding, BLOCKING 1b):
 * `SELECT count(*)` followed by a later `INSERT` is two statements with a gap
 * between them, and under READ COMMITTED — Postgres's default — N concurrent
 * transactions can each run the `count()` before any of them commits its
 * `INSERT`, so all N observe the same stale count and all N pass. A `count()`
 * *after* this transaction's own row is inserted closes half of that (the
 * caller sees its own row), but two transactions racing each other still only
 * ever see their *own* insert, not each other's, until one commits — the race
 * survives read-committed isolation by construction, not by a code mistake in
 * this file. The advisory lock is what actually serializes: `hashtext(key)`
 * turns the bucket identity into the lock's integer id, and the first
 * transaction to reach it holds every later count-and-decide for the same
 * key until it commits or rolls back.
 */
async function withBucketLock<T>(tx: Tx, key: string, fn: () => Promise<T>): Promise<T> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
  return fn();
}

/** One row of `(app)/settings/devices`. */
export type DeviceListEntry = {
  id: string;
  name: string;
  kind: DeviceKind;
  pairedAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
};

export async function listDevices(familyId: string): Promise<DeviceListEntry[]> {
  return getDb()
    .select({
      id: device.id,
      name: device.name,
      kind: device.kind,
      pairedAt: device.pairedAt,
      lastSeenAt: device.lastSeenAt,
      revokedAt: device.revokedAt,
    })
    .from(device)
    .where(eq(device.familyId, familyId))
    .orderBy(desc(device.pairedAt));
}

/** A pairing code the parent can still read off the screen. */
export type PendingPairingCode = {
  id: string;
  deviceName: string;
  expiresAt: Date;
};

export async function listPendingPairingCodes(
  familyId: string,
  now: Date = new Date()
): Promise<PendingPairingCode[]> {
  return getDb()
    .select({
      id: devicePairingCode.id,
      deviceName: devicePairingCode.deviceName,
      expiresAt: devicePairingCode.expiresAt,
    })
    .from(devicePairingCode)
    .where(
      and(
        eq(devicePairingCode.familyId, familyId),
        isNull(devicePairingCode.consumedAt),
        gt(devicePairingCode.expiresAt, now)
      )
    )
    .orderBy(desc(devicePairingCode.expiresAt));
}

export type CreatePairingCodeResult =
  { status: 'created'; code: string; expiresAt: Date } | { status: 'tooManyPending' };

/**
 * Mint a pairing code. Returns the **raw** digits — the only moment they
 * exist outside the parent's screen.
 *
 * The retry loop exists because the code space is small enough (10^6) that a
 * collision with another household's live code is not negligible over a
 * lifetime of installs, and the partial unique index turns that collision into
 * an error rather than into two families sharing a code. An *expired*
 * unconsumed row holding the hash is deleted rather than retried around: it can
 * never pair anything again, and keeping it would slowly poison the space.
 *
 * Wrapped in one transaction, behind a per-family advisory lock
 * (`withBucketLock`), for the cap below: `count()` then `insert()` is the same
 * TOCTOU shape the brute-force fix closes in `redeemPairingCode`, and two
 * requests racing to mint a family's 3rd and 4th code must not both see 2.
 */
export async function createPairingCode(input: {
  familyId: string;
  deviceName: string;
  kind: DeviceKind;
  createdByMemberId: string | null;
  now?: Date;
}): Promise<CreatePairingCodeResult> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + PAIRING_CODE_TTL_MS);
  const db = getDb();

  return db.transaction(async (tx) =>
    withBucketLock(tx, `pairing:family:${input.familyId}`, async () => {
      // The per-family cap (BLOCKING 1c / reviewer finding 4): without it, a
      // single family — malicious or just a runaway retry loop — can keep
      // minting codes into the shared, cross-tenant code space, narrowing the
      // pool every other family's codes are drawn from.
      const [{ count: liveCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(devicePairingCode)
        .where(
          and(
            eq(devicePairingCode.familyId, input.familyId),
            isNull(devicePairingCode.consumedAt),
            gt(devicePairingCode.expiresAt, now)
          )
        );

      if (liveCount >= PAIRING_MAX_LIVE_CODES_PER_FAMILY) {
        return { status: 'tooManyPending' };
      }

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const code = generatePairingCode();
        const codeHash = hashPairingCode(code);

        // Clear a dead squatter first: an unconsumed row past its TTL holds
        // the hash in the partial unique index but can never be exchanged.
        await tx
          .delete(devicePairingCode)
          .where(
            and(
              eq(devicePairingCode.codeHash, codeHash),
              isNull(devicePairingCode.consumedAt),
              lt(devicePairingCode.expiresAt, now)
            )
          );

        const [row] = await tx
          .insert(devicePairingCode)
          .values({
            familyId: input.familyId,
            codeHash,
            deviceName: input.deviceName,
            kind: input.kind,
            createdByMemberId: input.createdByMemberId,
            expiresAt,
          })
          .onConflictDoNothing()
          .returning({ id: devicePairingCode.id });

        if (row) return { status: 'created', code, expiresAt };
      }

      // Eight collisions in a row is not a code-space problem, it is a broken
      // random source. Failing loudly beats handing back a code that pairs
      // somebody else's tablet.
      throw new Error('Could not allocate a unique pairing code');
    })
  );
}

/** Cancel a pending code before it is ever typed in — owner-scoped, single-use. */
export async function cancelPairingCode(familyId: string, id: string): Promise<boolean> {
  const [row] = await getDb()
    .delete(devicePairingCode)
    .where(
      and(
        eq(devicePairingCode.id, id),
        eq(devicePairingCode.familyId, familyId),
        isNull(devicePairingCode.consumedAt)
      )
    )
    .returning({ id: devicePairingCode.id });

  return row !== undefined;
}

export type PairingFailure = 'invalidCode' | 'rateLimited';

export type PairingSuccess = {
  deviceId: string;
  familyId: string;
  deviceName: string;
  /** The raw session token. Written to the cookie by the caller, then dropped. */
  token: string;
  expiresAt: Date;
};

/**
 * Exchange a code for a device + device session (§7).
 *
 * Everything that makes the code a credential is enforced in the `where`:
 * `consumed_at is null` (single use) and `expires_at > now` (10-minute TTL).
 * The update-then-check ordering matters — the code is claimed by an UPDATE
 * whose predicate is the validity check, so two hubs racing on the same code
 * produce one winner and one `invalidCode`, not two devices.
 *
 * Rate limiting is now *inside* one transaction with the claim itself
 * (BLOCKING 1, reviewer findings on the brute-force limit):
 *
 *  1. **Per-client bucket** (`PAIRING_MAX_FAILURES` per `PAIRING_FAILURE_WINDOW_MS`,
 *     keyed by `clientHash`) — the first line, cheap, and enough to stop a
 *     person mistyping a code. Not the guarantee: the fingerprint it buckets
 *     on is attacker-controlled (a forwarded header, a user agent), so a
 *     script that rotates either walks straight through it.
 *  2. **Global backstop** (`PAIRING_GLOBAL_MAX_FAILURES`, same window, counted
 *     across every `clientHash`) — the actual guarantee. It cannot be sharded
 *     by rotating a fingerprint, because it does not look at the fingerprint
 *     at all.
 *
 * Both counts are made atomic against concurrent requests the same way:
 * `withBucketLock` takes a transaction-scoped Postgres advisory lock keyed to
 * the bucket *before* the attempt row is inserted, so concurrent callers for
 * the same bucket serialize rather than all reading the count before any of
 * them writes it (the TOCTOU the previous version had — the row was read
 * before the transaction and written after it, so N concurrent requests all
 * saw zero). Within the lock, the attempt row is inserted *first* and the
 * count that decides the outcome includes that row — `> LIMIT` on a count
 * that already includes "this attempt" is the same boundary as the old
 * `>= LIMIT` on a count taken before it, just closed against the race.
 *
 * The row inserted for this attempt is only kept if the attempt was a
 * genuine failure. On success it is deleted again — the table's own
 * contract is "only failures are recorded" (`schema.ts`), and a code that
 * turned out to be correct is not a failure just because it was checked
 * after a rate-limit gate.
 */
export async function redeemPairingCode(input: {
  codeHash: string;
  clientHash: string;
  now?: Date;
}): Promise<{ status: 'paired'; result: PairingSuccess } | { status: PairingFailure }> {
  const now = input.now ?? new Date();
  const db = getDb();

  return db.transaction(
    async (
      tx
    ): Promise<{ status: 'paired'; result: PairingSuccess } | { status: PairingFailure }> =>
      withBucketLock(tx, `pairing:client:${input.clientHash}`, async () => {
        const [attempt] = await tx
          .insert(devicePairingAttempt)
          .values({ clientHash: input.clientHash, createdAt: now })
          .returning({ id: devicePairingAttempt.id });

        const clientFailures = await countRecentPairingFailuresTx(tx, input.clientHash, now);
        if (clientFailures > PAIRING_MAX_FAILURES) {
          // Fail closed with the same generic outcome a wrong code gets — no
          // distinction between "you are throttled" and "everyone is".
          return { status: 'rateLimited' };
        }

        return withBucketLock(tx, 'pairing:global', async () => {
          const globalFailures = await countRecentGlobalPairingFailuresTx(tx, now);
          if (globalFailures > PAIRING_GLOBAL_MAX_FAILURES) {
            return { status: 'rateLimited' };
          }

          // The claim *is* the validation: nothing is read and then trusted.
          const [claimed] = await tx
            .update(devicePairingCode)
            .set({ consumedAt: now, updatedAt: now })
            .where(
              and(
                eq(devicePairingCode.codeHash, input.codeHash),
                isNull(devicePairingCode.consumedAt),
                gt(devicePairingCode.expiresAt, now)
              )
            )
            .returning({
              id: devicePairingCode.id,
              familyId: devicePairingCode.familyId,
              deviceName: devicePairingCode.deviceName,
              kind: devicePairingCode.kind,
            });

          if (!claimed) return { status: 'invalidCode' };

          // A genuine success: the attempt row above was never a failure.
          await tx.delete(devicePairingAttempt).where(eq(devicePairingAttempt.id, attempt.id));

          const [created] = await tx
            .insert(device)
            .values({
              familyId: claimed.familyId,
              name: claimed.deviceName,
              kind: claimed.kind,
              pairedAt: now,
              lastSeenAt: now,
            })
            .returning({ id: device.id });

          await tx
            .update(devicePairingCode)
            .set({ consumedByDeviceId: created.id })
            .where(eq(devicePairingCode.id, claimed.id));

          const token = generateDeviceToken();
          const expiresAt = deviceSessionExpiry(now);

          await tx.insert(deviceSession).values({
            deviceId: created.id,
            tokenHash: hashDeviceToken(token),
            expiresAt,
          });

          return {
            status: 'paired',
            result: {
              deviceId: created.id,
              familyId: claimed.familyId,
              deviceName: claimed.deviceName,
              token,
              expiresAt,
            },
          };
        });
      })
  );
}

async function countRecentPairingFailuresTx(
  tx: Tx | Database,
  clientHash: string,
  now: Date
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(devicePairingAttempt)
    .where(
      and(
        eq(devicePairingAttempt.clientHash, clientHash),
        gt(devicePairingAttempt.createdAt, new Date(now.getTime() - PAIRING_FAILURE_WINDOW_MS))
      )
    );

  return row?.count ?? 0;
}

/** The per-client count, for callers (tests, observability) outside a transaction. */
export async function countRecentPairingFailures(
  clientHash: string,
  now: Date = new Date()
): Promise<number> {
  return countRecentPairingFailuresTx(getDb(), clientHash, now);
}

async function countRecentGlobalPairingFailuresTx(tx: Tx | Database, now: Date): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(devicePairingAttempt)
    .where(gt(devicePairingAttempt.createdAt, new Date(now.getTime() - PAIRING_FAILURE_WINDOW_MS)));

  return row?.count ?? 0;
}

/** The global count, across every client fingerprint, for tests/observability. */
export async function countRecentGlobalPairingFailures(now: Date = new Date()): Promise<number> {
  return countRecentGlobalPairingFailuresTx(getDb(), now);
}

/**
 * Revoke a device: the row is marked, and every session it owns with it.
 *
 * Both are stamped rather than deleted. The device row is what the settings
 * list shows ("revoked on…"), and a deleted session would lose the fact that
 * the tablet in the kitchen *was* paired — which is the only thing that makes
 * a stray cookie explicable later.
 */
export async function revokeDevice(
  familyId: string,
  deviceId: string,
  now: Date = new Date()
): Promise<boolean> {
  const db = getDb();

  const [revoked] = await db
    .update(device)
    .set({ revokedAt: now, updatedAt: now })
    .where(and(eq(device.id, deviceId), eq(device.familyId, familyId), isNull(device.revokedAt)))
    .returning({ id: device.id });

  if (!revoked) return false;

  await db
    .update(deviceSession)
    .set({ revokedAt: now, updatedAt: now })
    .where(and(eq(deviceSession.deviceId, deviceId), isNull(deviceSession.revokedAt)));

  return true;
}

/** One device, family-scoped. Null for another family's id — never a leak. */
export async function getDevice(familyId: string, deviceId: string): Promise<Device | null> {
  const [row] = await getDb()
    .select()
    .from(device)
    .where(and(eq(device.id, deviceId), eq(device.familyId, familyId)))
    .limit(1);

  return row ?? null;
}

/** The member who owns the request, for the settings list's "paired by" line. */
export async function getMemberDisplayName(memberId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ displayName: member.displayName })
    .from(member)
    .where(eq(member.id, memberId))
    .limit(1);

  return row?.displayName ?? null;
}

export type DeviceTrimResult = {
  sessions: number;
  pairingCodes: number;
  pairingAttempts: number;
};

/**
 * The devices slice's contribution to `maintenance:trim` (docs/architecture.md
 * §8: "trim `event_log` >7d, pg-boss archive, **stale device sessions**").
 *
 * Three bounded deletes, all of rows that can never authenticate anything
 * again:
 *
 *  - sessions past `expires_at`, and sessions revoked longer ago than
 *    `revokedRetentionBefore` (a freshly revoked one is kept for a while so
 *    "this tablet was cut off yesterday" is still answerable);
 *  - pairing codes past their TTL, consumed or not — a consumed one has
 *    already produced its device, and an expired one can never produce any;
 *  - rate-limit counters outside the sliding window, which is the only thing
 *    that reads them.
 */
export async function trimDeviceSessions(
  revokedRetentionBefore: Date,
  now: Date = new Date()
): Promise<DeviceTrimResult> {
  const db = getDb();

  const sessions = await db
    .delete(deviceSession)
    .where(
      or(
        lt(deviceSession.expiresAt, now),
        and(
          sql`${deviceSession.revokedAt} is not null`,
          lt(deviceSession.revokedAt, revokedRetentionBefore)
        )
      )
    );

  const pairingCodes = await db
    .delete(devicePairingCode)
    .where(lt(devicePairingCode.expiresAt, now));

  const pairingAttempts = await db
    .delete(devicePairingAttempt)
    .where(lt(devicePairingAttempt.createdAt, new Date(now.getTime() - PAIRING_FAILURE_WINDOW_MS)));

  return {
    sessions: sessions.rowCount ?? 0,
    pairingCodes: pairingCodes.rowCount ?? 0,
    pairingAttempts: pairingAttempts.rowCount ?? 0,
  };
}
