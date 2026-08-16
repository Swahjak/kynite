import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * The weather card — *"de hele kaart draagt het weer"*.
 *
 * "Kynite Design System" § "Weer-widget · kaartthema per weertype", and it is
 * the variant the Vandaag sheet actually places: at the head of the hub's
 * third column (`Vandaag.dc.html`:145) and above "Dagoverzicht" on the phone
 * (`:384). The sheet's other four weather treatments — the white-card hub
 * widget, the compact thumbnail row, the forecast modal and the mobile bottom
 * sheet — are not composed into either page, so they are not built here.
 *
 * The card is a **sky, not a surface**: a three-stop gradient with a moving
 * layer pinned to its right edge, and the text left on the quiet part of the
 * gradient. That is why it does not build on `Card`, and why its ink comes
 * from `--weather-*` rather than from `--ink*` — on the Nacht scene all of it
 * is white.
 *
 * ## What it does not draw
 *
 * The sheet's footer strip (rain chance, wind speed, a "7 dagen" link) is
 * absent. Not a simplification — the data layer carries none of it:
 * `WeatherObservation` has no wind field and no precipitation probability
 * (`modules/weather/domain/open-meteo.ts` requests neither), and there is no
 * forecast surface for "7 dagen" to open. A footer of invented numbers is
 * worse than no footer.
 *
 * There is also no glyph anywhere on this card. The twelve animated weather
 * icons live on the type tiles and the forecast rows, neither of which the
 * Vandaag composition places — see the ramp note in `tokens.css`.
 *
 * ## Two densities, one geometry
 *
 * The sheet draws the phone card at ~0.71 of the hub card's scenery, stage
 * included (210px → 150px). So the scenery is authored **once**, at hub size,
 * and the phone density scales it from its top-right corner. One set of
 * numbers to keep true to the sheet instead of two that drift.
 */

export type WeatherScene = 'sunny' | 'partly-cloudy' | 'rain' | 'storm' | 'night';

export type WeatherCardProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /**
   * Which sky to draw. Five, keyed on the *scene* rather than on the twelve
   * weather types — the sheet draws five card themes and the types fold into
   * them (`modules/weather/domain/visual.ts` owns that fold).
   */
  scene: WeatherScene;
  /** Already formatted and already suffixed, e.g. `"21°"`. */
  temperature: string;
  /** Already translated, e.g. `"Half bewolkt"`. */
  condition: string;
  /**
   * The line under it — place, high and low, already joined and formatted
   * (`"Utrecht · 23° / 14°"`). Omitted when the household named no place and
   * there is no forecast day to read a high/low off.
   */
  meta?: string;
  density?: 'hub' | 'phone';
};

/** The sheet's hub scenery stage. The phone's 150px is this, scaled. */
const STAGE_WIDTH = 210;
const PHONE_STAGE_WIDTH = 150;
const PHONE_SCALE = PHONE_STAGE_WIDTH / STAGE_WIDTH;

/** `linear-gradient(115deg, …)` — the stop positions differ per scene. */
const SCENE_GRADIENT: Record<WeatherScene, string> = {
  sunny:
    'linear-gradient(115deg,var(--weather-sunny-from) 0%,var(--weather-sunny-via) 60%,var(--weather-sunny-to) 100%)',
  'partly-cloudy':
    'linear-gradient(115deg,var(--weather-partly-cloudy-from) 0%,var(--weather-partly-cloudy-via) 45%,var(--weather-partly-cloudy-to) 100%)',
  rain: 'linear-gradient(115deg,var(--weather-rain-from) 0%,var(--weather-rain-via) 55%,var(--weather-rain-to) 100%)',
  storm:
    'linear-gradient(115deg,var(--weather-storm-from) 0%,var(--weather-storm-via) 55%,var(--weather-storm-to) 100%)',
  night:
    'linear-gradient(115deg,var(--weather-night-from) 0%,var(--weather-night-via) 55%,var(--weather-night-to) 100%)',
};

const SCENE_BORDER: Record<WeatherScene, string> = {
  sunny: 'var(--weather-sunny-border)',
  'partly-cloudy': 'var(--weather-partly-cloudy-border)',
  rain: 'var(--weather-rain-border)',
  storm: 'var(--weather-storm-border)',
  night: 'var(--weather-night-border)',
};

export function WeatherCard({
  scene,
  temperature,
  condition,
  meta,
  density = 'hub',
  className,
  style,
  ...props
}: WeatherCardProps) {
  const phone = density === 'phone';

  return (
    <div
      data-slot="weather-card"
      data-scene={scene}
      data-density={density}
      className={cn(
        'relative overflow-hidden border',
        // Raw px: the sheet gives this card 20/16px radius and 18·20 / 12·14
        // padding as literals, and neither lands on `--radius-*`.
        phone ? 'rounded-[16px] px-3.5 py-3' : 'rounded-[20px] px-5 py-[18px]',
        className
      )}
      style={{
        background: SCENE_GRADIENT[scene],
        borderColor: SCENE_BORDER[scene],
        // Nacht carries its own ink at every density; the four day scenes take
        // the page's, which the `.dark` block flips for them.
        ...(scene === 'night'
          ? {
              '--weather-ink': 'var(--weather-night-ink)',
              '--weather-ink-secondary': 'var(--weather-night-ink-secondary)',
              '--weather-ink-meta': 'var(--weather-night-ink-meta)',
              '--weather-rule': 'var(--weather-night-rule)',
            }
          : {}),
        ...style,
      }}
      {...props}
    >
      <Scenery scene={scene} phone={phone} />

      <div className="relative flex min-w-0 flex-col">
        <div className={cn('flex items-baseline', phone ? 'gap-2' : 'gap-2.5')}>
          <span
            className={cn(
              'font-display font-extrabold text-weather-ink tabular-nums',
              phone ? 'text-[26px]/none' : 'text-[44px]/none tracking-[-0.02em]'
            )}
          >
            {temperature}
          </span>
          <span
            className={cn(
              'font-display font-bold text-weather-ink-secondary',
              phone ? 'text-[13px]' : 'text-body'
            )}
          >
            {condition}
          </span>
        </div>

        {meta ? (
          <span
            className={cn(
              'truncate text-weather-ink-meta tabular-nums',
              phone ? 'mt-0.5 text-[11px]' : 'mt-1 text-[13px]'
            )}
          >
            {meta}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The moving layer, pinned to the right edge and clipped by it.
 *
 * `aria-hidden` throughout: it is a picture of the sky, and the sentence a
 * screen reader needs is the temperature and the condition beside it.
 */
function Scenery({ scene, phone }: { scene: WeatherScene; phone: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 overflow-hidden"
      style={{ width: phone ? PHONE_STAGE_WIDTH : STAGE_WIDTH }}
    >
      <div
        className="absolute top-0 right-0 h-full origin-top-right"
        style={{
          width: STAGE_WIDTH,
          transform: phone ? `scale(${PHONE_SCALE})` : undefined,
        }}
      >
        {scene === 'sunny' ? (
          <Sun stage={176} right={-34} top={-42} disc={72} />
        ) : scene === 'partly-cloudy' ? (
          <>
            <Sun stage={150} right={-26} top={-34} disc={58} />
            <Cloud left={0} top={44} width={52} height={18} alpha={0.9} duration={34} delay={0} />
            <Cloud left={0} top={78} width={37} height={13} alpha={0.6} duration={46} delay={18} />
          </>
        ) : scene === 'rain' ? (
          <>
            <Cloud left={0} top={20} width={65} height={23} alpha={0.97} duration={40} delay={0} />
            <Cloud left={0} top={52} width={44} height={15} alpha={0.75} duration={52} delay={22} />
            <Drop left={54} top={46} delay={0} />
            <Drop left={82} top={52} delay={0.4} />
            <Drop left={110} top={44} delay={0.8} />
            <Drop left={138} top={50} delay={0.25} />
            <Drop left={166} top={46} delay={0.65} />
          </>
        ) : scene === 'storm' ? (
          <>
            <Cloud left={0} top={20} width={65} height={23} alpha={0.97} duration={40} delay={0} />
            <Drop left={70} top={48} delay={0} />
            <Drop left={130} top={52} delay={0.5} />
            <Bolt left={100} top={46} />
          </>
        ) : (
          <>
            <Moon />
            <Cloud left={0} top={60} width={47} height={16} alpha={0.35} duration={46} delay={10} />
          </>
        )}
      </div>
    </div>
  );
}

/** Ray disc plus breathing sun, in one wrapper hung off the stage's corner. */
function Sun({
  stage,
  right,
  top,
  disc,
}: {
  stage: number;
  right: number;
  top: number;
  disc: number;
}) {
  return (
    <span
      className="pointer-events-none absolute"
      style={{ right, top, width: stage, height: stage }}
    >
      <span
        className="kynite-rays absolute inset-0 rounded-full"
        style={{
          background:
            'repeating-conic-gradient(from 0deg,var(--weather-ray) 0 5deg, transparent 5deg 30deg)',
          // Both spellings: WebKit still needs the prefixed property here.
          WebkitMaskImage:
            'radial-gradient(circle, transparent 30%, #000 34%, #000 66%, transparent 74%)',
          maskImage:
            'radial-gradient(circle, transparent 30%, #000 34%, #000 66%, transparent 74%)',
        }}
      />
      <span
        className="kynite-breathe absolute rounded-full"
        style={{
          left: (stage - disc) / 2,
          top: (stage - disc) / 2,
          width: disc,
          height: disc,
          background:
            'radial-gradient(circle at 36% 32%,var(--weather-sun-core),var(--weather-sun-edge))',
          boxShadow: '0 0 30px var(--weather-sun-glow)',
        }}
      />
    </span>
  );
}

/** Halo plus moon — the Nacht scene's answer to `Sun`. */
function Moon() {
  return (
    <span
      className="pointer-events-none absolute"
      style={{ right: -18, top: -30, width: 130, height: 130 }}
    >
      <span
        className="kynite-breathe absolute rounded-full"
        style={{
          inset: '18%',
          background:
            'radial-gradient(circle,var(--weather-halo) 40%,rgb(190 205 255 / 0.1) 70%,transparent 78%)',
        }}
      />
      <span
        className="kynite-breathe absolute rounded-full"
        style={{
          left: 42,
          top: 42,
          width: 46,
          height: 46,
          background:
            'radial-gradient(circle at 36% 32%,var(--weather-sun-core),var(--weather-moon-edge))',
          boxShadow: '0 0 30px var(--weather-moon-glow)',
        }}
      />
    </span>
  );
}

/**
 * One cloud. The sheet builds each from a pill plus two offset box-shadows,
 * and every instance's offsets are the same fractions of its own size —
 * `0.29w / -0.44h / -0.17h` for the upper puff and `-0.25w / -0.22h / -0.28h`
 * for the trailing one, with the trailing puff at 0.9 of the alpha. Derived
 * rather than retyped per cloud: six clouds of five different sizes is five
 * chances to fat-finger a shadow.
 */
function Cloud({
  left,
  top,
  width,
  height,
  alpha,
  duration,
  delay,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  alpha: number;
  /** Seconds. */
  duration: number;
  /** Seconds, applied negative so the cloud starts mid-crossing. */
  delay: number;
}) {
  const puff = `${Math.round(0.29 * width)}px ${-Math.round(0.44 * height)}px 0 ${-Math.round(0.17 * height)}px rgb(255 255 255 / ${alpha})`;
  const trail = `${-Math.round(0.25 * width)}px ${-Math.round(0.22 * height)}px 0 ${-Math.round(0.28 * height)}px rgb(255 255 255 / ${alpha * 0.9})`;

  return (
    <span
      className="kynite-cloud-wide absolute rounded-full"
      style={{
        left,
        top,
        width,
        height,
        background: `rgb(255 255 255 / ${alpha})`,
        boxShadow: `${puff}, ${trail}`,
        animationDuration: `${duration}s`,
        animationDelay: `-${delay}s`,
      }}
    />
  );
}

/** A 3×13px raindrop falling the height of the card. */
function Drop({ left, top, delay }: { left: number; top: number; delay: number }) {
  return (
    <span
      className="kynite-drop-lg absolute rounded-full"
      style={{
        left,
        top,
        width: 3,
        height: 13,
        background: 'var(--weather-drop)',
        animationDelay: `-${delay}s`,
      }}
    />
  );
}

/** The storm's flash — a CSS triangle, as the sheet draws it. */
function Bolt({ left, top }: { left: number; top: number }) {
  return (
    <span
      className="kynite-bolt absolute"
      style={{
        left,
        top,
        width: 0,
        height: 0,
        borderLeft: '7px solid transparent',
        borderRight: '7px solid transparent',
        borderTop: '22px solid var(--weather-bolt)',
      }}
    />
  );
}
