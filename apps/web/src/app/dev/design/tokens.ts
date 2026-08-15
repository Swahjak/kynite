/**
 * The token inventory rendered by `/dev/design`. Kept as data so the showcase
 * page cannot silently drift from `src/app/globals.css`.
 */

export type Swatch = { name: string; cssVar: string; className: string; note?: string };

export const BRAND_SWATCHES: Swatch[] = [
  { name: 'brand', cssVar: '--brand', className: 'bg-brand', note: 'Primary indigo #5d5fef' },
  { name: 'brand-hover', cssVar: '--brand-hover', className: 'bg-brand-hover' },
  { name: 'brand-dark', cssVar: '--brand-dark', className: 'bg-brand-dark' },
  {
    name: 'brand-ink',
    cssVar: '--brand-ink',
    className: 'bg-brand-ink',
    note: 'AA on-light brand ink',
  },
  { name: 'brand-foreground', cssVar: '--brand-foreground', className: 'bg-brand-foreground' },
  { name: 'gold', cssVar: '--gold', className: 'bg-gold', note: 'Amber accent #ef8d5d' },
  { name: 'gold-hover', cssVar: '--gold-hover', className: 'bg-gold-hover' },
  {
    name: 'gold-ink',
    cssVar: '--gold-ink',
    className: 'bg-gold-ink',
    note: 'AA on-light amber ink',
  },
];

export const SURFACE_SWATCHES: Swatch[] = [
  { name: 'background', cssVar: '--background', className: 'bg-background' },
  { name: 'surface', cssVar: '--surface', className: 'bg-surface' },
  { name: 'surface-elevated', cssVar: '--surface-elevated', className: 'bg-surface-elevated' },
  { name: 'surface-hover', cssVar: '--surface-hover', className: 'bg-surface-hover' },
];

export const INK_SWATCHES: Swatch[] = [
  { name: 'ink', cssVar: '--ink', className: 'bg-ink' },
  { name: 'ink-secondary', cssVar: '--ink-secondary', className: 'bg-ink-secondary' },
  { name: 'ink-muted', cssVar: '--ink-muted', className: 'bg-ink-muted' },
];

export const LINE_SWATCHES: Swatch[] = [
  { name: 'line', cssVar: '--line', className: 'bg-line' },
  { name: 'line-subtle', cssVar: '--line-subtle', className: 'bg-line-subtle' },
  { name: 'line-focus', cssVar: '--line-focus', className: 'bg-line-focus' },
];

export const STATUS_SWATCHES: Swatch[] = [
  { name: 'success', cssVar: '--success', className: 'bg-success' },
  { name: 'warning', cssVar: '--warning', className: 'bg-warning' },
  { name: 'error', cssVar: '--error', className: 'bg-error' },
  { name: 'info', cssVar: '--info', className: 'bg-info' },
];

export type Category = {
  name: string;
  surface: string;
  /** The pale chip outline, `--cat-*-border` = `oklch(85% 0.05 H)`. */
  border: string;
  /**
   * The 4px left rule on an event card, as a *border* colour: `--cat-*-solid`
   * = `oklch(58% 0.14 H)` (`docs/design/calendar.md` § "Event list item"). Not
   * the same tone as `border`, which is the chip outline.
   */
  rule: string;
  fg: string;
  solid: string;
  useCase: string;
};

/** The eight event/category colours from docs/design/colors.md. */
export const CATEGORIES: Category[] = [
  {
    name: 'blue',
    surface: 'bg-cat-blue-surface',
    border: 'border-cat-blue-border',
    rule: 'border-cat-blue-solid',
    fg: 'text-cat-blue-fg',
    solid: 'bg-cat-blue-solid',
    useCase: 'Sports, activities, outdoor',
  },
  {
    name: 'purple',
    surface: 'bg-cat-purple-surface',
    border: 'border-cat-purple-border',
    rule: 'border-cat-purple-solid',
    fg: 'text-cat-purple-fg',
    solid: 'bg-cat-purple-solid',
    useCase: 'Personal, gym, self-care',
  },
  {
    name: 'orange',
    surface: 'bg-cat-orange-surface',
    border: 'border-cat-orange-border',
    rule: 'border-cat-orange-solid',
    fg: 'text-cat-orange-fg',
    solid: 'bg-cat-orange-solid',
    useCase: 'Lessons, learning, school',
  },
  {
    name: 'green',
    surface: 'bg-cat-green-surface',
    border: 'border-cat-green-border',
    rule: 'border-cat-green-solid',
    fg: 'text-cat-green-fg',
    solid: 'bg-cat-green-solid',
    useCase: 'Family events, meals',
  },
  {
    name: 'red',
    surface: 'bg-cat-red-surface',
    border: 'border-cat-red-border',
    rule: 'border-cat-red-solid',
    fg: 'text-cat-red-fg',
    solid: 'bg-cat-red-solid',
    useCase: 'Date nights, special occasions',
  },
  {
    name: 'yellow',
    surface: 'bg-cat-yellow-surface',
    border: 'border-cat-yellow-border',
    rule: 'border-cat-yellow-solid',
    fg: 'text-cat-yellow-fg',
    solid: 'bg-cat-yellow-solid',
    useCase: 'Celebrations, birthdays',
  },
  {
    name: 'pink',
    surface: 'bg-cat-pink-surface',
    border: 'border-cat-pink-border',
    rule: 'border-cat-pink-solid',
    fg: 'text-cat-pink-fg',
    solid: 'bg-cat-pink-solid',
    useCase: 'Creative, arts, hobbies',
  },
  {
    name: 'teal',
    surface: 'bg-cat-teal-surface',
    border: 'border-cat-teal-border',
    rule: 'border-cat-teal-solid',
    fg: 'text-cat-teal-fg',
    solid: 'bg-cat-teal-solid',
    useCase: 'Health, wellness, appointments',
  },
];

export const TYPE_SCALE = [
  { name: 'Display XL', className: 'text-display-xl font-display', spec: '80px / 900 / 1.0' },
  { name: 'Display LG', className: 'text-display-lg font-display', spec: '64px / 800 / 1.1' },
  { name: 'Display MD', className: 'text-display-md font-display', spec: '36px / 800 / 1.15' },
  { name: 'H1', className: 'text-h1 font-display', spec: '32px / 700 / 1.2' },
  { name: 'H2', className: 'text-h2 font-display', spec: '24px / 700 / 1.3' },
  { name: 'H3', className: 'text-h3 font-display', spec: '20px / 600 / 1.4' },
  { name: 'Body Large', className: 'text-body-lg font-body', spec: '18px / 400 / 1.5' },
  { name: 'Body', className: 'text-body font-body', spec: '16px / 400 / 1.5' },
  { name: 'Body Small', className: 'text-body-sm font-body', spec: '14px / 400 / 1.5' },
  { name: 'Caption', className: 'text-caption font-display', spec: '12px / 500 / 1.4' },
  { name: 'Overline', className: 'label-overline', spec: '10px / 700 / uppercase' },
];

export const ICON_SAMPLES = [
  'dashboard',
  'calendar_month',
  'schedule',
  'add',
  'settings',
  'notifications',
  'family_home',
  'check',
  'location_on',
  'timer',
  'star',
  'local_fire_department',
] as const;
