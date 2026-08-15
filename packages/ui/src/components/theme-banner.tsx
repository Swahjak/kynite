import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * The theme banner — one full-width row that says what today *is*.
 *
 * It appears on the handful of days a year that mean something to a household
 * (`Pages/Vandaag — thema's`, `Pages/Feestdagen & vakanties`), above the
 * columns of the Vandaag screen. Three rules the shape carries, all of them
 * decisions rather than styling:
 *
 * - **It adds, it does not rearrange.** The banner is a row *above* the day's
 *   columns, and the NU block keeps its place and its job underneath. A wall
 *   display that reshuffled itself six times a year is a display nobody can
 *   read at a glance any more, and decoration does not get to outrank the
 *   routine a child is standing in front of.
 * - **The tile is the brand mark, wearing the day's colours.** "Het
 *   icoon-tegeltje volgt de opbouw van het merkicoon (gelaagde kleurcirkels)"
 *   — a rounded square that clips two oversized circles bleeding off opposite
 *   corners, with a white silhouette on top. That construction is the one
 *   thing every Kynite surface shares, so a holiday tile reads as *this
 *   product being festive* rather than as a sticker somebody put on it. Pass
 *   `tile` and `glyph` to get it; pass neither and the banner falls back to
 *   the plain emoji tile, which is a weaker but never a broken result.
 * - **The decoration is ambient and mute.** `decor` is a layer of drifting,
 *   falling or flying shapes in the card's right third — `FloatingPiece` and
 *   `ConfettiBurst` build them. It is `aria-hidden`, it cannot be tapped, and
 *   it carries no information the eyebrow does not already give in words.
 *
 * The accent arrives as a class pair rather than a hue name, for the reason
 * every colour in this package does: Tailwind scans source text, so a
 * `bg-cat-${accent}-surface` template would never be generated. The app
 * resolves it (`CATEGORY_CLASSES[day.accent]`) and hands it in.
 *
 * The countdown is the one number small children ask for by themselves, so it
 * gets a white card and indigo figures. On the day itself the caller passes no
 * `countdown` at all rather than a zero — "nog 0 dagen" is not a thing to say.
 */

export type ThemeBannerTile = {
  /** The rounded square's own ground — `bg-cat-*-deep` or `bg-cat-*-solid`. */
  groundClass: string;
  /** The circle bleeding off the top-left corner. */
  backClass: string;
  /** The circle bleeding off the bottom-right corner. */
  frontClass: string;
};

export type ThemeBannerProps = Omit<React.ComponentProps<'div'>, 'title'> & {
  /**
   * The day's own glyph — `🎄`, `🎁`, `🎃`. Decorative; the title names the
   * day. Used as the tile's silhouette when no `glyph` is given.
   */
  emoji?: string;
  /** The day's name, set as the overline: "KERST", "ZOMERVAKANTIE". */
  eyebrow: React.ReactNode;
  /** The headline — what the day means for this household. */
  title: React.ReactNode;
  /** One quiet line under it: the date, and the house rule for the day. */
  meta?: React.ReactNode;
  /** `CATEGORY_CLASSES[accent].surface` — the tinted ground. */
  surfaceClass?: string;
  /** `CATEGORY_CLASSES[accent].text` — the ink that reads on it. */
  textClass?: string;
  /**
   * The brand-mark tile's three colour layers. Without it the tile stays the
   * plain emoji-on-card fallback.
   */
  tile?: ThemeBannerTile;
  /**
   * The white silhouette inside the tile — a Material glyph, or the small CSS
   * shapes the sheet draws for the days no icon font carries (a mitre, a
   * pumpkin, a fir tree). Rendered in white on the tile's colour, so it should
   * be a shape, not a picture.
   */
  glyph?: React.ReactNode;
  /**
   * `bg-cat-*-strong` — the eyebrow's pill. Without it the eyebrow stays a
   * plain overline in the banner's own ink.
   */
  eyebrowClass?: string;
  /** The ambient layer: `FloatingPiece`s, and sometimes a `ConfettiBurst`. */
  decor?: React.ReactNode;
  /**
   * "nog 3 dagen", as its own card. Omitted on the day itself; `value` is the
   * figure and the two labels are already translated by the caller.
   */
  countdown?: { value: number; prefixLabel: string; unitLabel: string };
};

export function ThemeBanner({
  emoji,
  eyebrow,
  title,
  meta,
  surfaceClass,
  textClass,
  tile,
  glyph,
  eyebrowClass,
  decor,
  countdown,
  className,
  ...props
}: ThemeBannerProps) {
  return (
    <div
      data-slot="theme-banner"
      className={cn(
        // `relative` + `overflow-hidden` are what make the decoration possible
        // at all: every floating piece is positioned against this box and
        // clipped by it, so a leaf falls *past* the card rather than out into
        // the page and over whatever sits below.
        'relative flex w-full items-center gap-4 overflow-hidden rounded-2xl p-4 shadow-sm sm:p-5',
        surfaceClass,
        textClass,
        className
      )}
      {...props}
    >
      {decor}

      {tile ? (
        <span
          aria-hidden="true"
          data-slot="theme-banner-tile"
          className={cn(
            'relative isolate flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl sm:size-16',
            tile.groundClass
          )}
        >
          {/* Both circles are wider than the tile and bleed off opposite
              corners, so the tile shows three colours meeting at angles no
              single gradient makes — the brand mark's whole trick. */}
          <span
            className={cn('absolute -top-1/4 -left-1/3 size-full rounded-full', tile.backClass)}
          />
          <span
            className={cn(
              'absolute -right-1/3 -bottom-1/4 size-full rounded-full',
              tile.frontClass
            )}
          />
          <span className="relative flex items-center justify-center text-white drop-shadow-[0_1px_3px_rgb(0_0_0/0.3)]">
            {glyph ?? <span className="text-2xl leading-none">{emoji}</span>}
          </span>
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="relative flex size-12 shrink-0 items-center justify-center rounded-4xl bg-card/70 sm:size-16"
        >
          <span className="absolute inset-1.5 rounded-4xl bg-card/80" />
          <span className="relative text-2xl leading-none">{emoji}</span>
        </span>
      )}

      <div className="relative min-w-0 flex-1">
        {eyebrowClass ? (
          <span
            className={cn(
              'label-overline inline-flex items-center rounded-full px-2.5 py-0.5 text-white',
              eyebrowClass
            )}
          >
            {eyebrow}
          </span>
        ) : (
          <span className="label-overline block opacity-80">{eyebrow}</span>
        )}
        <p className={cn('font-display text-h3 font-bold', eyebrowClass && 'mt-1.5')}>{title}</p>
        {meta ? <p className="text-body-sm opacity-90">{meta}</p> : null}
      </div>

      {countdown ? (
        <div className="relative flex min-w-[76px] shrink-0 flex-col items-center rounded-xl bg-card px-4 py-2.5 text-brand shadow-md">
          <span className="label-overline text-ink-muted">{countdown.prefixLabel}</span>
          <span className="font-display text-h2 font-extrabold tabular-nums">
            {countdown.value}
          </span>
          <span className="label-overline text-ink-muted">{countdown.unitLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
