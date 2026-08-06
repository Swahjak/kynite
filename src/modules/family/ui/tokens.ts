import type { MemberColor } from '../schema';

/**
 * Member color → design-system classes. Written out in full because Tailwind
 * scans source text: `bg-cat-${color}-solid` would never be generated.
 */
export const MEMBER_COLOR_CLASSES: Record<MemberColor, { dot: string; surface: string }> = {
  blue: { dot: 'bg-cat-blue-solid', surface: 'bg-cat-blue-surface text-cat-blue-fg' },
  purple: { dot: 'bg-cat-purple-solid', surface: 'bg-cat-purple-surface text-cat-purple-fg' },
  orange: { dot: 'bg-cat-orange-solid', surface: 'bg-cat-orange-surface text-cat-orange-fg' },
  green: { dot: 'bg-cat-green-solid', surface: 'bg-cat-green-surface text-cat-green-fg' },
  red: { dot: 'bg-cat-red-solid', surface: 'bg-cat-red-surface text-cat-red-fg' },
  yellow: { dot: 'bg-cat-yellow-solid', surface: 'bg-cat-yellow-surface text-cat-yellow-fg' },
  pink: { dot: 'bg-cat-pink-solid', surface: 'bg-cat-pink-surface text-cat-pink-fg' },
  teal: { dot: 'bg-cat-teal-solid', surface: 'bg-cat-teal-surface text-cat-teal-fg' },
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
