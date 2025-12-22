import type { IChoreWithAssignee, UrgencyStatus } from "@/types/chore";

/**
 * Calculate urgency status for a chore
 */
export function getUrgencyStatus(chore: IChoreWithAssignee): UrgencyStatus {
  if (chore.status !== "pending") return "none";
  if (chore.isUrgent) return "urgent";
  if (!chore.dueDate) return "none";

  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Combine date and time for comparison
  let dueDateTime: Date;
  if (chore.dueTime) {
    dueDateTime = new Date(`${chore.dueDate}T${chore.dueTime}:00`);
  } else {
    dueDateTime = new Date(`${chore.dueDate}T23:59:59`);
  }

  if (dueDateTime < now) return "overdue";

  // Due within 4 hours
  const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  if (dueDateTime < fourHoursLater) return "due-soon";

  return "none";
}

/**
 * Sort chores by priority
 * 1. Overdue (oldest first)
 * 2. Urgent (soonest first)
 * 3. Today (by time)
 * 4. Future (by date)
 * 5. Flexible (alphabetically)
 */
export function sortChores(chores: IChoreWithAssignee[]): IChoreWithAssignee[] {
  return [...chores].sort((a, b) => {
    const urgencyA = getUrgencyStatus(a);
    const urgencyB = getUrgencyStatus(b);

    // Priority order
    const urgencyOrder: Record<UrgencyStatus, number> = {
      overdue: 0,
      urgent: 1,
      "due-soon": 2,
      none: 3,
    };

    const orderDiff = urgencyOrder[urgencyA] - urgencyOrder[urgencyB];
    if (orderDiff !== 0) return orderDiff;

    // Same urgency: sort by date/time
    if (a.dueDate && b.dueDate) {
      const dateDiff = a.dueDate.localeCompare(b.dueDate);
      if (dateDiff !== 0) return dateDiff;

      if (a.dueTime && b.dueTime) {
        return a.dueTime.localeCompare(b.dueTime);
      }
    }

    // No date or same date: alphabetically
    return a.title.localeCompare(b.title);
  });
}

/**
 * Group chores by assignee
 */
export function groupChoresByAssignee(
  chores: IChoreWithAssignee[]
): Map<string, IChoreWithAssignee[]> {
  const groups = new Map<string, IChoreWithAssignee[]>();

  for (const chore of chores) {
    const key = chore.assignedToId ?? "unassigned";
    const existing = groups.get(key) ?? [];
    groups.set(key, [...existing, chore]);
  }

  return groups;
}

/**
 * Filter urgent chores
 */
export function getUrgentChores(chores: IChoreWithAssignee[]): IChoreWithAssignee[] {
  return chores.filter((c) => {
    const status = getUrgencyStatus(c);
    return status === "urgent" || status === "overdue" || status === "due-soon";
  });
}

/**
 * Format due date/time for display
 */
export function formatDueLabel(chore: IChoreWithAssignee): string | null {
  if (chore.recurrence !== "once") {
    const labels: Record<string, string> = {
      daily: "DAILY",
      weekly: "WEEKLY",
      weekdays: "WEEKDAYS",
      weekends: "WEEKEND",
      monthly: "MONTHLY",
    };
    return labels[chore.recurrence] ?? null;
  }

  if (!chore.dueDate) return null;

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const urgency = getUrgencyStatus(chore);
  if (urgency === "overdue") return "OVERDUE";

  if (chore.dueDate === today) {
    if (chore.dueTime) {
      const [hours, minutes] = chore.dueTime.split(":");
      const hour = parseInt(hours, 10);
      const period = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      return `TODAY • ${displayHour}:${minutes} ${period}`;
    }
    return "TODAY";
  }

  if (chore.dueDate === tomorrow) return "TOMORROW";

  // Format as date
  const date = new Date(chore.dueDate);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Get urgency badge variant
 */
export function getUrgencyVariant(
  urgency: UrgencyStatus
): "destructive" | "outline" | "secondary" | "default" {
  switch (urgency) {
    case "overdue":
      return "destructive";
    case "urgent":
      return "destructive";
    case "due-soon":
      return "outline";
    default:
      return "secondary";
  }
}
