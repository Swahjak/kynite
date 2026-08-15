import type { ReactNode } from 'react';

import { ConfettiBurst } from '../../src/components/confetti-burst';
import { FloatingPiece } from '../../src/components/floating-piece';
import { Icon } from '../../src/components/icon';
import {
  ThemeBanner as ThemeBannerShape,
  type ThemeBannerTile,
} from '../../src/components/theme-banner';

/**
 * The theme banner, and the eleven Dutch days that get one.
 *
 * Shared between `Pages/Feestdagen & vakanties`, which shows the banners as a
 * set, and `Pages/Vandaag — thema's`, which shows one of them *in place* — a
 * banner is only ever seen in the NU block's slot, so the two stories have to
 * be drawing the same object or the second one proves nothing. Both render the
 * package's own `ThemeBanner`; what lives here is only the eleven days' data.
 *
 * Three decisions the sheet carries, and this file with it:
 *
 * - **The tile is the brand mark in the day's colours** — a rounded square
 *   clipping two oversized circles, with a white silhouette on top ("het
 *   icoon-tegeltje volgt de opbouw van het merkicoon"). Not an emoji: an emoji
 *   is somebody else's artwork in somebody else's style, and eleven of them
 *   side by side look like eleven different products.
 * - **The silhouette is a shape, not a font, wherever the font has no glyph.**
 *   The icon subset is capped at 64 KB and carries no mitre, no pumpkin, no
 *   Easter egg, no snowflake. The design sheet already draws those in CSS
 *   (triangles, ellipses, a `clip-path` crown), so the four that *are* in the
 *   subset — `cake`, `park`, `beach_access`, `star`, `redeem` — use the font
 *   and the rest are `<Glyph>` shapes below. Adding glyphs to the subset would
 *   mean regenerating the font in `apps/web`, which buys nothing a 20-byte
 *   `clip-path` does not.
 * - **Every colour is a token.** `--cat-*-solid` and the two deep steps added
 *   for this sheet (`-deep`, `-strong`), plus `--brand` and `--gold` where the
 *   design reaches for the brand pair directly.
 */

/* -------------------------------------------------------------------------- */
/* Silhouettes — the shapes no icon font carries                               */
/* -------------------------------------------------------------------------- */

/**
 * Each of these is drawn white, on the tile's colour, at a fixed 20–24px box —
 * the size the sheet gives the tile glyph. They are deliberately crude: at
 * 23px a fir tree *is* three triangles, and anything more detailed would only
 * be noise a metre away from a wall display.
 */

/**
 * The two shapes made of CSS triangles paint themselves in `currentColor`
 * (`border-b-current`, `bg-current`) rather than taking a colour class: a
 * triangle's fill is a *border* colour, and a `bg-` class rewritten into a
 * `border-b-` one is exactly the kind of constructed class name Tailwind's
 * scanner never sees and never generates.
 */
const FirTree = () => (
  <span className="relative block h-[23px] w-5">
    <span className="absolute top-0 left-1/2 size-0 -translate-x-1/2 border-r-[6px] border-b-[7px] border-l-[6px] border-transparent border-b-current" />
    <span className="absolute top-[5px] left-1/2 size-0 -translate-x-1/2 border-r-[8px] border-b-[8px] border-l-[8px] border-transparent border-b-current" />
    <span className="absolute top-[11px] left-1/2 size-0 -translate-x-1/2 border-r-[10px] border-b-[9px] border-l-[10px] border-transparent border-b-current" />
    <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-[1px] bg-current" />
  </span>
);

const Mitre = () => (
  <span className="relative block h-6 w-[22px]">
    <span className="absolute top-0.5 left-1/2 size-0 -translate-x-1/2 border-r-[8px] border-b-[15px] border-l-[8px] border-transparent border-b-current" />
    <span className="absolute bottom-0.5 left-1/2 h-1 w-[19px] -translate-x-1/2 rounded-[2px] bg-current" />
    <span className="absolute -top-[3px] left-1/2 h-1.5 w-0.5 -translate-x-1/2 bg-current" />
    <span className="absolute -top-px left-1/2 h-1.5 w-0.5 -translate-x-1/2 rotate-90 bg-current" />
  </span>
);

const Pumpkin = ({
  body = 'bg-gold',
  stem = 'bg-cat-green-deep',
}: {
  body?: string;
  stem?: string;
}) => (
  <span className="relative block h-5 w-[22px]">
    <span className={`absolute top-1.5 left-0.5 h-[13px] w-[18px] rounded-[50%] ${body}`} />
    <span className="absolute top-1.5 left-[9px] h-[13px] w-0.5 bg-black/20" />
    <span className="absolute top-1.5 left-[13px] h-[13px] w-0.5 bg-black/20" />
    <span
      className={`absolute top-px left-1/2 h-1.5 w-[3px] -translate-x-1/2 rounded-[1px] ${stem}`}
    />
  </span>
);

const Crown = ({ color = 'bg-white' }: { color?: string }) => (
  <span
    className={`block h-[17px] w-6 ${color}`}
    style={{
      clipPath:
        'polygon(0% 100%,0% 42%,20% 68%,35% 15%,50% 50%,65% 15%,80% 68%,100% 42%,100% 100%)',
    }}
  />
);

/** An egg: a circle pulled taller at the top. `local_florist`'s neighbour in the design, `egg`, is not in the subset. */
const Egg = ({ color = 'bg-white' }: { color?: string }) => (
  <span
    className={`block h-[22px] w-[17px] ${color}`}
    style={{ borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%' }}
  />
);

/** Five petals and a heart — `local_florist` without the font. */
const Flower = ({ color = 'bg-white', heart = 'bg-gold' }: { color?: string; heart?: string }) => (
  <span className="relative block size-[22px]">
    {[0, 72, 144, 216, 288].map((angle) => (
      <span
        key={angle}
        className={`absolute top-1/2 left-1/2 h-[9px] w-[7px] rounded-full ${color}`}
        style={{ transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-6px)` }}
      />
    ))}
    <span
      className={`absolute top-1/2 left-1/2 size-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full ${heart}`}
    />
  </span>
);

/**
 * A leaf: a square with two opposite corners rounded all the way, tilted. `eco`
 * is not in the subset, and two border radii are the whole shape.
 */
const Leaf = ({ color = 'bg-white' }: { color?: string }) => (
  <span
    className={`block size-[20px] -rotate-[20deg] ${color}`}
    style={{ borderRadius: '0 100% 0 100%' }}
  />
);

/** Three crossed bars — `ac_unit` without the font. */
const Snowflake = ({ color = 'bg-white' }: { color?: string }) => (
  <span className="relative block size-[21px]">
    {[0, 60, 120].map((angle) => (
      <span
        key={angle}
        className={`absolute top-1/2 left-1/2 h-[2px] w-full rounded-full ${color}`}
        style={{ transform: `translate(-50%,-50%) rotate(${angle}deg)` }}
      />
    ))}
  </span>
);

/** A balloon: an ellipse with a knot. Drifts, three at a time, on a birthday. */
const Balloon = ({ color }: { color: string }) => (
  <span className="relative block size-full">
    <span className={`absolute top-0 left-0 h-[78%] w-full rounded-[50%] ${color}`} />
    <span
      className={`absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 ${color}`}
      style={{ clipPath: 'polygon(0 0,100% 0,50% 100%)' }}
    />
  </span>
);

/** A pennant on a stick — Koningsdag's vrijmarkt. `flag` is not in the subset. */
const Flag = ({ color = 'bg-white' }: { color?: string }) => (
  <span className="relative block size-full">
    <span className={`absolute top-0 left-0 h-full w-[2px] rounded-full ${color}`} />
    <span
      className={`absolute top-[10%] left-[2px] h-[45%] w-[70%] ${color}`}
      style={{ clipPath: 'polygon(0 0,100% 0,100% 70%,0 100%)' }}
    />
  </span>
);

/* -------------------------------------------------------------------------- */
/* The eleven days                                                             */
/* -------------------------------------------------------------------------- */

export type Banner = {
  slug: string;
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
  /** The eyebrow pill's ground — white text sits on it. */
  eyebrowClass: string;
  tile: ThemeBannerTile;
  glyph: ReactNode;
  /** The ambient layer in the card's right third. */
  decor: ReactNode;
  countdown?: number;
};

/** The four positions the sheet uses, top to bottom down the card's right third. */
const SLOTS = [
  { left: '76%', top: '10%', size: 20 },
  { left: '90%', top: '32%', size: 14 },
  { left: '80%', top: '60%', size: 16 },
  { left: '66%', top: '78%', size: 12 },
] as const;

/** Four of one icon, drifting out of step — the sheet's most common decoration. */
function DriftingIcons({
  icon,
  classes,
  filled,
}: {
  icon: 'park' | 'beach_access' | 'redeem' | 'wb_sunny' | 'star' | 'cake';
  classes: [string, string];
  filled?: boolean;
}) {
  const timing = [
    { rotate: -8, duration: 3.5, delay: 0 },
    { rotate: 14, duration: 4, delay: 0.8 },
    { rotate: -12, duration: 4.3, delay: 1.6 },
    { rotate: 10, duration: 3.8, delay: 2.4 },
  ];
  return (
    <>
      {SLOTS.map((slot, index) => (
        <FloatingPiece
          key={slot.left}
          motion="drift"
          left={slot.left}
          top={slot.top}
          size={slot.size}
          rotate={timing[index].rotate}
          duration={timing[index].duration}
          delay={timing[index].delay}
          className={classes[index % 2]}
        >
          <Icon
            name={icon}
            filled={filled}
            style={{ fontSize: slot.size, width: slot.size, height: slot.size }}
          />
        </FloatingPiece>
      ))}
    </>
  );
}

/** Four of one shape, falling past the card — leaves, snow, stars. */
function FallingShapes({
  render,
  classes,
}: {
  render: (color: string, size: number) => ReactNode;
  classes: [string, string];
}) {
  const pieces = [
    { left: '76%', size: 20, rotate: -10, duration: 5.2, delay: 0 },
    { left: '90%', size: 14, rotate: 16, duration: 4.6, delay: 1.4 },
    { left: '83%', size: 16, rotate: -14, duration: 5.8, delay: 2.5 },
    { left: '68%', size: 12, rotate: 10, duration: 4.9, delay: 0.6 },
  ];
  return (
    <>
      {pieces.map((piece, index) => (
        <FloatingPiece
          key={piece.left}
          motion="fall"
          left={piece.left}
          size={piece.size}
          rotate={piece.rotate}
          duration={piece.duration}
          delay={piece.delay}
        >
          {render(classes[index % 2], piece.size)}
        </FloatingPiece>
      ))}
    </>
  );
}

export const HOLIDAY_BANNERS: Banner[] = [
  {
    slug: 'verjaardag',
    eyebrow: 'JARIG!',
    title: 'Mila is vandaag jarig!',
    meta: '7 jaar · taart bij het ontbijt, cadeautjes na het avondeten',
    surface: 'bg-cat-pink-surface',
    text: 'text-cat-pink-fg',
    eyebrowClass: 'bg-cat-pink-strong',
    tile: {
      groundClass: 'bg-cat-pink-solid',
      backClass: 'bg-brand/85',
      frontClass: 'bg-gold/85',
    },
    glyph: <Icon name="cake" filled style={{ fontSize: 23, width: 23, height: 23 }} />,
    // The only banner that gets confetti: a birthday is the one day the card
    // itself is the celebration, and the two pieces are the same burst the
    // motion sheet fires, scaled down to the card.
    decor: (
      <>
        <FloatingPiece motion="drift" left="74%" top="8%" rotate={-6} duration={3.4} delay={0}>
          <span className="block h-5 w-4">
            <Balloon color="bg-cat-pink-solid/75" />
          </span>
        </FloatingPiece>
        <FloatingPiece motion="drift" left="88%" top="28%" rotate={10} duration={3.9} delay={0.6}>
          <span className="block h-[15px] w-3">
            <Balloon color="bg-brand/60" />
          </span>
        </FloatingPiece>
        <FloatingPiece motion="drift" left="80%" top="50%" rotate={-8} duration={3.6} delay={1.2}>
          <span className="block h-[18px] w-3.5">
            <Balloon color="bg-gold/65" />
          </span>
        </FloatingPiece>
        <ConfettiBurst loop origin={{ left: '72%', top: '75%' }} />
      </>
    ),
  },
  {
    slug: 'kerst',
    eyebrow: 'KERST',
    title: 'De kerstboom mag aan!',
    meta: "25 december · pyjama's aan, cadeautjes onder de boom",
    surface: 'bg-cat-red-surface',
    text: 'text-cat-red-fg',
    eyebrowClass: 'bg-cat-red-strong',
    tile: {
      groundClass: 'bg-cat-red-deep',
      backClass: 'bg-cat-green-solid/85',
      frontClass: 'bg-brand/75',
    },
    glyph: <FirTree />,
    decor: (
      <FallingShapes
        classes={['text-cat-green-solid', 'text-gold']}
        render={(color, size) => (
          <Icon
            name="star"
            className={color}
            style={{ fontSize: size, width: size, height: size }}
          />
        )}
      />
    ),
  },
  {
    slug: 'sinterklaas',
    eyebrow: 'SINTERKLAAS',
    title: 'Zet je schoen maar vast klaar',
    meta: '5 december · pakjesavond om 19:00',
    surface: 'bg-cat-red-surface',
    text: 'text-cat-red-fg',
    eyebrowClass: 'bg-cat-red-strong',
    tile: {
      groundClass: 'bg-cat-red-deep',
      backClass: 'bg-cat-red-strong/90',
      frontClass: 'bg-gold/60',
    },
    glyph: <Mitre />,
    decor: <DriftingIcons icon="redeem" classes={['text-cat-red-strong/55', 'text-gold/60']} />,
    countdown: 113,
  },
  {
    slug: 'halloween',
    eyebrow: 'HALLOWEEN',
    title: 'Verkleden en snoep verzamelen!',
    meta: '31 oktober · om 18:30 verzamelen voor het buurtrondje',
    // The one night-time theme, and the only banner that is not a pale tint:
    // Halloween happens after dark, so the card does too (`--surface-night`).
    surface: 'bg-surface-night',
    text: 'text-white',
    eyebrowClass: 'bg-gold text-gold-foreground',
    tile: {
      groundClass: 'bg-surface-night',
      backClass: 'bg-cat-purple-deep/80',
      frontClass: 'bg-cat-orange-deep/40',
    },
    glyph: <Pumpkin />,
    decor: (
      <>
        {[
          { left: '74%', top: '16%', rotate: 0, duration: 6, delay: 0 },
          { left: '90%', top: '36%', rotate: -20, duration: 5, delay: 1.3 },
          { left: '80%', top: '58%', rotate: 14, duration: 7, delay: 0.6 },
          { left: '64%', top: '76%', rotate: -10, duration: 5.5, delay: 2 },
        ].map((piece) => (
          <FloatingPiece key={piece.left} motion="fly" {...piece}>
            <Pumpkin body="bg-gold/70" stem="bg-cat-green-deep/60" />
          </FloatingPiece>
        ))}
      </>
    ),
  },
  {
    slug: 'pasen',
    eyebrow: 'PASEN',
    title: 'Wie vindt de meeste eieren?',
    meta: '5 april · eieren zoeken in de tuin om 10:00',
    surface: 'bg-cat-pink-surface',
    text: 'text-cat-pink-fg',
    eyebrowClass: 'bg-cat-pink-strong',
    tile: {
      groundClass: 'bg-cat-pink-solid',
      backClass: 'bg-cat-yellow-solid/80',
      frontClass: 'bg-cat-teal-solid/75',
    },
    glyph: <Egg />,
    decor: (
      <>
        {SLOTS.map((slot, index) => (
          <FloatingPiece
            key={slot.left}
            motion="drift"
            left={slot.left}
            top={slot.top}
            size={slot.size}
            rotate={[-8, 14, -12, 10][index]}
            duration={[3.5, 4, 4.3, 3.8][index]}
            delay={[0, 0.8, 1.6, 2.4][index]}
          >
            <Egg color={index % 2 === 0 ? 'bg-cat-yellow-solid/55' : 'bg-cat-teal-solid/40'} />
          </FloatingPiece>
        ))}
      </>
    ),
  },
  {
    slug: 'koningsdag',
    eyebrow: 'KONINGSDAG',
    title: 'Oranje aan en naar de vrijmarkt',
    meta: '27 april · vrijmarkt in het park, 9:00–13:00',
    surface: 'bg-cat-orange-surface',
    text: 'text-cat-orange-fg',
    eyebrowClass: 'bg-cat-orange-strong',
    tile: {
      groundClass: 'bg-cat-orange-deep',
      backClass: 'bg-gold/85',
      frontClass: 'bg-cat-red-deep/60',
    },
    glyph: <Crown />,
    decor: (
      <>
        {SLOTS.map((slot, index) => (
          <FloatingPiece
            key={slot.left}
            motion="drift"
            left={slot.left}
            top={slot.top}
            size={slot.size}
            rotate={[-8, 10, -12, 14][index]}
            duration={[3.3, 3.9, 4.2, 3.7][index]}
            delay={[0, 0.9, 1.6, 2.3][index]}
          >
            <Flag color={index % 2 === 0 ? 'bg-gold/60' : 'bg-cat-red-deep/40'} />
          </FloatingPiece>
        ))}
      </>
    ),
  },
];

export const VACATION_BANNERS: Banner[] = [
  {
    slug: 'voorjaarsvakantie',
    eyebrow: 'VOORJAARSVAKANTIE',
    title: 'Buiten spelen, de lente is er',
    meta: '17 t/m 25 februari · een week zonder schooltas',
    surface: 'bg-cat-green-surface',
    text: 'text-cat-green-fg',
    eyebrowClass: 'bg-cat-green-strong',
    tile: {
      groundClass: 'bg-cat-green-deep',
      backClass: 'bg-cat-pink-solid/75',
      frontClass: 'bg-cat-yellow-solid/70',
    },
    glyph: <Flower />,
    decor: (
      <>
        {SLOTS.map((slot, index) => (
          <FloatingPiece
            key={slot.left}
            motion="drift"
            left={slot.left}
            top={slot.top}
            size={slot.size}
            rotate={[-8, 14, -14, 10][index]}
            duration={[3.6, 4.1, 4.5, 3.9][index]}
            delay={[0, 0.8, 1.6, 2.4][index]}
          >
            <Flower
              color={index % 2 === 0 ? 'bg-cat-pink-solid/55' : 'bg-cat-yellow-solid/40'}
              heart="bg-gold/60"
            />
          </FloatingPiece>
        ))}
      </>
    ),
  },
  {
    slug: 'meivakantie',
    eyebrow: 'MEIVAKANTIE',
    title: '9 dagen vrij om te spelen',
    meta: '27 april t/m 5 mei · samen met Koningsdag',
    surface: 'bg-cat-yellow-surface',
    text: 'text-cat-yellow-fg',
    eyebrowClass: 'bg-cat-yellow-strong',
    tile: {
      groundClass: 'bg-cat-yellow-deep',
      backClass: 'bg-cat-green-solid/80',
      frontClass: 'bg-gold/70',
    },
    glyph: <Icon name="park" filled style={{ fontSize: 23, width: 23, height: 23 }} />,
    decor: <DriftingIcons icon="park" classes={['text-cat-green-solid/50', 'text-gold/40']} />,
  },
  {
    slug: 'zomervakantie',
    eyebrow: 'ZOMERVAKANTIE',
    title: 'Zwemmen, kamperen en lekker niksen',
    meta: '12 juli t/m 24 augustus · 6 weken vrij',
    surface: 'bg-cat-yellow-surface',
    text: 'text-cat-yellow-fg',
    eyebrowClass: 'bg-cat-teal-strong',
    tile: {
      groundClass: 'bg-cat-teal-deep',
      backClass: 'bg-gold/85',
      frontClass: 'bg-cat-yellow-solid/60',
    },
    glyph: <Icon name="beach_access" filled style={{ fontSize: 23, width: 23, height: 23 }} />,
    // The one theme whose four pieces are not the same shape or the same
    // motion: a sun turns, a parasol bobs. Summer is the loudest banner of the
    // year and the sheet lets it be.
    decor: (
      <>
        <FloatingPiece
          motion="spin"
          left="76%"
          top="10%"
          size={20}
          duration={6}
          className="text-gold/70"
        >
          <Icon name="wb_sunny" style={{ fontSize: 20, width: 20, height: 20 }} />
        </FloatingPiece>
        <FloatingPiece
          motion="drift"
          left="90%"
          top="32%"
          size={14}
          rotate={14}
          duration={4}
          delay={0.8}
          className="text-cat-teal-solid/40"
        >
          <Icon name="beach_access" style={{ fontSize: 14, width: 14, height: 14 }} />
        </FloatingPiece>
        <FloatingPiece
          motion="drift"
          left="80%"
          top="60%"
          size={16}
          rotate={-10}
          duration={4.4}
          delay={1.6}
          className="text-gold/50"
        >
          <Icon name="wb_sunny" style={{ fontSize: 16, width: 16, height: 16 }} />
        </FloatingPiece>
        <FloatingPiece
          motion="drift"
          left="66%"
          top="78%"
          size={12}
          rotate={10}
          duration={3.8}
          delay={2.4}
          className="text-cat-teal-solid/30"
        >
          <Icon name="beach_access" style={{ fontSize: 12, width: 12, height: 12 }} />
        </FloatingPiece>
      </>
    ),
    countdown: 41,
  },
  {
    slug: 'herfstvakantie',
    eyebrow: 'HERFSTVAKANTIE',
    title: 'Een week uitslapen en buiten spelen',
    meta: '19 t/m 27 oktober · geen schoolroutine deze week',
    surface: 'bg-cat-orange-surface',
    text: 'text-cat-orange-fg',
    eyebrowClass: 'bg-cat-orange-strong',
    tile: {
      groundClass: 'bg-cat-orange-deep',
      backClass: 'bg-cat-red-deep/85',
      frontClass: 'bg-cat-purple-deep/50',
    },
    glyph: <Leaf />,
    decor: (
      <FallingShapes
        classes={['bg-cat-red-deep/80', 'bg-cat-orange-deep/70']}
        render={(color) => <Leaf color={color} />}
      />
    ),
  },
  {
    slug: 'kerstvakantie',
    eyebrow: 'KERSTVAKANTIE',
    title: 'Twee weken lekker niksen',
    meta: '21 december t/m 3 januari',
    surface: 'bg-cat-blue-surface',
    text: 'text-cat-blue-fg',
    eyebrowClass: 'bg-cat-blue-strong',
    tile: {
      groundClass: 'bg-cat-blue-deep',
      backClass: 'bg-cat-teal-solid/85',
      frontClass: 'bg-brand/70',
    },
    glyph: <Snowflake />,
    decor: (
      <FallingShapes
        classes={['bg-cat-teal-solid/80', 'bg-cat-blue-solid/70']}
        render={(color) => <Snowflake color={color} />}
      />
    ),
  },
];

export const bannerFor = (slug: string): Banner => {
  const found = [...HOLIDAY_BANNERS, ...VACATION_BANNERS].find((banner) => banner.slug === slug);
  if (!found) throw new Error(`No theme banner for "${slug}"`);
  return found;
};

/**
 * The story-side wrapper: the package's `ThemeBanner`, fed one day's data.
 * Deliberately thin — if a story could draw a banner the package cannot, the
 * specimen would be proving something about the story instead of the system.
 */
export function ThemeBanner({ banner }: { banner: Banner }) {
  return (
    <ThemeBannerShape
      data-slug={banner.slug}
      eyebrow={banner.eyebrow}
      title={banner.title}
      meta={banner.meta}
      surfaceClass={banner.surface}
      textClass={banner.text}
      eyebrowClass={banner.eyebrowClass}
      tile={banner.tile}
      glyph={banner.glyph}
      decor={banner.decor}
      countdown={
        banner.countdown
          ? { value: banner.countdown, prefixLabel: 'nog', unitLabel: 'dagen' }
          : undefined
      }
    />
  );
}
