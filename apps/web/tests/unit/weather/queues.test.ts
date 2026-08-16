import { describe, expect, it } from 'vitest';
import {
  WEATHER_QUEUE,
  WEATHER_QUEUE_DEFINITIONS,
  weatherQueueName,
  weatherRefreshSingletonKey,
} from '@/modules/weather/queues';
import { WEATHER_REFETCH_AFTER_MS } from '@/modules/weather/domain/snapshot';

/**
 * The cadence is a contract with a free public API, so it is asserted rather
 * than left to a comment — the same reason `modules/ics/queues.ts` has a test.
 */

describe('weather queues', () => {
  it('sweeps on a cron that is at least as often as the refetch window', () => {
    const sweep = WEATHER_QUEUE_DEFINITIONS.find((d) => d.name === WEATHER_QUEUE.refresh);

    expect(sweep?.cron).toBe('13,43 * * * *');
    // Half-hourly sweep, 25-minute refetch window: every sweep does real work,
    // and nothing in between can turn into a second call for the same half hour.
    expect(WEATHER_REFETCH_AFTER_MS).toBeLessThan(30 * 60 * 1000);
  });

  it('keeps retries small — a provider that is down must not become a storm', () => {
    for (const definition of WEATHER_QUEUE_DEFINITIONS) {
      expect(definition.retryLimit).toBeLessThanOrEqual(2);
      expect(definition.retryBackoff).toBe(true);
    }
  });

  it('adapts the colon names pg-boss 12 rejects', () => {
    expect(weatherQueueName(WEATHER_QUEUE.refresh)).toBe('weather.refresh');
    expect(weatherQueueName(WEATHER_QUEUE.refreshFamily)).toBe('weather.refresh-family');
  });

  it('keeps one refresh in flight per household', () => {
    expect(weatherRefreshSingletonKey('fam-1')).toBe('fam-1');
    expect(weatherRefreshSingletonKey('fam-1')).not.toBe(weatherRefreshSingletonKey('fam-2'));
  });
});
