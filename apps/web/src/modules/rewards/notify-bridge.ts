import 'server-only';
import { notifyRedemptionRequested } from '@/modules/notifications';

/**
 * The rewards → notifications edge (docs/architecture.md §6 step 4:
 * "Redemption requests fan out to all adults").
 *
 * Same shape and same reason as `modules/calendar/sync-bridge.ts`: `actions.ts`
 * is a `'use server'` module and its own header forbids importing a slice
 * barrel there, because a barrel re-exports client components. One
 * `server-only` re-export module is the seam that keeps that rule true while
 * still letting a redemption reach the queue.
 *
 * It is also the injection point a test needs: mocking one named export here
 * is how the integration suite proves the fan-out is one job per endpoint
 * without touching a push service.
 */
export const notifyRedemption = notifyRedemptionRequested;
