import type { AvatarColor } from "@/types/family";

/**
 * Central color utility for avatar styling.
 * Uses CSS variables defined in globals.css for consistent theming.
 */
export const AVATAR_COLOR_CLASSES: Record<
  AvatarColor,
  {
    ring: string;
    bg: string;
    bgSubtle: string;
    text: string;
  }
> = {
  blue: {
    ring: "ring-[var(--event-blue-border)]",
    bg: "bg-[var(--event-blue-border)]",
    bgSubtle: "bg-[var(--event-blue-bg)]",
    text: "text-white",
  },
  purple: {
    ring: "ring-[var(--event-purple-border)]",
    bg: "bg-[var(--event-purple-border)]",
    bgSubtle: "bg-[var(--event-purple-bg)]",
    text: "text-white",
  },
  orange: {
    ring: "ring-[var(--event-orange-border)]",
    bg: "bg-[var(--event-orange-border)]",
    bgSubtle: "bg-[var(--event-orange-bg)]",
    text: "text-white",
  },
  green: {
    ring: "ring-[var(--event-green-border)]",
    bg: "bg-[var(--event-green-border)]",
    bgSubtle: "bg-[var(--event-green-bg)]",
    text: "text-white",
  },
  red: {
    ring: "ring-[var(--event-red-border)]",
    bg: "bg-[var(--event-red-border)]",
    bgSubtle: "bg-[var(--event-red-bg)]",
    text: "text-white",
  },
  yellow: {
    ring: "ring-[var(--event-yellow-border)]",
    bg: "bg-[var(--event-yellow-border)]",
    bgSubtle: "bg-[var(--event-yellow-bg)]",
    text: "text-black",
  },
  pink: {
    ring: "ring-[var(--event-pink-border)]",
    bg: "bg-[var(--event-pink-border)]",
    bgSubtle: "bg-[var(--event-pink-bg)]",
    text: "text-white",
  },
  teal: {
    ring: "ring-[var(--event-teal-border)]",
    bg: "bg-[var(--event-teal-border)]",
    bgSubtle: "bg-[var(--event-teal-bg)]",
    text: "text-white",
  },
};

/**
 * Get color classes for an avatar with fallback to blue.
 */
export function getAvatarColorClasses(
  color: AvatarColor | string | null | undefined
) {
  if (!color || !(color in AVATAR_COLOR_CLASSES)) {
    return AVATAR_COLOR_CLASSES.blue;
  }
  return AVATAR_COLOR_CLASSES[color as AvatarColor];
}

/**
 * Get ring class for an avatar.
 */
export function getAvatarRingClass(
  color: AvatarColor | string | null | undefined
): string {
  return getAvatarColorClasses(color).ring;
}

/**
 * Get background class for avatar fallback (bg + text color).
 */
export function getAvatarBgClass(
  color: AvatarColor | string | null | undefined
): string {
  const classes = getAvatarColorClasses(color);
  return `${classes.bg} ${classes.text}`;
}
