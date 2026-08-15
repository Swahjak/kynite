'use client';

import { useTranslations } from 'next-intl';
import { Icon, type IconName, Tabs, TabsList, TabsTrigger } from '@kynite/ui';
// Type-only — see the note in `person-columns.tsx`.
import type { Member } from '@/modules/family';
import type { CalendarEvent } from '../queries';
import { CombinedDayList } from './combined-day-list';
import { PersonColumns } from './person-columns';
import { DAY_VIEW_MODES, useDayViewMode, type DayViewMode } from './use-day-view-mode';

/**
 * `/today`'s day board, with its two arrangements and the control that picks
 * between them.
 *
 * The two answer different questions and neither subsumes the other. The
 * columns answer "what does *Daan* have today" — the reason the board was
 * built, and the thing a merged list genuinely cannot show at a glance. The
 * merged list answers "what is happening today, and in what order", which is
 * what the screen is actually opened for most mornings and what the columns
 * only answer by making the reader scan four lanes in parallel.
 *
 * So this is a *view* switch, not navigation: the page already fetched the
 * day's events, so flipping between them is a re-render — no request, no
 * spinner, no URL change. That is the same bargain the calendar's own view
 * pill strikes (`calendar-shell.tsx`), and this control is deliberately the
 * same segmented pill, so a parent who has learned one has learned both.
 *
 * The choice is remembered per device (`use-day-view-mode.ts`).
 */

/** One glyph per mode, so the pill fits beside the heading at 390px. */
const MODE_ICONS: Record<DayViewMode, IconName> = {
  combined: 'schedule',
  columns: 'person',
};

export type DayBoardProps = {
  /** The section heading, from the page that owns the copy. */
  title: string;
  members: Member[];
  events: CalendarEvent[];
  timeZone: string;
  day: Date;
  now?: Date | null;
  onSelect?: (event: CalendarEvent) => void;
};

export function DayBoard({ title, members, events, timeZone, day, now, onSelect }: DayBoardProps) {
  const t = useTranslations('calendar');
  const { mode, setMode } = useDayViewMode();

  return (
    <section data-slot="day-board" data-mode={mode} className="flex min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="pl-1 text-overline text-ink-muted uppercase">{title}</h3>

        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as DayViewMode)}
          className="min-w-0 max-w-full"
        >
          <TabsList
            data-testid="day-view-switcher"
            aria-label={t('dayView.label')}
            // Same pill as the calendar's view switcher, one step smaller: this
            // one sits on a section heading rather than in the glass header.
            // The height override repeats the primitive's own
            // `group-data-horizontal` variant, or the default's higher
            // specificity keeps the 32px track under 36px triggers.
            className="max-w-full overflow-x-auto rounded-4xl bg-surface-container p-1 group-data-horizontal/tabs:h-10"
          >
            {DAY_VIEW_MODES.map((candidate) => (
              <TabsTrigger
                key={candidate}
                value={candidate}
                data-testid={`day-view-${candidate}`}
                // `data-active:text-primary` on a *light* track, not white on
                // primary: the fill-and-invert treatment is what M22 had to
                // fix for contrast, and the pill the calendar header already
                // ships is the version that clears AA.
                className="label-overline h-8 shrink-0 gap-1.5 rounded-4xl px-3 data-active:bg-surface-container-lowest data-active:text-primary data-active:shadow-sm"
              >
                <Icon name={MODE_ICONS[candidate]} size="sm" />
                {t(`dayView.${candidate}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      {mode === 'combined' ? (
        <CombinedDayList
          members={members}
          events={events}
          timeZone={timeZone}
          day={day}
          now={now}
          onSelect={onSelect}
        />
      ) : (
        <PersonColumns
          members={members}
          events={events}
          timeZone={timeZone}
          day={day}
          now={now}
          onSelect={onSelect}
        />
      )}
    </section>
  );
}
