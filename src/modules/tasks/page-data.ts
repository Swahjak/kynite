import 'server-only';
import { startOfDay } from '@/modules/calendar';
import { can, getFamily, getPrincipal, listMembers, type Member } from '@/modules/family';
import { listTodayTasks } from './queries';

/**
 * The read behind the Takenlijst on `/today`.
 *
 * It resolves its own principal rather than trusting one passed in (route files
 * hold no logic — architecture §2 rule 4): one more cheap read on a page that
 * already did it, and it means the list cannot be mounted anywhere without an
 * authorisation check.
 *
 * The rows arrive already shaped for a row of the list — the assignee's name,
 * face and colour resolved here rather than by handing the whole member roster
 * to a client component that only needs four fields of it.
 */

export type TodayTask = {
  id: string;
  title: string;
  done: boolean;
  /** `YYYY-MM-DD`, or null for an undated task — a first-class state. */
  dueDate: string | null;
  /** Open, dated, and its day has passed. The only case the list dates a row. */
  overdue: boolean;
  assignee: {
    memberId: string;
    displayName: string;
    avatarUrl: string | null;
    color: Member['color'];
  } | null;
};

export type TodayTasksData = {
  tasks: TodayTask[];
  /** The roster the quick-add's assignee picker offers. */
  members: Member[];
  timeZone: string;
  /** `YYYY-MM-DD` in the family's zone — what the quick-add dates "today" as. */
  todayKey: string;
  /** False for a principal who may read the list but not author/delete rows. */
  canWrite: boolean;
  /** False for a principal who may read the list but not tick a row off. */
  canComplete: boolean;
};

/** `'2026-08-14'` in `timeZone` — never `toISOString().slice(0, 10)`, which is UTC. */
function todayKeyIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/** Null when there is no principal — the caller has already redirected. */
export async function loadTodayTasks(options: { now?: Date } = {}): Promise<TodayTasksData | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  const family = await getFamily(principal.familyId);
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';
  const now = options.now ?? new Date();
  const todayKey = todayKeyIn(timeZone, now);

  const [members, rows] = await Promise.all([
    listMembers(principal.familyId),
    listTodayTasks({
      familyId: principal.familyId,
      todayKey,
      // "Completed today" is the family's day, not the server's — the same rule
      // the calendar's `?date=` resolution follows.
      since: startOfDay(now, timeZone),
    }),
  ]);

  const byId = new Map(members.map((member) => [member.id, member]));

  return {
    timeZone,
    todayKey,
    members,
    canWrite: can(principal, 'task:write', { familyId: principal.familyId }),
    canComplete: can(principal, 'task:complete', { familyId: principal.familyId }),
    tasks: rows.map((row): TodayTask => {
      const member = row.assigneeMemberId ? byId.get(row.assigneeMemberId) : undefined;

      return {
        id: row.id,
        title: row.title,
        done: row.completedAt !== null,
        dueDate: row.dueDate,
        overdue: row.completedAt === null && row.dueDate !== null && row.dueDate < todayKey,
        assignee: member
          ? {
              memberId: member.id,
              displayName: member.displayName,
              avatarUrl: member.avatarUrl,
              color: member.color,
            }
          : null,
      };
    }),
  };
}
