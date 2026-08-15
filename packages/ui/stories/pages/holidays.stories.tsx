import type { Meta, StoryObj } from '@storybook/react-vite';

import { Section, Specimen } from '../specimen';

/**
 * **Feestdagen & vakanties** — op de betreffende datum vervangt een
 * thema-banner tijdelijk het "Nu"-blok bovenaan Vandaag.
 *
 * Automatisch actief op basis van de kalenderdatum, en op de dag zelf vervalt
 * de aftelteller. Staat de dag nog voor de deur, dan krijgt de banner rechts
 * een witte kaart met het aantal nachtjes in indigo — dat is het ene getal dat
 * kleine kinderen uit zichzelf vragen.
 *
 * Er is hier geen component om te verhuizen: welke dag vandaag is, is een
 * *domein*-vraag (`modules/holidays/domain/nl.ts` rekent Pasen en Koningsdag
 * uit, `specialDaysOn()` beantwoordt hem in de tijdzone van het huishouden) en
 * de kopij komt uit `messages/*.json`. Wat het design system wél bezit is de
 * banner-vorm, en die staat hieronder uit pakket-onderdelen en de
 * `--cat-*`-tokens opgebouwd.
 *
 * Twee dingen die dit specimen vastlegt:
 *
 * - **Het tegeltje is een emoji, geen icoon.** De icoonfont is een 64KB-subset
 *   van Material Symbols; daar zit geen mijter, geen pompoen en geen paasei in,
 *   en er is geen glyph die als Sinterklaas leest. Een emoji heeft geen asset
 *   nodig — dezelfde afweging die `modules/holidays/domain/nl.ts` maakt.
 * - **De accentkleur komt uit de categorie-palet, niet uit een nieuw palet.**
 *   Acht tinten waren er al; een feestdag is een sorteersignaal net als een
 *   agendacategorie, en een negende kleur zou alleen maar een tweede taal zijn.
 */
const meta: Meta = {
  title: 'Pages/Feestdagen & vakanties',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

type Banner = {
  slug: string;
  emoji: string;
  eyebrow: string;
  title: string;
  meta: string;
  surface: string;
  text: string;
  countdown?: number;
};

/**
 * De klassen staan voluit — Tailwind scant brontekst, dus
 * `bg-cat-${accent}-surface` zou nooit gegenereerd worden. Dezelfde reden
 * waarom `MEMBER_COLOR_CLASSES` in de app ook uitgeschreven is.
 */
const BANNERS: Banner[] = [
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

const VACATIONS: Banner[] = [
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

function ThemeBanner({ banner }: { banner: Banner }) {
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

export const Themes: Story = {
  render: () => (
    <div className="flex flex-col gap-12">
      <Section title="Feestdagen">
        <Specimen
          name="Theme/feestdag"
          note="Op de dag zelf: geen teller. Sinterklaas staat hier nog voor de deur, dus mét."
        >
          <div className="flex w-full max-w-3xl flex-col gap-4">
            {BANNERS.map((banner) => (
              <ThemeBanner key={banner.slug} banner={banner} />
            ))}
          </div>
        </Specimen>
      </Section>

      <Section title="Schoolvakanties">
        <Specimen
          name="Theme/vakantie"
          note="Een periode in plaats van een dag — dezelfde banner, met een reeks in de metaregel."
        >
          <div className="flex w-full max-w-3xl flex-col gap-4">
            {VACATIONS.map((banner) => (
              <ThemeBanner key={banner.slug} banner={banner} />
            ))}
          </div>
        </Specimen>
      </Section>
    </div>
  ),
};
