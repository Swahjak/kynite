import type { MemberColor } from '../schema';

/**
 * Member color → design-system classes. Written out in full because Tailwind
 * scans source text: `bg-cat-${color}-solid` would never be generated.
 *
 * `ring` is M19 phase 2: the mockups identify a person by *ringing their
 * avatar* in their own colour (`kynite_design_system_overview/code.html:67-68`,
 * `ring-2 … ring-offset-2`), not by parking a separate dot next to it
 * (docs/rebuild-design-gaps.md §9, "Avatars: 2px ring in a member colour").
 */
export const MEMBER_COLOR_CLASSES: Record<
  MemberColor,
  { dot: string; surface: string; ring: string }
> = {
  blue: {
    dot: 'bg-cat-blue-solid',
    surface: 'bg-cat-blue-surface text-cat-blue-fg',
    ring: 'ring-cat-blue-solid',
  },
  purple: {
    dot: 'bg-cat-purple-solid',
    surface: 'bg-cat-purple-surface text-cat-purple-fg',
    ring: 'ring-cat-purple-solid',
  },
  orange: {
    dot: 'bg-cat-orange-solid',
    surface: 'bg-cat-orange-surface text-cat-orange-fg',
    ring: 'ring-cat-orange-solid',
  },
  green: {
    dot: 'bg-cat-green-solid',
    surface: 'bg-cat-green-surface text-cat-green-fg',
    ring: 'ring-cat-green-solid',
  },
  red: {
    dot: 'bg-cat-red-solid',
    surface: 'bg-cat-red-surface text-cat-red-fg',
    ring: 'ring-cat-red-solid',
  },
  yellow: {
    dot: 'bg-cat-yellow-solid',
    surface: 'bg-cat-yellow-surface text-cat-yellow-fg',
    ring: 'ring-cat-yellow-solid',
  },
  pink: {
    dot: 'bg-cat-pink-solid',
    surface: 'bg-cat-pink-surface text-cat-pink-fg',
    ring: 'ring-cat-pink-solid',
  },
  teal: {
    dot: 'bg-cat-teal-solid',
    surface: 'bg-cat-teal-surface text-cat-teal-fg',
    ring: 'ring-cat-teal-solid',
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
