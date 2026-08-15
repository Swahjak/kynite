import { getTranslations } from 'next-intl/server';
import { FloatingPiece, Icon, ThemeBanner, type IconName } from '@kynite/ui';
import { formatDateTime } from '@/i18n/formatting-locale';
import { CATEGORY_CLASSES } from '@/modules/calendar';
import { getHouseholdFormattingLocale } from '@/modules/family';
import type { TodayTheme } from '../domain/theme';

/**
 * The day's theme row (M26 / wave D1) — one banner for the twelve kinds of day
 * "Vandaag met thema's" draws.
 *
 * The *choosing* is not here; it is `domain/theme.ts`, which the page calls so
 * that it can also stand the NU block down (on a themed day the banner takes
 * its place rather than sitting above it). What this file owns is the three
 * things a resolved theme still does not know, all of them the design sheet's:
 * which glyph stands in for a day's silhouette, which two colours its weather
 * is made of, and which two circles the brand-mark tile clips.
 *
 * The second colour is the whole trick of the decoration layer. The sheet never
 * draws four pieces in one hue — Kerst falls in green *and* the brand orange,
 * the autumn break in red and orange, a birthday drifts in pink, indigo and
 * orange — and four identical shapes in one colour read as a texture where two
 * read as weather. So every theme names a pair and the pieces alternate.
 */

/**
 * Per-theme decoration, keyed by `TodayTheme.key`.
 *
 * `glyph` is the tile's silhouette and `decor` its weather. Both are optional
 * and for the same reason: the icon font is a hard-capped 64 KB subset
 * (`scripts/subset-icons.mjs`) that holds no mitre, no pumpkin, no Easter egg
 * and no crown. A day with nothing honest to draw falls back to the package's
 * emoji tile and to no ambient layer at all — a weaker result, never a wrong
 * one, and the eyebrow names the day in words either way.
 *
 * `circles` overrides the tile's two clipped circles when the sheet gives the
 * day colours its own hue does not carry: Kerst is a red tile with a green and
 * an indigo circle, which is the brand mark wearing Christmas rather than a
 * green square.
 */
type ThemeLook = {
  glyph?: IconName;
  decor?: { icon: IconName; motion: 'drift' | 'fall' | 'spin' };
  /** The two inks the four pieces alternate between. */
  ink: [string, string];
  /** `[backClass, frontClass]` for the tile's circles; defaults to the hue's own. */
  circles?: [string, string];
};

const LOOK: Record<string, ThemeLook> = {
  // ── Birthdays ────────────────────────────────────────────────────────────
  birthday: {
    glyph: 'cake',
    decor: { icon: 'celebration', motion: 'drift' },
    ink: ['text-cat-pink-solid', 'text-gold'],
    circles: ['bg-primary', 'bg-gold'],
  },

  // ── Speciale dagen ───────────────────────────────────────────────────────
  newYear: {
    glyph: 'celebration',
    decor: { icon: 'celebration', motion: 'drift' },
    ink: ['text-primary', 'text-gold'],
  },
  animalDay: {
    glyph: 'pets',
    decor: { icon: 'pets', motion: 'drift' },
    ink: ['text-cat-green-solid', 'text-gold'],
  },
  sinterklaas: {
    glyph: 'redeem',
    decor: { icon: 'redeem', motion: 'drift' },
    ink: ['text-cat-red-solid', 'text-gold'],
  },
  // The sheet's Kerst is a warm red ground with a green and an indigo circle,
  // and stars falling in green and the brand orange.
  christmasDay: {
    glyph: 'park',
    decor: { icon: 'star', motion: 'fall' },
    ink: ['text-cat-green-solid', 'text-gold'],
    circles: ['bg-cat-green-solid', 'bg-primary'],
  },
  boxingDay: {
    glyph: 'park',
    decor: { icon: 'star', motion: 'fall' },
    ink: ['text-cat-green-solid', 'text-gold'],
    circles: ['bg-cat-green-solid', 'bg-primary'],
  },
  newYearsEve: {
    glyph: 'celebration',
    decor: { icon: 'celebration', motion: 'drift' },
    ink: ['text-primary', 'text-gold'],
  },
  kingsDay: {
    decor: { icon: 'celebration', motion: 'drift' },
    ink: ['text-gold', 'text-primary'],
  },

  // ── Schoolvakanties ──────────────────────────────────────────────────────
  // `eco` twice, and the motion is the difference. The sheet draws flowers
  // drifting in February and leaves falling in October; the subset has no
  // flower it could afford (`local_florist` alone costs 4.8 KB of a 2.6 KB
  // headroom), and one leaf that *rises* in spring green and *falls* in autumn
  // red says the same two things with one glyph.
  springBreak: {
    glyph: 'eco',
    decor: { icon: 'eco', motion: 'drift' },
    ink: ['text-cat-green-solid', 'text-cat-pink-solid'],
  },
  mayBreak: {
    glyph: 'park',
    decor: { icon: 'park', motion: 'drift' },
    ink: ['text-cat-green-solid', 'text-gold'],
  },
  summerBreak: {
    glyph: 'beach_access',
    decor: { icon: 'wb_sunny', motion: 'drift' },
    ink: ['text-gold', 'text-cat-blue-solid'],
  },
  autumnBreak: {
    glyph: 'eco',
    decor: { icon: 'eco', motion: 'fall' },
    ink: ['text-cat-red-solid', 'text-cat-orange-solid'],
  },
  christmasBreak: {
    glyph: 'ac_unit',
    decor: { icon: 'ac_unit', motion: 'fall' },
    ink: ['text-cat-teal-solid', 'text-cat-blue-solid'],
  },
};

/**
 * Four pieces, and the whole effect is that they do not agree.
 *
 * The four `left` percentages are the sheet's own (76 / 90 / 83 / 68) and they
 * matter: a piece at 95% is half outside the card once it drifts, which is how
 * four pieces used to render as three.
 */
const PIECES = [
  { left: '76%', top: '10%', size: 20, rotate: -8, duration: 3.6, delay: 0 },
  { left: '90%', top: '32%', size: 14, rotate: 14, duration: 4.1, delay: 0.8 },
  { left: '83%', top: '60%', size: 16, rotate: -12, duration: 4.5, delay: 1.6 },
  { left: '68%', top: '78%', size: 12, rotate: 10, duration: 3.9, delay: 2.4 },
];

export type TodayThemeBannerProps = {
  /** Already resolved by the page — see `domain/theme.ts`. */
  theme: TodayTheme;
};

export async function TodayThemeBanner({ theme }: TodayThemeBannerProps) {
  const t = await getTranslations('holidays');
  const formattingLocale = await getHouseholdFormattingLocale();

  const palette = CATEGORY_CLASSES[theme.accent];
  const look = LOOK[theme.key];

  const soon = theme.nights !== null;

  const eyebrow =
    theme.source === 'birthday'
      ? t('birthday.eyebrow')
      : theme.source === 'school'
        ? t(`school.${theme.key}`)
        : t(`days.${theme.key}`);

  const title =
    theme.source === 'birthday'
      ? t(soon ? 'birthday.titleSoon' : 'birthday.title', { name: theme.person?.name ?? '' })
      : theme.source === 'school'
        ? t(`schoolBanner.${theme.key}`, { days: theme.days ?? 0 })
        : t(`banner.${theme.key}`);

  return (
    <ThemeBanner
      data-testid="today-theme-banner"
      data-slug={theme.key}
      data-source={theme.source}
      emoji={theme.emoji}
      eyebrow={eyebrow}
      title={title}
      meta={metaOf(theme)}
      surfaceClass={palette.surface}
      textClass={palette.text}
      // The brand mark wearing the day's colours: a rounded square clipping two
      // oversized circles, with a white silhouette on top.
      tile={{
        groundClass: palette.deep,
        backClass: look?.circles?.[0] ?? palette.solid,
        frontClass: look?.circles?.[1] ?? palette.strong,
      }}
      glyph={look?.glyph ? <Icon name={look.glyph} size="lg" filled /> : undefined}
      eyebrowClass={palette.strong}
      decor={
        look?.decor ? (
          <>
            {PIECES.map((piece, index) => (
              <FloatingPiece
                key={piece.left}
                motion={look.decor!.motion}
                // `fall` owns its own Y axis — the keyframe supplies the travel.
                {...(look.decor!.motion === 'fall' ? { ...piece, top: undefined } : piece)}
                className={look.ink[index % 2]}
              >
                <Icon name={look.decor!.icon} size="lg" filled />
              </FloatingPiece>
            ))}
          </>
        ) : undefined
      }
      countdown={
        theme.nights === null
          ? undefined
          : {
              value: theme.nights,
              prefixLabel: t('countdownPrefix'),
              unitLabel: t('countdownUnit', { count: theme.nights }),
            }
      }
    />
  );

  /**
   * The quiet line under the headline: the date (or the date range), then the
   * house rule for the day — "25 december · pyjama's aan, cadeautjes onder de
   * boom". A birthday states an age instead of a date, because "14 augustus"
   * under "Mila is vandaag jarig!" is the one fact nobody in the room needs.
   */
  function metaOf(resolved: TodayTheme): string {
    const suffix =
      resolved.source === 'birthday'
        ? null
        : resolved.source === 'school'
          ? t(`schoolMeta.${resolved.key}`, { days: resolved.days ?? 0 })
          : t(`metaSuffix.${resolved.key}`);

    if (resolved.source === 'birthday') {
      const age = resolved.person?.age;
      return age === null || age === undefined
        ? t('birthday.metaNoAge')
        : t('birthday.meta', { age });
    }

    const head =
      resolved.from === resolved.to
        ? day(resolved.from)
        : t('dateRange', {
            // Same month: the first end drops its month name, exactly as the
            // sheet writes it ("17 t/m 25 oktober").
            from:
              resolved.from.slice(0, 7) === resolved.to.slice(0, 7)
                ? dayNumber(resolved.from)
                : day(resolved.from),
            to: day(resolved.to),
          });

    return suffix ? `${head} · ${suffix}` : head;
  }

  /**
   * "25 december". Built at noon UTC and read back in UTC: the banner's dates
   * are *dates*, already resolved in the household's zone by the caller, and
   * re-projecting them through a zone is the one way to make 25 December print
   * as the 24th.
   */
  function day(dateKey: string): string {
    return formatDateTime(noonOf(dateKey), formattingLocale, {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  }

  function dayNumber(dateKey: string): string {
    return formatDateTime(noonOf(dateKey), formattingLocale, { day: 'numeric', timeZone: 'UTC' });
  }
}

function noonOf(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}
