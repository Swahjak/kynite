import type { MemberColor } from '../schema';

/**
 * Member color → design-system classes. Written out in full because Tailwind
 * scans source text: `bg-member-${color}-lijn` would never be generated.
 *
 * M-K (`docs/design/claude-design/Ledenkleuren.dc.html`) replaced the eight
 * borrowed `--cat-*` category hues with the product's own six-slot member
 * palette (`--member-<slot>-*`, `packages/ui/src/styles/tokens.css`) and
 * named every carrier a member's colour is allowed to be, instead of one
 * `surface`/`ring`/`border`/`dot` set doing double duty for whatever a call
 * site reached for. Each key below is one *step* of the four-step ramp,
 * named for the step rather than for a specific component, and each is a
 * single carrier — the sheet's "one drager per element" rule:
 *
 *   wassing → `surface`  icon tile background / soft row fill. NOT an
 *                        avatar's disc — that is `track` (baan), one step
 *                        down the ramp; see `MemberAvatar`'s comment.
 *   baan    → `track`    empty progress track, avatar disc background.
 *   lijn    → `dot` / `ring` / `border` / `line` / `fill` — all the SAME
 *             tint (`oklch(58% 0.14 H)`), split into five keys only because
 *             five different Tailwind *properties* (bg/ring-color/
 *             border-color) need their own utility class:
 *               dot    — the 8px star-counter dot, the avatar-ring colour
 *                        used as a plain fill (`bg-member-*-lijn`).
 *               ring   — `ring-*` utility for an avatar's ring / a focus-style
 *                        halo.
 *               border — `border-*` utility for the 3px underline under a
 *                        board-column or calendar-column header.
 *               line   — `bg-*` utility for the 4px standing/left rule on an
 *                        agenda or routine-card row.
 *               fill   — `bg-*` utility for a progress bar's filled portion.
 *   inkt    → `ink`      text/icon-only colour. NEVER running text — the
 *             sheet's own floor, tightened further by petrol's 3.6:1 on
 *             cream. Only ever pairs with a short glyph or a 1–2 digit
 *             number, on a `wassing` (or lighter) ground.
 */
export const MEMBER_COLOR_CLASSES: Record<
  MemberColor,
  {
    dot: string;
    surface: string;
    ring: string;
    border: string;
    line: string;
    track: string;
    fill: string;
    ink: string;
  }
> = {
  raspberry: {
    dot: 'bg-member-raspberry-lijn',
    surface: 'bg-member-raspberry-wassing',
    ring: 'ring-member-raspberry-lijn',
    border: 'border-member-raspberry-lijn',
    line: 'bg-member-raspberry-lijn',
    track: 'bg-member-raspberry-baan',
    fill: 'bg-member-raspberry-lijn',
    ink: 'text-member-raspberry-inkt',
  },
  blue: {
    dot: 'bg-member-blue-lijn',
    surface: 'bg-member-blue-wassing',
    ring: 'ring-member-blue-lijn',
    border: 'border-member-blue-lijn',
    line: 'bg-member-blue-lijn',
    track: 'bg-member-blue-baan',
    fill: 'bg-member-blue-lijn',
    ink: 'text-member-blue-inkt',
  },
  petrol: {
    dot: 'bg-member-petrol-lijn',
    surface: 'bg-member-petrol-wassing',
    ring: 'ring-member-petrol-lijn',
    border: 'border-member-petrol-lijn',
    line: 'bg-member-petrol-lijn',
    track: 'bg-member-petrol-baan',
    fill: 'bg-member-petrol-lijn',
    ink: 'text-member-petrol-inkt',
  },
  orchid: {
    dot: 'bg-member-orchid-lijn',
    surface: 'bg-member-orchid-wassing',
    ring: 'ring-member-orchid-lijn',
    border: 'border-member-orchid-lijn',
    line: 'bg-member-orchid-lijn',
    track: 'bg-member-orchid-baan',
    fill: 'bg-member-orchid-lijn',
    ink: 'text-member-orchid-inkt',
  },
  mustard: {
    dot: 'bg-member-mustard-lijn',
    surface: 'bg-member-mustard-wassing',
    ring: 'ring-member-mustard-lijn',
    border: 'border-member-mustard-lijn',
    line: 'bg-member-mustard-lijn',
    track: 'bg-member-mustard-baan',
    fill: 'bg-member-mustard-lijn',
    ink: 'text-member-mustard-inkt',
  },
  terracotta: {
    dot: 'bg-member-terracotta-lijn',
    surface: 'bg-member-terracotta-wassing',
    ring: 'ring-member-terracotta-lijn',
    border: 'border-member-terracotta-lijn',
    line: 'bg-member-terracotta-lijn',
    track: 'bg-member-terracotta-baan',
    fill: 'bg-member-terracotta-lijn',
    ink: 'text-member-terracotta-inkt',
  },
};

/** Built-in avatars (public/avatars). Families that want a photo come later. */
export const MEMBER_AVATARS = [
  'fox',
  'bear',
  'cat',
  'owl',
  'rocket',
  'star',
  'flower',
  'dino',
] as const;

export type MemberAvatar = (typeof MEMBER_AVATARS)[number];

export const avatarUrlFor = (avatar: MemberAvatar): string => `/avatars/${avatar}.svg`;

export function avatarNameFrom(url: string | null): MemberAvatar | null {
  const match = /^\/avatars\/([a-z]+)\.svg$/.exec(url ?? '');
  const name = match?.[1] as MemberAvatar | undefined;
  return name && MEMBER_AVATARS.includes(name) ? name : null;
}

export function initialsOf(displayName: string): string {
  return displayName.trim().slice(0, 2).toUpperCase();
}
