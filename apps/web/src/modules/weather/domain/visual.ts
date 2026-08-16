import type { WmoWeatherCode } from './snapshot';

/**
 * WMO code → what the wall actually draws.
 *
 * `domain/snapshot.ts` deliberately stops at the integer: *"There is no icon
 * name here, no colour class and no translated string … The mapping from WMO
 * code to an icon … belongs to the UI layer"*. This is that mapping, kept
 * beside the model rather than inside a component because it is a table of
 * decisions, and a table of decisions is a thing to test.
 *
 * Framework-free, like the rest of `domain/`: the scene names are a string
 * union that matches `WeatherScene` in `@kynite/ui` structurally, so the
 * wrapper passes one straight into the other without this file importing the
 * design system.
 *
 * ## Totality
 *
 * `WMO_WEATHER_VISUALS` is a `Record<WmoWeatherCode, WeatherVisual>`, not a
 * lookup with a fallback. A code with no entry is a *compile* error; a
 * fallback would have been a sun drawn over a thunderstorm, silently, with
 * nothing to fail. `tests/unit/weather/visual.test.ts` holds the same line at
 * runtime by walking `WMO_WEATHER_CODES`.
 *
 * ## The twelve, and the two that data can never reach
 *
 * The design sheet's "Weertypes" grid names twelve. Two of them are
 * unreachable from a weather code, by owner decision:
 *
 * - **`wind`** — WMO 4677 carries no wind state at all, and
 *   `WeatherObservation` carries no wind field. It could only ever be driven
 *   by a windspeed threshold the data layer does not fetch. Not added: a
 *   visual is not a reason to grow the model.
 * - **`hail`** — WMO has no hail code. Its only candidates, 96 and 99, are
 *   *thunderstorm with slight / heavy hail*, and a thunderstorm is what a
 *   household needs to see. So 95/96/99 all render as thunder.
 *
 * Both stay in `WEATHER_VISUALS` because the design system draws them; neither
 * is in the table below.
 *
 * ## The folds
 *
 * - **Freezing drizzle (56, 57) → `drizzle`**, and **freezing rain (66, 67) →
 *   `rain`**. The sheet has no icy variant, and freezing rain is rain that
 *   freezes on contact — it falls as rain and looks like rain. Folding it into
 *   snow would draw the wrong sky for a wet road.
 * - **Snow grains (77) and snow showers (85, 86) → `snow`**; **rain showers
 *   (80, 81, 82) → `rain`**. Intensity and shower-vs-steady are distinctions
 *   the twelve visuals do not make.
 * - **Overcast (3) → `cloudy`**, and `cloudy` shares the `partly-cloudy`
 *   *card scene*: the sheet draws five card themes, not twelve, and of those
 *   five it is the only sky with cloud and no rain.
 *
 * ## Day and night
 *
 * The sheet draws a night twin for exactly two types — `clear_night` and
 * `partly_cloudy_night` — and a single "Nacht" card theme. So `isDay: false`
 * selects a night visual for clear and partly-cloudy and **falls through to
 * the day visual for everything else**. Rain, snow, fog and thunder have no
 * night treatment in the design and none is invented here.
 */

export const WEATHER_VISUALS = [
  'sunny',
  'partly-cloudy',
  'cloudy',
  'rain',
  'drizzle',
  'thunder',
  'snow',
  'hail',
  'fog',
  'wind',
  'clear-night',
  'partly-cloudy-night',
] as const;

export type WeatherVisual = (typeof WEATHER_VISUALS)[number];

/** Matches `WeatherScene` in `@kynite/ui` — see the note above. */
export type WeatherCardScene = 'sunny' | 'partly-cloudy' | 'rain' | 'storm' | 'night';

/** Every code Open-Meteo can send, by day. Exhaustive by type. */
export const WMO_WEATHER_VISUALS: Record<WmoWeatherCode, WeatherVisual> = {
  0: 'sunny',
  1: 'partly-cloudy',
  2: 'partly-cloudy',
  3: 'cloudy',
  45: 'fog',
  48: 'fog',
  51: 'drizzle',
  53: 'drizzle',
  55: 'drizzle',
  56: 'drizzle',
  57: 'drizzle',
  61: 'rain',
  63: 'rain',
  65: 'rain',
  66: 'rain',
  67: 'rain',
  71: 'snow',
  73: 'snow',
  75: 'snow',
  77: 'snow',
  80: 'rain',
  81: 'rain',
  82: 'rain',
  85: 'snow',
  86: 'snow',
  95: 'thunder',
  96: 'thunder',
  99: 'thunder',
};

/** The only two day→night substitutions the design sheet draws. */
const NIGHT_VISUALS: Partial<Record<WeatherVisual, WeatherVisual>> = {
  sunny: 'clear-night',
  'partly-cloudy': 'partly-cloudy-night',
};

/** Twelve types onto the sheet's five card themes. */
export const WEATHER_VISUAL_SCENES: Record<WeatherVisual, WeatherCardScene> = {
  sunny: 'sunny',
  'partly-cloudy': 'partly-cloudy',
  // No sunless daytime sky exists in the sheet. Between drawing a sun that is
  // behind cloud anyway and drawing rain that is not falling, the sun is the
  // smaller lie.
  cloudy: 'partly-cloudy',
  fog: 'partly-cloudy',
  wind: 'partly-cloudy',
  rain: 'rain',
  drizzle: 'rain',
  snow: 'rain',
  hail: 'rain',
  thunder: 'storm',
  'clear-night': 'night',
  'partly-cloudy-night': 'night',
};

export function weatherVisualFor(observation: {
  weatherCode: WmoWeatherCode;
  isDay: boolean;
}): WeatherVisual {
  const visual = WMO_WEATHER_VISUALS[observation.weatherCode];

  if (observation.isDay) return visual;

  return NIGHT_VISUALS[visual] ?? visual;
}

export function weatherSceneFor(observation: {
  weatherCode: WmoWeatherCode;
  isDay: boolean;
}): WeatherCardScene {
  return WEATHER_VISUAL_SCENES[weatherVisualFor(observation)];
}
