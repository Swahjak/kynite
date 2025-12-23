// Consistent colors for users across wall-hub components
// Color is derived from user ID hash - same user = same color everywhere

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
 * Simple hash of string to number for consistent color assignment
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Get color for a user based on their ID (consistent across renders)
 */
export function getUserColorById(userId: string) {
  const index = hashString(userId) % USER_COLORS.length;
  return USER_COLORS[index];
}

/**
 * Get color for an event based on its first participant
 */
export function getEventColorByParticipants(participantIds: string[]) {
  if (participantIds.length === 0) {
    return USER_COLORS[0]; // Default to blue for events with no participants
  }
  return getUserColorById(participantIds[0]);
}
