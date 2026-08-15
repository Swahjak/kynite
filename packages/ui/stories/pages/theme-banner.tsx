/**
 * The theme banner, and the twelve Dutch days that get one.
 *
 * Shared between `Pages/Feestdagen & vakanties`, which shows the banners as a
 * set, and `Pages/Vandaag — thema's`, which shows one of them *in place* — a
 * banner is only ever seen in the NU block's slot, so the two stories have to
 * be drawing the same object or the second one proves nothing.
 *
 * Two decisions the shape carries:
 *
 * - **The tile is an emoji, not an icon.** The icon font is a hard-capped
 *   64 KB subset of Material Symbols; it holds no mitre, no pumpkin and no
 *   Easter egg, and there is no glyph that reads as Sinterklaas. An emoji
 *   needs no asset — the same call `modules/holidays/domain/nl.ts` makes.
 * - **The accent comes from the category palette.** Eight hues already exist,
 *   and a holiday is a sorting signal just like a calendar category; a ninth
 *   colour would only be a second language.
 *
 * The countdown is the one number small children ask for by themselves, so it
 * gets a white card and indigo figures — and on the day itself it disappears
 * rather than reading "nog 0".
 */

export type Banner = {
  slug: string;
  emoji: string;
  eyebrow: string;
  title: string;
  meta: string;
  /**
   * Written out rather than built from a hue name: Tailwind scans source text,
   * so `bg-cat-${accent}-surface` would never be generated. `MEMBER_COLOR_CLASSES`
   * in the app is spelled out for the same reason.
   */
  surface: string;
  text: string;
  countdown?: number;
};

export const HOLIDAY_BANNERS: Banner[] = [
  {
    slug: 'verjaardag',
    emoji: '🎂',
    eyebrow: 'JARIG!',
    title: 'Mila is vandaag jarig!',
    meta: '7 jaar · taart bij het ontbijt, cadeautjes na het avondeten',
    surface: 'bg-cat-pink-surface',
    text: 'text-cat-pink-fg',
  },
  {
    slug: 'kerst',
    emoji: '🎄',
    eyebrow: 'KERST',
    title: 'De kerstboom mag aan!',
    meta: "25 december · pyjama's aan, cadeautjes onder de boom",
    surface: 'bg-cat-green-surface',
    text: 'text-cat-green-fg',
  },
  {
    slug: 'sinterklaas',
    emoji: '🎁',
    eyebrow: 'SINTERKLAAS',
    title: 'Zet je schoen maar vast klaar',
    meta: '5 december · pakjesavond om 19:00',
    surface: 'bg-cat-red-surface',
    text: 'text-cat-red-fg',
    countdown: 113,
  },
  {
    slug: 'halloween',
    emoji: '🎃',
    eyebrow: 'HALLOWEEN',
    title: 'Verkleden en snoep verzamelen!',
    meta: '31 oktober · om 18:30 verzamelen voor het buurtrondje',
    surface: 'bg-cat-orange-surface',
    text: 'text-cat-orange-fg',
  },
  {
    slug: 'pasen',
    emoji: '🐣',
    eyebrow: 'PASEN',
    title: 'Wie vindt de meeste eieren?',
    meta: '5 april · eieren zoeken in de tuin om 10:00',
    surface: 'bg-cat-yellow-surface',
    text: 'text-cat-yellow-fg',
  },
  {
    slug: 'koningsdag',
    emoji: '👑',
    eyebrow: 'KONINGSDAG',
    title: 'Oranje aan en naar de vrijmarkt',
    meta: '27 april · vrijmarkt in het park, 9:00–13:00',
    surface: 'bg-cat-orange-surface',
    text: 'text-cat-orange-fg',
  },
];

export const VACATION_BANNERS: Banner[] = [
  {
    slug: 'voorjaarsvakantie',
    emoji: '🌷',
    eyebrow: 'VOORJAARSVAKANTIE',
    title: 'Buiten spelen, de lente is er',
    meta: '17 t/m 25 februari · een week zonder schooltas',
    surface: 'bg-cat-pink-surface',
    text: 'text-cat-pink-fg',
  },
  {
    slug: 'meivakantie',
    emoji: '🌳',
    eyebrow: 'MEIVAKANTIE',
    title: '9 dagen vrij om te spelen',
    meta: '27 april t/m 5 mei · samen met Koningsdag',
    surface: 'bg-cat-green-surface',
    text: 'text-cat-green-fg',
  },
  {
    slug: 'zomervakantie',
    emoji: '🏖️',
    eyebrow: 'ZOMERVAKANTIE',
    title: 'Zwemmen, kamperen en lekker niksen',
    meta: '12 juli t/m 24 augustus · 6 weken vrij',
    surface: 'bg-cat-yellow-surface',
    text: 'text-cat-yellow-fg',
    countdown: 41,
  },
  {
    slug: 'herfstvakantie',
    emoji: '🍂',
    eyebrow: 'HERFSTVAKANTIE',
    title: 'Een week uitslapen en buiten spelen',
    meta: '19 t/m 27 oktober · geen schoolroutine deze week',
    surface: 'bg-cat-orange-surface',
    text: 'text-cat-orange-fg',
  },
  {
    slug: 'kerstvakantie',
    emoji: '❄️',
    eyebrow: 'KERSTVAKANTIE',
    title: 'Twee weken lekker niksen',
    meta: '21 december t/m 3 januari',
    surface: 'bg-cat-teal-surface',
    text: 'text-cat-teal-fg',
  },
];

export const bannerFor = (slug: string): Banner => {
  const found = [...HOLIDAY_BANNERS, ...VACATION_BANNERS].find((banner) => banner.slug === slug);
  if (!found) throw new Error(`No theme banner for "${slug}"`);
  return found;
};

export function ThemeBanner({ banner }: { banner: Banner }) {
  return (
    <div
      data-slug={banner.slug}
      className={`flex w-full items-center gap-4 rounded-2xl ${banner.surface} ${banner.text} p-5`}
    >
      {/* Het icoon-tegeltje volgt de opbouw van het merkicoon: gelaagde
          kleurcirkels uit bestaande Kynite-kleuren, met een silhouet dat bij
          het thema past. */}
      <span
        aria-hidden
        className="relative flex size-16 shrink-0 items-center justify-center rounded-full bg-card/70"
      >
        <span className="absolute inset-1.5 rounded-full bg-card/80" />
        <span className="relative text-[28px] leading-none">{banner.emoji}</span>
      </span>

      <div className="min-w-0 flex-1">
        <span className="label-overline block opacity-80">{banner.eyebrow}</span>
        <p className="font-display text-h3 font-bold">{banner.title}</p>
        <p className="text-body-sm opacity-90">{banner.meta}</p>
      </div>

      {banner.countdown ? (
        <div className="flex shrink-0 flex-col items-center rounded-xl bg-card px-4 py-2.5 text-brand-ink shadow-sm">
          <span className="label-overline text-ink-muted">nog</span>
          <span className="tnum font-display text-h2 font-extrabold">{banner.countdown}</span>
          <span className="label-overline text-ink-muted">dagen</span>
        </div>
      ) : null}
    </div>
  );
}
