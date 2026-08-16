import { getFormatter, getTranslations } from 'next-intl/server';
import { WeatherCard } from '@kynite/ui';
import { weatherSceneFor, weatherVisualFor } from '../domain/visual';
import type { WeatherView } from '../domain/snapshot';

/**
 * The weather card, wired to a `WeatherView`.
 *
 * The split is the package rule: `WeatherCard` in `@kynite/ui` knows how to
 * draw a sky and nothing else — it takes a scene and three already-formatted
 * strings. This file is the half that may know about Dutch, about `Intl`, and
 * about what a WMO code means.
 *
 * ## Only the `ok` state is drawn
 *
 * `unconfigured` and `unavailable` render **nothing at all**, and that is a
 * decision rather than an omission: neither refreshed design export draws an
 * empty state, an error card, a "stel een locatie in" affordance or any entry
 * point to weather settings — grepping both sheets for *bijgewerkt · geleden ·
 * offline · verouderd · niet beschikbaar · locatie* returns zero hits. A
 * placeholder invented here would be a design decision made by the wrong
 * person, and on a kitchen wall an apologetic empty card is worse than a
 * column that simply has one fewer thing in it.
 *
 * `freshness: 'stale'` draws **exactly like `fresh`** for the same reason. The
 * design has no age label, no dimming and no badge, so a stale reading is
 * shown plainly. The data layer already refuses to hand over anything older
 * than 24 hours (`WEATHER_MAX_AGE_MS`), which is what keeps that honest.
 */

export type WeatherWidgetProps = {
  view: WeatherView;
  /** `hub` is the wall's full-size card; `phone` the compact one. */
  density?: 'hub' | 'phone';
  className?: string;
};

export async function WeatherWidget({ view, density = 'hub', className }: WeatherWidgetProps) {
  if (view.status !== 'ok') return null;

  const t = await getTranslations('weather');
  const format = await getFormatter();

  const { current, forecast, place } = view.snapshot;
  const degrees = (celsius: number) => `${format.number(Math.round(celsius))}°`;

  // Index 0 is today at the location (`domain/snapshot.ts`), so this is today's
  // high and low rather than a rolling window.
  const today = forecast[0];

  /**
   * "Utrecht · 23° / 14°" — assembled here rather than as an ICU message,
   * because every part of it is either a household's own word for a place or a
   * number, and the two separators are punctuation the sheet draws identically
   * in both locales. A translation key would be a message with no words in it.
   */
  const meta =
    [
      place.label,
      today ? `${degrees(today.maxTemperatureC)} / ${degrees(today.minTemperatureC)}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || undefined;

  return (
    <WeatherCard
      scene={weatherSceneFor(current)}
      temperature={degrees(current.temperatureC)}
      condition={t(`condition.${weatherVisualFor(current)}`)}
      meta={meta}
      density={density}
      className={className}
    />
  );
}
