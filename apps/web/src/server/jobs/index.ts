import 'server-only';
import { registerGoogleJobs } from '@/modules/google';
import { registerIcsJobs } from '@/modules/ics';
import { registerNotificationJobs } from '@/modules/notifications';
import { jobsEnabled, startBoss, stopBoss } from './boss';
import { registerMaintenanceJobs } from './maintenance';

/**
 * Worker bootstrap (docs/architecture.md §10: "One process; jobs in-process").
 *
 * The registration graph lives here rather than in `boss.ts` so slices can
 * enqueue work by importing the lifecycle module alone — otherwise every
 * `enqueue()` would drag in every handler and cycle back on itself.
 */

let started: Promise<void> | undefined;

export async function startJobs(): Promise<void> {
  if (!jobsEnabled()) return;

  started ??= (async () => {
    const boss = await startBoss();
    await registerGoogleJobs(boss);
    await registerIcsJobs(boss);
    await registerNotificationJobs(boss);
    await registerMaintenanceJobs(boss);
  })();

  return started;
}

export async function stopJobs(): Promise<void> {
  started = undefined;
  await stopBoss();
}

export { enqueue, getBoss, jobsEnabled } from './boss';
