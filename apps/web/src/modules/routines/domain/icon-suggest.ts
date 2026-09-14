import type { IconName } from '@kynite/ui';

/**
 * The household icon set (M5 of the 2026-09-14 taken-board-routines-page
 * plan). One closed list shared by routines, routine steps and tasks — the
 * three surfaces that all show an "activity" glyph and all fall back to the
 * same suggester when nobody has picked one.
 *
 * Framework-free like every other file under `domain/`: no database, no
 * React. Every entry is in the Material Symbols subset
 * (`apps/web/scripts/subset-icons.mjs`'s `EXTRA_ICONS`) — `pnpm icons:check`
 * fails the build if this list and the shipped font ever drift apart.
 */
export const ACTIVITY_ICONS = [
  'task_alt',
  'wb_sunny',
  'dark_mode',
  'schedule',
  'checklist',
  'star',
  'timer',
  'event_available',
  'dentistry',
  'checkroom',
  'restaurant',
  'backpack',
  'wash',
  'nutrition',
  'menu_book',
  'auto_stories',
  'wc',
  'crib',
  'pets',
  'lunch_dining',
  'directions_car',
  'local_laundry_service',
  'pedal_bike',
  'shopping_cart',
  'countertops',
  'toys',
  'bedroom_baby',
  'delete',
  'potted_plant',
  'mail',
  'wb_twilight',
  'celebration',
  'emoji_events',
  'swipe',
  'self_improvement',
] as const satisfies readonly IconName[];

export type ActivityIcon = (typeof ACTIVITY_ICONS)[number];

export const DEFAULT_ACTIVITY_ICON: ActivityIcon = 'task_alt';

export function isActivityIcon(value: string): value is ActivityIcon {
  return (ACTIVITY_ICONS as readonly string[]).includes(value);
}

/**
 * Keyword → icon, nl first (the household's own language) then en. Matched
 * word-boundary based, in declaration order — so a title that matches two
 * keywords takes the first table entry, which is why the more specific words
 * (`ontbijt`, `afwas`) come before the general ones (`eten`, `was`). A
 * keyword with a space is matched as a substring (a phrase); a single-word
 * keyword is matched against the lowercased title's tokens (split on
 * non-letters) — a token must equal the keyword, or (for keywords of 4+
 * letters, to keep short keywords like `bin` from prefix-matching unrelated
 * words like "Bingo") start with it, so `tanden` still catches
 * `tandenpoetsen`.
 */
const KEYWORDS: ReadonlyArray<readonly [string, ActivityIcon]> = [
  // Hygiene
  ['tanden', 'dentistry'],
  ['teeth', 'dentistry'],
  ['brush', 'dentistry'],
  ['douch', 'wash'],
  ['shower', 'wash'],
  ['handen wassen', 'wash'],
  ['wash hands', 'wash'],
  ['wassen', 'wash'],
  ['wash', 'wash'],
  ['wc', 'wc'],
  ['plas', 'wc'],
  ['toilet', 'wc'],
  ['potty', 'wc'],
  // Getting dressed
  ['aankleden', 'checkroom'],
  ['kleren', 'checkroom'],
  ['kleed', 'checkroom'],
  ['dress', 'checkroom'],
  ['clothes', 'checkroom'],
  // Food
  ['ontbijt', 'restaurant'],
  ['breakfast', 'restaurant'],
  ['lunch', 'lunch_dining'],
  ['diner', 'restaurant'],
  ['avondeten', 'restaurant'],
  ['dinner', 'restaurant'],
  ['eten', 'restaurant'],
  ['eat', 'restaurant'],
  ['food', 'nutrition'],
  ['voeding', 'nutrition'],
  ['snack', 'nutrition'],
  // School / bag
  ['school', 'backpack'],
  ['tas', 'backpack'],
  ['rugzak', 'backpack'],
  ['bag', 'backpack'],
  ['backpack', 'backpack'],
  // Reading
  ['voorlezen', 'auto_stories'],
  ['bedtime story', 'auto_stories'],
  ['story', 'auto_stories'],
  ['lezen', 'menu_book'],
  ['boek', 'menu_book'],
  ['read', 'menu_book'],
  ['book', 'menu_book'],
  // Sleep
  ['slapen', 'crib'],
  ['bed', 'crib'],
  ['slaap', 'crib'],
  ['nap', 'crib'],
  ['sleep', 'crib'],
  // Chores
  ['afwas', 'countertops'],
  ['opruimen', 'countertops'],
  ['keuken', 'countertops'],
  ['tidy', 'countertops'],
  ['clean up', 'countertops'],
  ['kitchen', 'countertops'],
  ['was ', 'local_laundry_service'],
  ['wasje', 'local_laundry_service'],
  ['wasmachine', 'local_laundry_service'],
  ['laundry', 'local_laundry_service'],
  ['vuilnis', 'delete'],
  ['afval', 'delete'],
  ['prullenbak', 'delete'],
  ['trash', 'delete'],
  ['garbage', 'delete'],
  ['bin', 'delete'],
  ['planten', 'potted_plant'],
  ['water geven', 'potted_plant'],
  ['plant', 'potted_plant'],
  ['post', 'mail'],
  ['brief', 'mail'],
  ['mail', 'mail'],
  ['boodschappen', 'shopping_cart'],
  ['winkel', 'shopping_cart'],
  ['groceries', 'shopping_cart'],
  ['shopping', 'shopping_cart'],
  // Getting around
  ['fiets', 'pedal_bike'],
  ['bike', 'pedal_bike'],
  ['cycl', 'pedal_bike'],
  ['auto', 'directions_car'],
  ['rijden', 'directions_car'],
  ['car', 'directions_car'],
  ['drive', 'directions_car'],
  // Play / pets
  ['speelgoed', 'toys'],
  ['spelen', 'toys'],
  ['toy', 'toys'],
  ['play', 'toys'],
  ['huisdier', 'pets'],
  ['hond', 'pets'],
  ['kat', 'pets'],
  ['dog', 'pets'],
  ['cat', 'pets'],
  ['pet', 'pets'],
  // Movement / calm
  ['sport', 'self_improvement'],
  ['yoga', 'self_improvement'],
  ['bewegen', 'self_improvement'],
  ['rust', 'self_improvement'],
  ['stretch', 'self_improvement'],
  ['exercise', 'self_improvement'],
  // Celebration
  ['vieren', 'celebration'],
  ['feest', 'celebration'],
  ['party', 'celebration'],
  ['celebrat', 'celebration'],
  ['prijs', 'emoji_events'],
  ['trofee', 'emoji_events'],
  ['trophy', 'emoji_events'],
  ['award', 'emoji_events'],
];

/**
 * The default whenever `icon` is null for a routine, step or task — nl+en
 * keyword match against the title, falling back to `DEFAULT_ACTIVITY_ICON`
 * when nothing matches.
 */
export function suggestIcon(title: string): ActivityIcon {
  const lower = title.toLowerCase();
  const tokens = lower.split(/[^\p{L}]+/u).filter(Boolean);

  for (const [keyword, icon] of KEYWORDS) {
    if (keyword.includes(' ')) {
      if (lower.includes(keyword)) return icon;
      continue;
    }

    const matches = tokens.some(
      (token) => token === keyword || (keyword.length >= 4 && token.startsWith(keyword))
    );
    if (matches) return icon;
  }

  return DEFAULT_ACTIVITY_ICON;
}
