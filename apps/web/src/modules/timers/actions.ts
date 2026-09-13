'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { assertCan } from '@/modules/family';
import {
  extendTimer,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
  type ExtendTimerInput,
  type PauseTimerInput,
  type ResumeTimerInput,
  type StartTimerInput,
  type StopTimerInput,
} from './write';
import {
  type ExtendTimerState,
  type PauseTimerState,
  type ResumeTimerState,
  type StartTimerState,
  type StopTimerState,
} from './action-state';

/**
 * Mutations for the timers slice (M09; write seams extracted at MCP
 * milestone M2).
 *
 * Three actions, because a timer has exactly three things a person can do to
 * it: start it, give it a bit longer, and stop it (plus M-T1's pause/resume).
 * All five open with `assertCan('timer:control')` — the §7 capability
 * granted to owners, adults, children on the hub, contributor caregivers and
 * paired devices — before any database identifier is referenced, which is
 * what `tests/unit/server-action-authorization.test.ts` audits structurally.
 * This is a cheap early rejection, not the decision: each write seam
 * (`./write.ts`) re-checks `can()` against the resolved principal itself, so
 * `/api/mcp`'s tools reach identical authorization without going through
 * `assertCan`'s cookie/session resolution.
 *
 * **Nothing here writes a remaining time.** `startedAt` is stamped from the
 * server's clock and `durationSeconds` is the only thing an extension moves;
 * every reader derives the rest (`domain/countdown.ts`).
 */

export type { StartTimerInput } from './write';

/**
 * Every surface a running timer appears on.
 *
 * No SSE yet (M10 owns realtime), so the hub polls `/api/timers` and this
 * revalidation covers the server-rendered surfaces. `publish()` is already
 * called inside each write seam, so when the stream lands it replaces the
 * poll rather than adding a call site.
 */
async function revalidateTimers(): Promise<void> {
  const locale = await getLocale();
  revalidatePath(`/${locale}/timers`);
  revalidatePath(`/${locale}/hub`);
  revalidatePath(`/${locale}/hub/timers`);
  // M-T2: the fullscreen watch screen.
  revalidatePath(`/${locale}/hub/timer`);
}

export async function startTimerAction(input: StartTimerInput): Promise<StartTimerState> {
  const principal = await assertCan('timer:control', { memberId: input.memberId ?? null }).catch(
    () => null
  );
  if (!principal) return { status: 'error', error: 'forbidden' };

  const result = await startTimer(principal, input);
  await revalidateTimers();
  return result;
}

export type { StopTimerInput } from './write';

export async function stopTimerAction(input: StopTimerInput): Promise<StopTimerState> {
  const principal = await assertCan('timer:control').catch(() => null);
  if (!principal) return { status: 'error', error: 'forbidden' };

  const result = await stopTimer(principal, input);
  await revalidateTimers();
  return result;
}

export type { ExtendTimerInput } from './write';

export async function extendTimerAction(input: ExtendTimerInput): Promise<ExtendTimerState> {
  const principal = await assertCan('timer:control').catch(() => null);
  if (!principal) return { status: 'error', error: 'forbidden' };

  const result = await extendTimer(principal, input);
  await revalidateTimers();
  return result;
}

export type { PauseTimerInput } from './write';

export async function pauseTimerAction(input: PauseTimerInput): Promise<PauseTimerState> {
  const principal = await assertCan('timer:control').catch(() => null);
  if (!principal) return { status: 'error', error: 'forbidden' };

  const result = await pauseTimer(principal, input);
  await revalidateTimers();
  return result;
}

export type { ResumeTimerInput } from './write';

export async function resumeTimerAction(input: ResumeTimerInput): Promise<ResumeTimerState> {
  const principal = await assertCan('timer:control').catch(() => null);
  if (!principal) return { status: 'error', error: 'forbidden' };

  const result = await resumeTimer(principal, input);
  await revalidateTimers();
  return result;
}
