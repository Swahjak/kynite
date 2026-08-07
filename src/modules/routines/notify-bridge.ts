import 'server-only';
import { notifyRoutineCompleted } from '@/modules/notifications';

/**
 * The routines → notifications edge (PRD FR22, M18).
 *
 * Identical shape and identical reason to `modules/rewards/notify-bridge.ts`:
 * the write this hangs off (`recordCompletion` in `./complete.ts`) is reached
 * from `./actions.ts`, a `'use server'` module whose own header forbids
 * importing a slice barrel — a barrel re-exports client components, which must
 * not enter a server mutation module. One `server-only` re-export is the seam
 * that keeps that rule true while still letting a child's tap reach a parent's
 * phone.
 *
 * It is also the injection point the integration suite needs: mocking this one
 * named export is how a test proves the fan-out happens (and, more usefully,
 * that it does *not* happen on a replay) without touching a push service.
 */
export const notifyCompletion = notifyRoutineCompleted;
