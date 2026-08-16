/**
 * Public surface of the weather slice (docs/architecture.md §2).
 * Cross-module imports go through this file only.
 *
 * **This slice is the data layer and nothing else.** There is no `ui/`
 * directory and no component: the hub's weather widget has not been designed
 * yet, and shipping a placeholder would be a design decision made by the
 * wrong person. What is here is everything the widget will need —
 * `getFamilyWeather(familyId)` for the read, a presentation-agnostic domain
 * model, a cache that is refreshed by a background job, and a settings action
 * for the location.
 *
 * The read never touches the network and never throws (see `queries.ts`), which
 * is what keeps a wall display with no connectivity rendering.
 */

export { weatherSnapshot, type WeatherSnapshotRow } from './schema';

export {
  WEATHER_FORECAST_DAYS,
  WEATHER_FRESH_MS,
  WEATHER_MAX_AGE_MS,
  WEATHER_REFETCH_AFTER_MS,
  WMO_WEATHER_CODES,
  isWmoWeatherCode,
  resolveWeatherView,
  roundCoordinate,
  sameWeatherPlace,
  shouldRefetchWeather,
  weatherPlaceOf,
  type WeatherCacheEntry,
  type WeatherDay,
  type WeatherFreshness,
  type WeatherObservation,
  type WeatherPlace,
  type WeatherPlaceConfig,
  type WeatherSnapshot,
  type WeatherView,
  type WmoWeatherCode,
} from './domain/snapshot';

export {
  OPEN_METEO_CURRENT_FIELDS,
  OPEN_METEO_DAILY_FIELDS,
  OPEN_METEO_FORECAST_URL,
  openMeteoUrl,
  parseOpenMeteo,
} from './domain/open-meteo';

export {
  WEATHER_FETCH_TIMEOUT_MS,
  fetchWeather,
  type WeatherFetchFailure,
  type WeatherFetchOptions,
  type WeatherFetchResult,
} from './client';

export { getFamilyWeather, getWeatherCacheEntry } from './queries';

export {
  listWeatherFamilyIds,
  refreshFamilyWeather,
  type WeatherRefreshFailure,
  type WeatherRefreshOptions,
  type WeatherRefreshOutcome,
} from './refresh';

export {
  WEATHER_QUEUE,
  WEATHER_QUEUE_DEFINITIONS,
  weatherQueueName,
  weatherRefreshSingletonKey,
  type RefreshFamilyWeatherJob,
  type WeatherQueueDefinition,
  type WeatherQueueName,
} from './queues';

export {
  createWeatherQueues,
  enqueueWeatherRefresh,
  registerWeatherJobs,
  runWeatherRefresh,
} from './jobs';

export { setWeatherLocationAction } from './actions';

export { actionFailure, idleState, type ActionState } from './action-state';
