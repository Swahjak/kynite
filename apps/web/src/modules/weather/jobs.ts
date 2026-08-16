import 'server-only';
import type { PgBoss } from 'pg-boss';
import { enqueue } from '@/server/jobs/boss';
import { refreshFamilyWeather, listWeatherFamilyIds } from './refresh';
import {
  WEATHER_QUEUE,
  WEATHER_QUEUE_DEFINITIONS,
  weatherQueueName,
  weatherRefreshSingletonKey,
  type RefreshFamilyWeatherJob,
} from './queues';

/**
 * The weather-refresh handlers, registered from `server/jobs/index.ts`
 * alongside the Google and ICS ones.
 *
 * Small on purpose, like its ICS counterpart: find the households, call the
 * engine, let pg-boss own the retry. `refreshFamilyWeather` returns
 * `{ status: 'failed' }` for anything the *provider* did and writes it onto the
 * row, so nothing thrown here means "Open-Meteo is down" and a throw genuinely
 * is our own fault.
 */

export async function enqueueWeatherRefresh(
  familyId: string,
  options: { force?: boolean } = {}
): Promise<string | null> {
  return enqueue(
    weatherQueueName(WEATHER_QUEUE.refreshFamily),
    { familyId, force: options.force } satisfies RefreshFamilyWeatherJob,
    { singletonKey: weatherRefreshSingletonKey(familyId), retryLimit: 2, retryBackoff: true }
  );
}

/** The `weather:refresh` job body, exported so a test can drive it directly. */
export async function runWeatherRefresh(): Promise<void> {
  for (const familyId of await listWeatherFamilyIds()) {
    await enqueueWeatherRefresh(familyId);
  }
}

/** Creates every queue with its policy. Idempotent — pg-boss upserts. */
export async function createWeatherQueues(boss: PgBoss): Promise<void> {
  for (const definition of WEATHER_QUEUE_DEFINITIONS) {
    await boss.createQueue(weatherQueueName(definition.name), {
      policy: definition.policy ?? 'standard',
      retryLimit: definition.retryLimit,
      retryBackoff: definition.retryBackoff,
    });
  }
}

export async function registerWeatherJobs(boss: PgBoss): Promise<void> {
  await createWeatherQueues(boss);

  await boss.work<RefreshFamilyWeatherJob>(
    weatherQueueName(WEATHER_QUEUE.refreshFamily),
    async (jobs) => {
      for (const job of jobs) {
        await refreshFamilyWeather(job.data.familyId, { force: job.data.force });
      }
    }
  );

  await boss.work(weatherQueueName(WEATHER_QUEUE.refresh), runWeatherRefresh);

  for (const definition of WEATHER_QUEUE_DEFINITIONS) {
    if (!definition.cron) continue;
    await boss.schedule(
      weatherQueueName(definition.name),
      definition.cron,
      {},
      { key: weatherQueueName(definition.name) }
    );
  }
}
