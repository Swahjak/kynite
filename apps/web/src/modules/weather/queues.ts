/**
 * Queue names, policies and schedules for the weather refresh.
 *
 * Declarative and dependency-free, exactly like `modules/ics/queues.ts` and
 * `modules/google/queues.ts`, so the cadence can be asserted without a
 * database — it is a contract with somebody else's free API, not an
 * implementation detail.
 */

export const WEATHER_QUEUE = {
  /** One household, one call to Open-Meteo. Enqueued by the sweep and on a location change. */
  refreshFamily: 'weather:refresh-family',
  /** The half-hourly sweep that enqueues one of the above per configured household. */
  refresh: 'weather:refresh',
} as const;

export type WeatherQueueName = (typeof WEATHER_QUEUE)[keyof typeof WEATHER_QUEUE];

export type WeatherQueueDefinition = {
  name: WeatherQueueName;
  policy?: 'standard' | 'stately';
  retryLimit: number;
  retryBackoff: boolean;
  cron?: string;
};

/**
 * **Half-hourly**, at `:13` and `:43`.
 *
 * Open-Meteo refreshes its own current-conditions field every 15 minutes and
 * its model runs a few times a day, so a sweep faster than this buys a wall
 * display nothing and spends somebody else's free capacity. It pairs with
 * `WEATHER_REFETCH_AFTER_MS` (25 min): every sweep is far enough past the
 * window to do real work, and anything that fires in between — a location
 * change, a second worker process — is a cache hit rather than a second call.
 *
 * The odd minutes keep the sweep off the hour (the Google poll and channel
 * renewal) and off `:07` (the ICS sweep).
 *
 * **`retryLimit: 2`.** A refresh only throws for a *local* fault; every remote
 * failure is caught, recorded on the row and reported as a normal outcome (see
 * `refresh.ts`), precisely so a provider outage cannot become a retry storm
 * against a free API.
 */
export const WEATHER_QUEUE_DEFINITIONS: WeatherQueueDefinition[] = [
  {
    name: WEATHER_QUEUE.refreshFamily,
    policy: 'stately',
    retryLimit: 2,
    retryBackoff: true,
  },
  {
    name: WEATHER_QUEUE.refresh,
    policy: 'stately',
    retryLimit: 2,
    retryBackoff: true,
    cron: '13,43 * * * *',
  },
];

/**
 * pg-boss 12 rejects the `:` in the documented queue names; the colon form
 * stays the vocabulary of the codebase and this is the adapter at the boundary,
 * exactly as `modules/ics/queues.ts` does it.
 */
export function weatherQueueName(name: WeatherQueueName): string {
  return name.replace(':', '.');
}

export type RefreshFamilyWeatherJob = {
  familyId: string;
  /** Set by a location change: refetch even on a cache hit. */
  force?: boolean;
};

/** One refresh in flight per household. */
export function weatherRefreshSingletonKey(familyId: string): string {
  return familyId;
}
