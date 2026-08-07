import 'server-only';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects from the schema assembly point, not a slice barrel — the same
// note as in `./actions.ts`.
import { completion, routine, routineStep, starLedger } from '@/server/db/schema';
import { can, getFamily, getMember, type Principal } from '@/modules/family';
import { publish } from '@/modules/realtime';
import { completionFailure, type CompletionState } from './action-state';
import { notifyCompletion } from './notify-bridge';
import { isCompletableOn } from './domain/occurrence';
import { starsFor } from './domain/stars';

/**
 * Ticking a step, for **any** principal — extracted from `completeStepAction`
 * in M13 so a caregiver share link can reach it without a Server Action.
 *
 * The `(share)` route tree may not import a Server Action, transitively or
 * otherwise (docs/architecture.md §2), so a contributor's tick necessarily
 * arrives at a route handler instead: `POST /api/share/completions`. That
 * handler and `completeStepAction` must write *identically* — same
 * idempotency, same single transaction, same star, same realtime publish — or
 * a completion would mean two different things depending on which surface made
 * it. Sharing the code is the only way to keep that true; two call sites of one
 * function cannot drift.
 *
 * `can()` is called here as well as at each entry point. That is not
 * belt-and-braces for its own sake: this function is now reachable from a
 * route handler, which is outside the `'use server'` audit
 * (`tests/unit/server-action-authorization.test.ts` only walks `'use server'`
 * modules), so the structural guarantee that "every mutation authorizes" stops
 * at the handler's door. Putting the check *inside* the shared write means a
 * future third caller cannot forget it.
 */

const trimmed = z.string().trim();

export const completeStepSchema = z.object({
  routineId: z.uuid(),
  routineStepId: z.uuid(),
  memberId: z.uuid(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /**
   * The idempotency key, minted by the client *before* the request leaves the
   * device (§4). It is derived from `(member, step, occurrence date)` rather
   * than random, so a retry after a dropped connection reuses the same key by
   * construction instead of by remembering to.
   */
  clientId: trimmed.min(8).max(200),
  source: z.enum(['hub', 'mobile']),
});

export type CompleteStepInput = z.infer<typeof completeStepSchema>;

/**
 * The realtime actor for a principal.
 *
 * A share principal contributes neither a `memberId` nor a `deviceId` — it has
 * neither, by construction. The event still carries `source: 'mobile'` and the
 * `clientId`, which is everything a consumer needs to drop its own echo. Naming
 * the *link* would mean putting a share-link id into a payload that reaches
 * every open stream in the family, which is a credential-adjacent identifier
 * for no gain.
 *
 * Exported (M13, NB-3): `./actions.ts` already imports this module for
 * `recordCompletion`, and this function and `revalidateRoutines` below were
 * duplicated verbatim rather than shared. One copy each, here — the write
 * lives in this module, so the two helpers it needs travel with it.
 */
export function actorOf(principal: Principal): { memberId?: string; deviceId?: string } {
  if (principal.kind === 'member') return { memberId: principal.memberId };
  if (principal.kind === 'device') return { deviceId: principal.deviceId };
  return {};
}

/** Revalidates every surface that renders routines. See `actorOf` above on why this is exported rather than duplicated. */
export async function revalidateRoutines(memberIds: readonly string[]): Promise<void> {
  const locale = await getLocale();
  revalidatePath(`/${locale}/routines`);
  revalidatePath(`/${locale}/hub`);
  for (const memberId of new Set(memberIds)) {
    revalidatePath(`/${locale}/hub/routines/${memberId}`);
  }
}

/**
 * A single tap (FR8) — the whole of the <100ms optimistic path's server half.
 *
 * The completion row and its star land in **one transaction**, together with
 * the realtime publish, so there is no observable moment where a step is done
 * but unpaid. Idempotency is the database's job, not a read-then-write check:
 * `ON CONFLICT DO NOTHING` covers both `unique(clientId)` (an offline outbox
 * replay) and `unique(memberId, routineStepId, occurrenceDate)` (a double
 * tap). When nothing was inserted, nothing is awarded — which is exactly why
 * a replay cannot mint a second star.
 *
 * There is no failure UI on this path by design: a tap that arrives late, or
 * twice, or for a routine that has graduated, all render the same. The one
 * thing that never happens is a mark against the child.
 */
export async function recordCompletion(
  principal: Principal,
  input: CompleteStepInput
): Promise<CompletionState> {
  const parsed = completeStepSchema.safeParse(input);
  if (!parsed.success) return completionFailure('invalidInput');

  const { routineId, routineStepId, memberId, occurrenceDate, clientId, source } = parsed.data;

  // The scoped check, against the *subject* member. For a share contributor
  // this is what confines a link to the children it was minted for; §7's
  // `scoped` grade fails closed on a member outside `scope.memberIds`.
  if (!can(principal, 'completion:write', { familyId: principal.familyId, memberId })) {
    return completionFailure('forbidden');
  }

  const db = getDb();

  const [target] = await db
    .select({ routine, step: routineStep })
    .from(routineStep)
    .innerJoin(routine, eq(routine.id, routineStep.routineId))
    .where(
      and(
        eq(routineStep.id, routineStepId),
        eq(routineStep.routineId, routineId),
        eq(routine.familyId, principal.familyId)
      )
    )
    .limit(1);

  if (!target) return completionFailure('routineNotFound');

  // The completing member must be in this family; a forged id addresses nothing.
  // The row is kept rather than discarded: FR22's notification names the person
  // whose step it was, and this is the one place that already proved who that
  // is.
  const subject = await getMember(principal.familyId, memberId);
  if (!subject) {
    return completionFailure('memberNotFound');
  }

  const family = await getFamily(principal.familyId);
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';

  const completable = isCompletableOn(
    { schedule: target.routine.schedule, anchor: target.routine.createdAt, timeZone },
    occurrenceDate,
    new Date()
  );
  if (!completable) return completionFailure('notScheduled');

  const stars = starsFor(target.routine);

  const result = await db.transaction(async (tx): Promise<CompletionState> => {
    const [inserted] = await tx
      .insert(completion)
      .values({
        familyId: principal.familyId,
        memberId,
        routineId,
        routineStepId,
        occurrenceDate,
        source,
        clientId,
      })
      // No conflict *target*: this has to absorb both unique indexes at once —
      // the clientId replay and the (member, step, day) double tap.
      .onConflictDoNothing()
      .returning({ id: completion.id });

    if (!inserted) {
      // Either a replay (same `clientId`) or a re-tap after an undo. Clearing
      // the stamp is what makes the second case work; on a replay it updates
      // nothing, because the row was never undone. Either way **no star is
      // awarded** — `inserted` is empty, and that is the only thing that pays.
      const [revived] = await tx
        .update(completion)
        .set({ undoneAt: null })
        .where(
          and(
            eq(completion.familyId, principal.familyId),
            eq(completion.clientId, clientId),
            isNotNull(completion.undoneAt)
          )
        )
        .returning({ id: completion.id });

      if (revived) {
        await publish(
          {
            familyId: principal.familyId,
            type: 'completion.created',
            entity: { id: revived.id },
            // The actor is whoever *tapped* — a paired kiosk names its device
            // (M12), not the child whose routine it is. `memberId` is the
            // subject and rides in the patch, where every consumer already
            // reads it from.
            actor: { ...actorOf(principal), clientId, source },
            patch: { memberId, routineId, routineStepId, occurrenceDate, stars: 0 },
          },
          tx
        );
      }

      return { status: 'done', stars: 0, replayed: true } as const;
    }

    if (stars > 0) {
      await tx.insert(starLedger).values({
        familyId: principal.familyId,
        memberId,
        amount: stars,
        reason: 'routine',
        completionId: inserted.id,
        routineId,
      });
    }

    await publish(
      {
        familyId: principal.familyId,
        type: 'completion.created',
        entity: { id: inserted.id },
        // `clientId` rides along so the device that tapped can drop its own
        // echo (§4) — it has already celebrated; re-applying the event would
        // at best be a no-op and at worst interrupt an animation.
        actor: { ...actorOf(principal), clientId, source },
        patch: { memberId, routineId, routineStepId, occurrenceDate, stars },
      },
      tx
    );

    if (stars > 0) {
      await publish(
        {
          familyId: principal.familyId,
          type: 'stars.awarded',
          entity: { id: inserted.id },
          actor: { memberId, clientId, source },
          patch: { amount: stars, reason: 'routine', routineId },
        },
        tx
      );
    }

    return { status: 'done', stars, replayed: false } as const;
  });

  /**
   * PRD FR22 (M18): the other adults hear about it.
   *
   * After the commit, and only for a completion that was genuinely *new* —
   * `replayed` is true for an outbox replay and for a re-tap after an undo,
   * and neither is news. That is the idempotency guarantee, and it is the
   * database's `ON CONFLICT DO NOTHING` above rather than a check here.
   *
   * The failure is swallowed for the same reason the redemption fan-out
   * swallows its own: a push queue having a bad minute must never turn a
   * child's tap into an error on a wall tablet, and the completion is already
   * on every screen in the house through `publish()`.
   */
  if (result.status === 'done' && !result.replayed) {
    await notifyCompletion({
      familyId: principal.familyId,
      memberName: subject.displayName,
      stepTitle: target.step.title,
      clientId,
      actorMemberId: principal.kind === 'member' ? principal.memberId : null,
    }).catch(() => 0);
  }

  // Outside the transaction: revalidation is a cache concern, not a write, and
  // the hub's own view has already flipped optimistically by the time this runs.
  await revalidateRoutines([memberId]);
  return result;
}
