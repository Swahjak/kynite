/**
 * @deprecated This module is deprecated. Use @/lib/avatar-colors instead.
 *
 * The hash-based color system has been replaced with stored avatarColor values
 * from family members. Colors are now user-selected, not auto-generated.
 *
 * Migration guide:
 * - Replace getUserColorById() with getAvatarColorClasses(user.avatarColor)
 * - Replace getEventColorByParticipants() with getAvatarColorClasses(firstUser.avatarColor)
 */

import { getAvatarColorClasses as newGetAvatarColorClasses } from "@/lib/avatar-colors";
import type { AvatarColor } from "@/types/family";

// Keep legacy exports for backwards compatibility during migration
export const USER_COLORS = [
  {
    key: "blue",
    border: "border-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    activeBg: "bg-blue-500",
    ring: "ring-blue-500",
  },
  {
    key: "purple",
    border: "border-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    activeBg: "bg-purple-500",
    ring: "ring-purple-500",
  },
  {
    key: "orange",
    border: "border-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    activeBg: "bg-orange-500",
    ring: "ring-orange-500",
  },
  {
    key: "green",
    border: "border-green-500",
    bg: "bg-green-50 dark:bg-green-950/30",
    activeBg: "bg-green-500",
    ring: "ring-green-500",
  },
  {
    key: "red",
    border: "border-red-500",
    bg: "bg-red-50 dark:bg-red-950/30",
    activeBg: "bg-red-500",
    ring: "ring-red-500",
  },
  {
    key: "yellow",
    border: "border-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    activeBg: "bg-yellow-500",
    ring: "ring-yellow-500",
  },
] as const;

/**
 * @deprecated Use getAvatarColorClasses from @/lib/avatar-colors instead.
 * Pass user.avatarColor directly instead of user.id.
 */
export function getUserColorById(userId: string) {
  console.warn(
    "getUserColorById is deprecated. Use getAvatarColorClasses(user.avatarColor) from @/lib/avatar-colors instead."
  );
  // Fallback: return blue color classes in legacy format
  const colors = newGetAvatarColorClasses("blue" as AvatarColor);
  return {
    key: "blue",
    border: colors.ring.replace("ring-", "border-"),
    bg: colors.bgSubtle,
    activeBg: colors.bg,
    ring: colors.ring,
  };
}

/**
 * @deprecated Use getAvatarColorClasses(firstParticipant.avatarColor) from @/lib/avatar-colors instead.
 */
export function getEventColorByParticipants(participantIds: string[]) {
  console.warn(
    "getEventColorByParticipants is deprecated. Use getAvatarColorClasses(user.avatarColor) from @/lib/avatar-colors instead."
  );
  return getUserColorById(participantIds[0] ?? "");
}
