import 'server-only';
import type { HubChild } from '@/components/hub';
import {
  dayKeysOf,
  isSameDay,
  loadCalendarPage,
  toDateKey,
  toWall,
  type CalendarEvent,
  type CalendarPageData,
} from '@/modules/calendar';
import {
  MEMBER_COLOR_CLASSES,
  greetingSlotFor,
  hourIn,
  initialsOf,
  type GreetingSlot,
} from '@/modules/family';
import { loadFamilyRoutineTotals } from '@/modules/routines';
import { loadTodayTasks, type TodayTasksData } from '@/modules/tasks';
import { getFamilyWeather, type WeatherView } from '@/modules/weather';
import { flowOf, type DayReference, type Flow } from './domain/flow';
import { resolveTodayTheme, type TodayTheme } from './domain/theme';
import { loadTodayProgress, type TodayProgressData } from './page-data';

/**
 * Which of the composition's four *queried* fields a caller actually needs.
 *
 * `data`/`dayKey`/`dayEvents`/`isToday`/`reference`/`flow`/`theme`/`slot` are
 * either the calendar read every caller already pays for or pure functions
 * over it — free. `children`, `progress`, `tasks` and `weather` each cost a
 * further DB read (`loadFamilyRoutineTotals`, `loadTodayProgress`,
 * `loadTodayTasks`, `getFamilyWeather`), so they are opt-in per field rather
 * than an all-or-nothing "full" mode: `/hub/kalender` needs none of the four.
 * `/hub/routines` (M-R2's "Taken & routines" board) needs none of them
 * either — it calls this loader with no `include` for its calendar snapshot
 * and header, and gets its member/routine/task data from the separate
 * `loadRoutinesBoardData` (`page-data-board.ts`), which resolves its own
 * principal and members rather than going through this composition's opt-in
 * fields.
 */
export type HubBoardCompositionInclude = {
  children?: boolean;
  progress?: boolean;
  tasks?: boolean;
  weather?: boolean;
};

/**
 * The read behind every hub board — `/hub`, `/hub/kalender` and
 * `/hub/routines` alike (M-R1).
 *
 * Extracted from `HubPage` unchanged: every route draws the same family-wide
 * snapshot (`loadCalendarPage({ surface: 'hub' })`) and the same day-shaped
 * facts derived from it, and only differs in which panel — and which of the
 * four opt-in reads above — it needs. A second copy of this read for the
 * calendar route would drift the routes' idea of "today" the first time one
 * of them changed underneath it.
 *
 * `locale`/translation strings stay with the page — this is data only, so it
 * can be called from a route file without pulling `next-intl/server` into a
 * module that has no reason to know about it.
 */
export type HubBoardComposition = {
  data: CalendarPageData;
  dayKey: string;
  dayEvents: CalendarPageData['events'];
  isToday: boolean;
  reference: DayReference;
  flow: Flow<CalendarEvent>;
  theme: TodayTheme | null;
  /** `null` when not requested via `include.progress`, or when not today. */
  progress: TodayProgressData | null;
  /** `null` when not requested via `include.tasks`, or when not today. */
  tasks: TodayTasksData | null;
  /** `null` when not requested via `include.weather`, or when not today. */
  weather: WeatherView | null;
  /** `[]` when not requested via `include.children`. */
  children: HubChild[];
  slot: GreetingSlot;
};

export async function loadHubBoardComposition(options: {
  date?: string;
  now?: string;
  /**
   * `?view=` (`/hub/kalender` only) — `loadCalendarPage` still wins with the
   * family's `hubDefaultView` when this is absent, exactly as
   * `page-data.ts`'s own comment describes.
   */
  view?: string;
  include?: HubBoardCompositionInclude;
}): Promise<HubBoardComposition | null> {
  const include = options.include ?? {};

  const data = await loadCalendarPage({ date: options.date, view: options.view, surface: 'hub' });
  if (!data) return null;

  // M19: one entry per child, carrying today's step count — see the note this
  // was lifted from in `hub/page.tsx`'s git history. One family-wide read,
  // not one board per child. Skipped entirely off `include.children` — a
  // route that draws no `ChildLauncher` has no use for it, and it is its own
  // DB read.
  const children: HubChild[] = include.children
    ? await (async () => {
        const totals = await loadFamilyRoutineTotals({ date: options.date });

        return data.members
          .filter((member) => member.role === 'child')
          .map((member) => {
            const progress = totals?.get(member.id) ?? { done: 0, total: 0 };

            return {
              id: member.id,
              displayName: member.displayName,
              avatarUrl: member.avatarUrl,
              initials: initialsOf(member.displayName),
              // `.track` (baan) — this feeds an `AvatarFallback` disc, not an
              // icon tile; see `member-avatar.tsx`'s comment.
              colorClass: MEMBER_COLOR_CLASSES[member.color].track,
              doneCount: progress.done,
              total: progress.total,
            };
          });
      })()
    : [];

  const slot = greetingSlotFor(hourIn(data.now, data.timeZone));

  const dayKey = toDateKey(toWall(data.anchor, data.timeZone));
  const dayEvents = data.events.filter((event) =>
    dayKeysOf(event, data.timeZone, event.allDay).includes(dayKey)
  );

  const isToday = isSameDay(data.anchor, data.now, data.timeZone);
  const reference: DayReference = isToday
    ? { kind: 'today', now: data.now }
    : { kind: data.anchor.getTime() < data.now.getTime() ? 'past' : 'future', now: data.anchor };
  const flow = flowOf(dayEvents, reference);

  const [progress, tasks, weather] = await Promise.all([
    isToday && include.progress ? loadTodayProgress({ now: data.now }) : null,
    isToday && include.tasks ? loadTodayTasks({ now: data.now }) : null,
    isToday && include.weather ? getFamilyWeather(data.familyId, { now: data.now }) : null,
  ]);

  const theme = resolveTodayTheme({ dayKey, isToday, people: data.members });

  return {
    data,
    dayKey,
    dayEvents,
    isToday,
    reference,
    flow,
    theme,
    progress,
    tasks,
    weather,
    children,
    slot,
  };
}
