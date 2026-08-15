import { getTranslations } from 'next-intl/server';
import { FloatingPiece, Icon, ThemeBanner, type IconName } from '@kynite/ui';
import { formatDateTime } from '@/i18n/formatting-locale';
import { CATEGORY_CLASSES } from '@/modules/calendar';
import { getHouseholdFormattingLocale } from '@/modules/family';
import {
  SPECIAL_DAYS_NL,
  specialDaysOn,
  upcomingCountdown,
  type SpecialDaySlug,
} from '@/modules/holidays';

/**
 * The day's theme row, resolved from the calendar date (M26 / wave D1).
 *
 * There is no setting and nothing to configure: a special day is arithmetic
 * (`modules/holidays/domain/nl.ts`), so the banner *is* the date. Two cases,
 * and only ever one of them at a time:
 *
 * - **The day itself** — Kerst, Koningsdag, Pakjesavond. The banner names it,
 *   and carries no counter, because "nog 0 dagen" is not a thing to say.
 * - **A day a child is counting** — the ten nights before Pakjesavond or
 *   Eerste Kerstdag. The same banner for the day ahead, with the white
 *   countdown card that is the one number small children ask for by name.
 *
 * Anything else renders nothing, which is most of the year and the point: a
 * screen that was festive seventeen times a year would be a screen a family
 * stops seeing.
 *
 * The accent is the day's own, out of the same eight hues the calendar's
 * categories use — a holiday is a sorting signal like any other, and a ninth
 * colour would only be a second language. What this file adds on top of the
 * package's `ThemeBanner` is the three things the package may not know: which
 * hue a slug wears, which Material glyph stands in for its silhouette, and how
 * many pieces of weather drift across its right-hand third.
 */

/**
 * The tile's silhouette, for the days a Material glyph honestly reads as.
 *
 * The icon font is a hard-capped 64 KB subset (73 glyphs,
 * `scripts/subset-icons.mjs`) and it holds no mitre, no pumpkin, no Easter egg
 * and no crown. Rather than press a wrong glyph into service — `dark_mode` does
 * not say Halloween — the days it has nothing for fall back to the package's
 * emoji tile, which is a weaker but never a broken result and is what the design
 * sheet draws anyway. The eyebrow names the day in words either way; the tile is
 * decoration and the words are the fact.
 */
const THEME_ICON: Partial<Record<SpecialDaySlug, IconName>> = {
  newYear: 'celebration',
  animalDay: 'pets',
  sinterklaas: 'redeem',
  christmasDay: 'park',
  boxingDay: 'park',
  newYearsEve: 'celebration',
};

/**
 * How the day's weather moves, and what it is made of.
 *
 * Same subset constraint, same answer: a day with no glyph gets no ambient
 * layer rather than a wrong one. Kerst falls as stars, which is what the design
 * sheet draws for it; the gift-bearing days drift.
 */
const THEME_DECOR: Partial<Record<SpecialDaySlug, { icon: IconName; motion: 'drift' | 'fall' }>> = {
  newYear: { icon: 'celebration', motion: 'drift' },
  animalDay: { icon: 'pets', motion: 'drift' },
  sinterklaas: { icon: 'redeem', motion: 'drift' },
  christmasDay: { icon: 'star', motion: 'fall' },
  boxingDay: { icon: 'star', motion: 'fall' },
  newYearsEve: { icon: 'celebration', motion: 'drift' },
};

/** Four pieces, and the whole effect is that they do not agree. */
const PIECES = [
  { left: '68%', top: '18%', size: 20, rotate: -12, duration: 4.2, delay: 0 },
  { left: '79%', top: '58%', size: 16, rotate: 9, duration: 5.6, delay: 0.9 },
  { left: '88%', top: '26%', size: 22, rotate: 16, duration: 4.9, delay: 1.7 },
  { left: '95%', top: '64%', size: 14, rotate: -7, duration: 6.3, delay: 2.4 },
];

export type TodayThemeBannerProps = {
  /** Household-local `YYYY-MM-DD` of the day being shown. */
  dayKey: string;
  /** False while browsing another day: a countdown under yesterday's date is a wrong number. */
  isToday: boolean;
  timeZone: string;
};

export async function TodayThemeBanner({ dayKey, isToday, timeZone }: TodayThemeBannerProps) {
  const t = await getTranslations('holidays');
  const formattingLocale = await getHouseholdFormattingLocale();

  const today = specialDaysOn(dayKey).at(0);
  const countdown = today || !isToday ? null : upcomingCountdown(dayKey);

  const slug: SpecialDaySlug | undefined = today?.slug ?? countdown?.slug;
  if (!slug) return null;

  const definition = SPECIAL_DAYS_NL.find((day) => day.slug === slug);
  if (!definition) return null;

  // The date the banner is *about*: today's own, or the day being counted to.
  const dateKey = today?.date ?? definition.on(Number(dayKey.slice(0, 4)));
  const [year, month, day] = dateKey.split('-').map(Number);
  const palette = CATEGORY_CLASSES[definition.accent];
  const glyph = THEME_ICON[slug];
  const decor = THEME_DECOR[slug];

  return (
    <ThemeBanner
      data-testid="today-theme-banner"
      data-slug={slug}
      emoji={definition.emoji}
      eyebrow={t(`days.${slug}`)}
      title={t(`banner.${slug}`)}
      meta={formatDateTime(new Date(Date.UTC(year, month - 1, day, 12)), formattingLocale, {
        day: 'numeric',
        month: 'long',
        timeZone,
      })}
      surfaceClass={palette.surface}
      textClass={palette.text}
      // The brand mark wearing the day's colours: a rounded square clipping two
      // oversized circles, with a white silhouette on top.
      tile={{
        groundClass: palette.deep,
        backClass: palette.solid,
        frontClass: palette.strong,
      }}
      glyph={glyph ? <Icon name={glyph} size="lg" filled /> : undefined}
      eyebrowClass={palette.strong}
      decor={
        decor ? (
          <>
            {PIECES.map((piece) => (
              <FloatingPiece
                key={piece.left}
                motion={decor.motion}
                // `fall` owns its own Y axis — the keyframe supplies the travel.
                {...(decor.motion === 'fall' ? { ...piece, top: undefined } : piece)}
                className={palette.text}
              >
                <Icon name={decor.icon} size="lg" filled />
              </FloatingPiece>
            ))}
          </>
        ) : undefined
      }
      countdown={
        countdown
          ? {
              value: countdown.nights,
              prefixLabel: t('countdownPrefix'),
              unitLabel: t('countdownUnit', { count: countdown.nights }),
            }
          : undefined
      }
    />
  );
}
