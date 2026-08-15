/**
 * The fixture household every `Pages/*` story renders.
 *
 * One file, shared, because the page stories are read side by side: if Vandaag
 * says Mila has 9 stars and Beloningen says 14, the reader spends their
 * attention reconciling two fictions instead of looking at the layout. So the
 * numbers agree — Mila is on 3 of 5 steps, has 28 stars saved and 12 to go for
 * "Zwemmen met papa", on every screen that mentions any of it.
 *
 * The data matches the design sheets (`docs/design/claude-design/*.dc.html`)
 * on purpose, down to the times and the copy, so a story and its sheet can be
 * put next to each other and compared without translating names.
 *
 * Everything here is *presentational* data: labels, not domain objects. The
 * package has no idea what a routine occurrence or an RRULE is, and these
 * fixtures deliberately do not teach it — a `time` is the string "08:15", not
 * a Date, because the string is what the component renders.
 */

import type { IconName } from '../src/components/icon-codepoints';

/** Friday 14 August 2026, 08:42 — the moment every screen is frozen at. */
export const TODAY = {
  clock: '08:42',
  long: 'vrijdag 14 augustus 2026',
  short: 'vrijdag 14 augustus',
  greeting: 'Goedemorgen',
} as const;

export type Member = {
  id: string;
  name: string;
  avatar: string;
  role: 'parent' | 'child';
  /** The member's hue, as the three class strings the package components take. */
  surface: string;
  solid: string;
  bar: string;
};

/**
 * The classes are spelled out rather than built from a hue name: Tailwind
 * scans source text, so `bg-cat-${hue}-surface` would never be generated.
 * `MEMBER_COLOR_CLASSES` in the app is written out for the same reason.
 */
export const TOM: Member = {
  id: 'tom',
  name: 'Tom',
  avatar: '/avatars/parent1.svg',
  role: 'parent',
  surface: 'bg-cat-yellow-surface text-cat-yellow-fg',
  solid: 'bg-cat-yellow-solid',
  bar: 'bg-cat-yellow-solid',
};

export const LOTTE: Member = {
  id: 'lotte',
  name: 'Lotte',
  avatar: '/avatars/parent2.svg',
  role: 'parent',
  surface: 'bg-cat-purple-surface text-cat-purple-fg',
  solid: 'bg-cat-purple-solid',
  bar: 'bg-cat-purple-solid',
};

export const MILA: Member = {
  id: 'mila',
  name: 'Mila',
  avatar: '/avatars/child1.svg',
  role: 'child',
  surface: 'bg-cat-pink-surface text-cat-pink-fg',
  solid: 'bg-cat-pink-solid',
  bar: 'bg-cat-pink-solid',
};

export const DAAN: Member = {
  id: 'daan',
  name: 'Daan',
  avatar: '/avatars/child2.svg',
  role: 'child',
  surface: 'bg-cat-blue-surface text-cat-blue-fg',
  solid: 'bg-cat-blue-solid',
  bar: 'bg-cat-blue-solid',
};

export const FAMILY: readonly Member[] = [TOM, LOTTE, MILA, DAAN];
export const KIDS: readonly Member[] = [MILA, DAAN];

/** `FaceStack` takes `{ id, name, avatarUrl, surfaceClass }`. */
export const FACES = FAMILY.map((member) => ({
  id: member.id,
  name: member.name,
  avatarUrl: member.avatar,
  surfaceClass: member.surface,
}));

/* -------------------------------------------------------------------------- */
/* The day                                                                     */
/* -------------------------------------------------------------------------- */

export type DayEvent = {
  id: string;
  time: string;
  /** Every row shows a range now: the sheet stacks start over end. */
  end: string;
  title: string;
  who: string;
  /** The category's glyph — the half of the taxonomy colour cannot carry. */
  icon: IconName;
  /** Dot / rail colour — the *category*, not the member. */
  solid: string;
  /** The glyph's ink, one step darker than `solid` so it reads at 20px. */
  iconText: string;
  surface: string;
  border: string;
  /** Already happened, struck through. */
  done?: boolean;
  /** Running right now — the "NU" reading. */
  now?: boolean;
  /**
   * A calendar the household may see the shape of but not the contents of.
   * Drawn with a hatch and no colour; see `Pages/Calendar view patterns`.
   */
  busy?: boolean;
};

export const DAY: readonly DayEvent[] = [
  {
    id: 'ontbijt',
    time: '07:30',
    end: '08:00',
    title: 'Ontbijt',
    who: 'Iedereen',
    icon: 'restaurant',
    iconText: 'text-cat-teal-fg',
    solid: 'bg-cat-teal-solid',
    surface: 'bg-cat-teal-surface',
    border: 'border-cat-teal-border',
    done: true,
  },
  {
    id: 'ochtendroutine',
    time: '08:15',
    end: '09:00',
    title: 'Ochtendroutine',
    who: 'Mila & Daan',
    icon: 'wb_twilight',
    iconText: 'text-cat-teal-fg',
    solid: 'bg-cat-teal-solid',
    surface: 'bg-cat-teal-surface',
    border: 'border-cat-teal-border',
    now: true,
  },
  {
    id: 'schoolreis',
    time: '09:15',
    end: '11:30',
    title: 'Schoolreis',
    who: 'Mila & Daan',
    icon: 'school',
    iconText: 'text-cat-blue-fg',
    solid: 'bg-cat-blue-solid',
    surface: 'bg-cat-blue-surface',
    border: 'border-cat-blue-border',
  },
  {
    id: 'tandarts',
    time: '10:00',
    end: '10:45',
    title: 'Tandarts',
    who: 'Lotte',
    icon: 'medical_services',
    iconText: 'text-cat-red-fg',
    solid: 'bg-cat-red-solid',
    surface: 'bg-cat-red-surface',
    border: 'border-cat-red-border',
  },
  {
    id: 'bezet',
    time: '11:00',
    end: '12:00',
    title: 'Bezet',
    who: 'Tom',
    icon: 'lock',
    iconText: 'text-ink-muted',
    solid: 'bg-line',
    surface: 'bg-surface-container',
    border: 'border-line-subtle',
    busy: true,
  },
  {
    id: 'werklunch',
    time: '12:30',
    end: '13:30',
    title: 'Werklunch',
    who: 'Tom',
    icon: 'work',
    iconText: 'text-cat-teal-fg',
    solid: 'bg-cat-teal-solid',
    surface: 'bg-cat-teal-surface',
    border: 'border-cat-teal-border',
  },
  {
    id: 'voetbal',
    time: '15:30',
    end: '16:30',
    title: 'Voetbaltraining',
    who: 'Mila',
    icon: 'sports_soccer',
    iconText: 'text-cat-green-fg',
    solid: 'bg-cat-green-solid',
    surface: 'bg-cat-green-surface',
    border: 'border-cat-green-border',
  },
  {
    id: 'etentje',
    time: '18:00',
    end: '19:00',
    title: 'Etentje bij oma',
    who: 'Iedereen',
    icon: 'celebration',
    iconText: 'text-cat-pink-fg',
    solid: 'bg-cat-pink-solid',
    surface: 'bg-cat-pink-surface',
    border: 'border-cat-pink-border',
  },
  {
    id: 'bedtime',
    time: '19:30',
    end: '20:00',
    title: 'Bedtime routine',
    who: 'Mila & Daan',
    icon: 'bedtime',
    iconText: 'text-cat-teal-fg',
    solid: 'bg-cat-teal-solid',
    surface: 'bg-cat-teal-surface',
    border: 'border-cat-teal-border',
  },
];

/** What each member's day looks like, for the "Per persoon" reading. */
export const PER_MEMBER: Record<string, readonly string[]> = {
  tom: ['bezet', 'werklunch'],
  lotte: ['tandarts'],
  mila: ['ontbijt', 'ochtendroutine', 'schoolreis', 'voetbal', 'etentje', 'bedtime'],
  daan: ['ontbijt', 'ochtendroutine', 'schoolreis', 'etentje', 'bedtime'],
};

/**
 * Who is on an event, read back out of `PER_MEMBER` rather than restated on the
 * event. The day sheet now draws faces on every row instead of naming people in
 * a subtitle, and two lists of the same fact drift the moment one is edited.
 */
export function facesOf(eventId: string) {
  return FAMILY.filter((member) => PER_MEMBER[member.id]?.includes(eventId)).map((member) => ({
    id: member.id,
    name: member.name,
    avatarUrl: member.avatar,
    surfaceClass: member.surface,
  }));
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                       */
/* -------------------------------------------------------------------------- */

export const TASKS: readonly { id: string; title: string; done: boolean; owner: Member }[] = [
  { id: 'boodschappen', title: 'Boodschappen bestellen', done: false, owner: LOTTE },
  { id: 'vaatwasser', title: 'Vaatwasser uitruimen', done: true, owner: MILA },
  { id: 'hond', title: 'Hond uitlaten', done: false, owner: TOM },
  { id: 'prullenbak', title: 'Prullenbak buiten zetten', done: false, owner: DAAN },
];

/* -------------------------------------------------------------------------- */
/* Routines                                                                    */
/* -------------------------------------------------------------------------- */

/** Today's progress per child, as `Vandaag` and the kindbord both report it. */
export const ROUTINE_PROGRESS = [
  { member: MILA, doneSteps: 3, totalSteps: 5, stars: 9, percent: 60 },
  { member: DAAN, doneSteps: 2, totalSteps: 5, stars: 6, percent: 40 },
] as const;

/** The five steps of Mila's morning routine, three of them behind her. */
export const MORNING_STEPS = [
  { id: 'uit-bed', title: 'Uit bed', done: true, timerSeconds: null, praiseKey: 'great' },
  { id: 'aankleden', title: 'Aankleden', done: true, timerSeconds: null, praiseKey: 'proud' },
  { id: 'bed-opmaken', title: 'Bed opmaken', done: true, timerSeconds: null, praiseKey: 'great' },
  { id: 'tanden', title: 'Tanden poetsen', done: false, timerSeconds: 120, praiseKey: 'proud' },
  { id: 'tas', title: 'Tas inpakken', done: false, timerSeconds: null, praiseKey: 'great' },
] as const;

/** The parent's beheer list — per child, in the order they run. */
export type ManagedRoutine = {
  id: string;
  title: string;
  icon: IconName;
  schedule: string;
  stars: number | null;
  active: boolean;
};

export const MANAGED: readonly { member: Member; routines: readonly ManagedRoutine[] }[] = [
  {
    member: MILA,
    routines: [
      {
        id: 'ochtend',
        title: 'Ochtendroutine',
        icon: 'wb_sunny',
        schedule: 'elke schooldag 07:15 · 5 stappen',
        stars: 3,
        active: true,
      },
      {
        id: 'huiswerk',
        title: 'Huiswerk',
        icon: 'backpack',
        schedule: 'ma di do 16:00 · 3 stappen',
        stars: 2,
        active: true,
      },
      {
        id: 'voetbaltas',
        title: 'Tas voor voetbal',
        icon: 'sports_soccer',
        schedule: 'eenmalig — vr 14 aug',
        stars: 1,
        active: true,
      },
      {
        id: 'was',
        title: 'Was opruimen',
        icon: 'checkroom',
        schedule: 'inactief · zo 18:00',
        stars: null,
        active: false,
      },
    ],
  },
  {
    member: DAAN,
    routines: [
      {
        id: 'ochtend-daan',
        title: 'Ochtendroutine',
        icon: 'wb_sunny',
        schedule: 'elke schooldag 07:15 · 5 stappen',
        stars: 3,
        active: true,
      },
      {
        id: 'bedtime-daan',
        title: 'Bedtime routine',
        icon: 'dark_mode',
        schedule: 'elke dag 19:00 · 4 stappen',
        stars: 3,
        active: true,
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Rewards                                                                     */
/* -------------------------------------------------------------------------- */

export const BALANCES = [
  { member: MILA, balance: 28, earned: 62, spent: 34 },
  { member: DAAN, balance: 14, earned: 30, spent: 16 },
] as const;

/** Mila's week, as the store's bar chart draws it. `vr` is today. */
export const WEEK_STARS: readonly { day: string; stars: number; today?: boolean }[] = [
  { day: 'ma', stars: 4 },
  { day: 'di', stars: 6 },
  { day: 'wo', stars: 2 },
  { day: 'do', stars: 0 },
  { day: 'vr', stars: 3, today: true },
  { day: 'za', stars: 0 },
  { day: 'zo', stars: 0 },
];

export const WEEK_TOTAL = 19;

export const LEDGER: readonly {
  id: string;
  icon: IconName;
  title: string;
  amount: string | null;
}[] = [
  { id: 'ochtend', icon: 'star', title: 'Ochtendroutine', amount: '+3' },
  { id: 'verrassing', icon: 'redeem', title: 'Verrassing van mama', amount: '+5' },
  { id: 'afgestudeerd', icon: 'workspace_premium', title: 'Ontbijt afgestudeerd', amount: null },
];

export const SAVINGS_GOAL = {
  rewardId: 'zwemmen',
  title: 'Zwemmen met papa',
  costStars: 40,
  progressStars: 28,
  ratio: 28 / 40,
} as const;

export type StoreTile = {
  id: string;
  title: string;
  icon: IconName;
  costStars: number;
  category: string;
  state: 'affordable' | 'outOfReach' | 'requested';
  tileClass: string;
};

export const STORE: readonly StoreTile[] = [
  {
    id: 'film',
    title: 'Film uitkiezen',
    icon: 'movie',
    costStars: 10,
    category: 'Privilege',
    state: 'affordable',
    tileClass: 'bg-cat-purple-surface text-cat-purple-fg',
  },
  {
    id: 'ijsje',
    title: 'IJsje halen',
    icon: 'icecream',
    costStars: 6,
    category: 'Traktatie',
    state: 'affordable',
    tileClass: 'bg-cat-red-surface text-cat-red-fg',
  },
  {
    id: 'later-bed',
    title: 'Half uur later naar bed',
    icon: 'dark_mode',
    costStars: 12,
    category: 'Privilege',
    state: 'requested',
    tileClass: 'bg-cat-blue-surface text-cat-blue-fg',
  },
  {
    id: 'speeltijd',
    title: 'Extra speeltijd',
    icon: 'sports_esports',
    costStars: 8,
    category: 'Privilege',
    state: 'affordable',
    tileClass: 'bg-cat-green-surface text-cat-green-fg',
  },
  {
    id: 'zwemmen',
    title: 'Zwemmen met papa',
    icon: 'pool',
    costStars: 40,
    category: 'Ervaring',
    state: 'outOfReach',
    tileClass: 'bg-cat-teal-surface text-cat-teal-fg',
  },
  {
    id: 'bioscoop',
    title: 'Naar de bioscoop',
    icon: 'event',
    costStars: 50,
    category: 'Ervaring',
    state: 'outOfReach',
    tileClass: 'bg-cat-orange-surface text-cat-orange-fg',
  },
];

/** The parent's approval queue — oldest first, and never a way to take stars back. */
export const QUEUE: readonly {
  id: string;
  title: string;
  member: Member;
  waited: string;
  costStars: number;
}[] = [
  {
    id: 'speeltijd',
    title: 'Extra speeltijd',
    member: DAAN,
    waited: '2 dagen geleden',
    costStars: 8,
  },
  {
    id: 'later-bed',
    title: 'Half uur later naar bed',
    member: MILA,
    waited: 'vanmorgen 08:10',
    costStars: 12,
  },
];

export const OUTSTANDING: readonly {
  id: string;
  title: string;
  member: Member;
  meta: string;
  scheduled?: boolean;
}[] = [
  { id: 'film', title: 'Film uitkiezen', member: MILA, meta: 'goedgekeurd di 11 aug' },
  {
    id: 'zwemmen',
    title: 'Zwemmen met papa',
    member: DAAN,
    meta: 'staat op de kalender — za 16 aug',
    scheduled: true,
  },
];

/* -------------------------------------------------------------------------- */
/* The week, for the calendar                                                  */
/* -------------------------------------------------------------------------- */

export const WEEK_DAYS: readonly {
  dow: string;
  date: number;
  today?: boolean;
  weekend?: boolean;
}[] = [
  { dow: 'ma', date: 10 },
  { dow: 'di', date: 11 },
  { dow: 'wo', date: 12 },
  { dow: 'do', date: 13 },
  { dow: 'vr', date: 14, today: true },
  { dow: 'za', date: 15, weekend: true },
  { dow: 'zo', date: 16, weekend: true },
];

export const HOURS: readonly string[] = [
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
];

/** 58px per hour, and the grid starts at 06:00 — the geometry the app uses. */
export const HOUR_HEIGHT = 58;

export const topFor = (time: string): number => {
  const [hour, minute] = time.split(':').map(Number);
  return ((hour - 6) * 60 + minute) * (HOUR_HEIGHT / 60);
};

export const heightFor = (from: string, to: string): number => topFor(to) - topFor(from);

/** The mobile week view: an agenda list per day, not a seven-column grid. */
export const AGENDA: readonly {
  dow: string;
  date: number;
  today?: boolean;
  items: readonly { id: string; title: string; meta: string; solid: string; member: Member }[];
}[] = [
  {
    dow: 'vr',
    date: 14,
    today: true,
    items: [
      {
        id: 'ochtendroutine',
        title: 'Ochtendroutine',
        meta: '08:15 · Mila & Daan',
        solid: 'bg-cat-teal-solid',
        member: MILA,
      },
      {
        id: 'schoolreis',
        title: 'Schoolreis',
        meta: '09:15 – 11:30 · Mila & Daan',
        solid: 'bg-cat-blue-solid',
        member: DAAN,
      },
      {
        id: 'tandarts',
        title: 'Tandarts',
        meta: '10:00 · Lotte',
        solid: 'bg-cat-red-solid',
        member: LOTTE,
      },
      {
        id: 'werklunch',
        title: 'Werklunch',
        meta: '12:30 · Tom',
        solid: 'bg-cat-yellow-solid',
        member: TOM,
      },
      {
        id: 'voetbal',
        title: 'Voetbaltraining',
        meta: '15:30 · Mila',
        solid: 'bg-cat-green-solid',
        member: MILA,
      },
      {
        id: 'etentje',
        title: 'Etentje bij oma',
        meta: '18:00 – 19:30 · Iedereen',
        solid: 'bg-cat-pink-solid',
        member: TOM,
      },
    ],
  },
  {
    dow: 'za',
    date: 15,
    items: [
      {
        id: 'wedstrijd',
        title: 'Voetbalwedstrijd',
        meta: '10:00 – 11:30 · Mila',
        solid: 'bg-cat-green-solid',
        member: MILA,
      },
      {
        id: 'boodschappen',
        title: 'Boodschappen',
        meta: '14:00 · Lotte',
        solid: 'bg-cat-purple-solid',
        member: LOTTE,
      },
    ],
  },
  {
    dow: 'zo',
    date: 16,
    items: [
      {
        id: 'familiedag',
        title: 'Familiedag',
        meta: '12:00 – 14:00 · Iedereen',
        solid: 'bg-cat-pink-solid',
        member: TOM,
      },
    ],
  },
  {
    dow: 'ma',
    date: 17,
    items: [
      {
        id: 'school',
        title: 'School',
        meta: '08:30 – 15:00 · Mila & Daan',
        solid: 'bg-cat-blue-solid',
        member: DAAN,
      },
      {
        id: 'zwemles',
        title: 'Zwemles',
        meta: '15:30 · Daan',
        solid: 'bg-cat-green-solid',
        member: DAAN,
      },
    ],
  },
  {
    dow: 'di',
    date: 18,
    items: [
      {
        id: 'school-di',
        title: 'School',
        meta: '08:30 – 15:00 · Mila & Daan',
        solid: 'bg-cat-blue-solid',
        member: MILA,
      },
      {
        id: 'lotte-thuis',
        title: 'Lotte thuis',
        meta: '13:00 – 17:00',
        solid: 'bg-cat-purple-solid',
        member: LOTTE,
      },
    ],
  },
];

/** August 2026 as a month grid: the 1st is a Saturday, so the grid starts on 27 July. */
export const MONTH_CELLS: readonly {
  date: number;
  outside?: boolean;
  today?: boolean;
  events: readonly { title: string; solid: string }[];
}[] = (() => {
  const events: Record<number, { title: string; solid: string }[]> = {
    3: [{ title: 'Zwemles', solid: 'bg-cat-green-solid' }],
    4: [{ title: 'Ouderavond', solid: 'bg-cat-pink-solid' }],
    6: [{ title: 'Familiedag', solid: 'bg-cat-pink-solid' }],
    10: [
      { title: 'School', solid: 'bg-cat-blue-solid' },
      { title: 'Zwemles', solid: 'bg-cat-green-solid' },
    ],
    11: [
      { title: 'School', solid: 'bg-cat-blue-solid' },
      { title: 'Lotte thuis', solid: 'bg-cat-purple-solid' },
    ],
    12: [
      { title: 'School', solid: 'bg-cat-blue-solid' },
      { title: 'Huisarts', solid: 'bg-cat-red-solid' },
    ],
    13: [
      { title: 'School', solid: 'bg-cat-blue-solid' },
      { title: 'Ouderavond', solid: 'bg-cat-pink-solid' },
    ],
    14: [
      { title: 'Schoolreis', solid: 'bg-cat-blue-solid' },
      { title: 'Werklunch', solid: 'bg-cat-yellow-solid' },
      { title: 'Etentje', solid: 'bg-cat-pink-solid' },
    ],
    15: [{ title: 'Voetbalwedstrijd', solid: 'bg-cat-green-solid' }],
    16: [{ title: 'Familiedag', solid: 'bg-cat-pink-solid' }],
    17: [{ title: 'School', solid: 'bg-cat-blue-solid' }],
    19: [{ title: 'Zwemles', solid: 'bg-cat-green-solid' }],
    22: [{ title: 'Verjaardag Mila', solid: 'bg-cat-pink-solid' }],
    26: [{ title: 'Tandarts', solid: 'bg-cat-red-solid' }],
    31: [{ title: 'Eerste schooldag', solid: 'bg-cat-blue-solid' }],
  };

  const cells: {
    date: number;
    outside?: boolean;
    today?: boolean;
    events: { title: string; solid: string }[];
  }[] = [];

  for (let date = 27; date <= 31; date += 1) cells.push({ date, outside: true, events: [] });
  for (let date = 1; date <= 31; date += 1) {
    cells.push({ date, today: date === 14, events: events[date] ?? [] });
  }
  for (let date = 1; date <= 6; date += 1) cells.push({ date, outside: true, events: [] });

  return cells;
})();
