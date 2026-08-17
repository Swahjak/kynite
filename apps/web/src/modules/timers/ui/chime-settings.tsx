'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@kynite/ui';
import { CHIME_INTENSITIES } from '../domain/chime';
import { TIMER_TAP_TARGET_CLASS } from './tokens';
import type { Chime } from './use-chime';

/**
 * The hub's sound control: three intensities and a volume, nothing else.
 *
 * `off` is a first-class option rather than a volume of zero, because "this
 * house does not want a sound" is a different statement from "quiet", and a
 * family that turns it off should not find it back at 10% after an update.
 *
 * Changing the intensity plays the chime once, so the setting is audible while
 * being chosen — which is also, conveniently, the user gesture that unlocks
 * audio in the first place.
 */
export function ChimeSettings({ chime }: { chime: Chime }) {
  const t = useTranslations('timers');
  const { setting, setSetting } = chime;

  return (
    <section data-testid="timer-chime-settings" className="flex flex-wrap items-center gap-4">
      <h2 className="font-display text-h3 font-semibold">{t('chime.title')}</h2>

      <div role="group" aria-label={t('chime.title')} className="flex gap-2">
        {CHIME_INTENSITIES.map((intensity) => (
          // `Button/Primary` when selected, `Button/Secondary` (outline) when
          // not — `docs/design/components.md` § Buttons. Native `<button>`,
          // not the shared `<Button>`, because this is a segmented toggle
          // (`aria-pressed`), not a set of independent actions.
          <button
            key={intensity}
            type="button"
            data-testid={`chime-intensity-${intensity}`}
            aria-pressed={setting.intensity === intensity}
            onClick={() => {
              setSetting({ ...setting, intensity });
              if (intensity !== 'off') chime.play();
            }}
            className={cn(
              TIMER_TAP_TARGET_CLASS,
              'rounded-4xl px-4 font-display text-body-sm font-bold',
              'transition-colors duration-200 ease-brand focus-visible:ring-3 focus-visible:ring-ring/50',
              setting.intensity === intensity
                ? 'bg-primary text-primary-foreground shadow-brand'
                : // The secondary-button shape: a 1px border and no fill. The
                  // selected state is the filled one above, so nothing here is
                  // carrying the 2px emphasis width.
                  'border border-primary bg-transparent text-brand-ink hover:bg-accent'
            )}
          >
            {t(`chime.${intensity}`)}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-3 text-body text-ink-secondary">
        {t('chime.volume')}
        <input
          type="range"
          data-testid="chime-volume"
          min={0}
          max={100}
          step={5}
          value={Math.round(setting.volume * 100)}
          onChange={(event) =>
            setSetting({ ...setting, volume: Number(event.currentTarget.value) / 100 })
          }
          className="h-12 w-40 accent-primary"
        />
      </label>
    </section>
  );
}
