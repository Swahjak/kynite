import { getTranslations } from 'next-intl/server';
import { Card, Icon, SectionHeading, StarCount, WeekBars, type WeekBar } from '@kynite/ui';
import { formatDateTime } from '@/i18n/formatting-locale';
import { getHouseholdFormattingLocale } from '@/modules/family';
import type { StarChartData } from '../page-data';

/**
 * "Deze week" — seven bars and what they came from (`Beloningen.dc.html`).
 *
 * The card answers one question a nine-year-old asks and a five-year-old does
 * not: *how did this week go*. It never answers "compared to whom" — there is
 * one child on this card and no arrangement of this component that puts a
 * second one beside them (research §Decisions 3).
 *
 * The list underneath is the last few things that paid, newest first, as
 * sentences rather than a ledger: what happened, and what it was worth. A
 * graduated routine appears here without a number, which is the honest
 * rendering of a routine that has stopped paying and is still being done.
 */
export async function StarWeekCard({
  chart,
  entries = 3,
}: {
  chart: StarChartData;
  /** How many ledger lines to show under the bars. */
  entries?: number;
}) {
  const t = await getTranslations('rewards');
  const formattingLocale = await getHouseholdFormattingLocale();

  const bars: WeekBar[] = chart.week.map((bar, index) => ({
    key: bar.day,
    // Noon UTC: the key already *is* the family's calendar day, and reading it
    // back at midnight would let any zone west of UTC render the day before.
    label: formatDateTime(new Date(`${bar.day}T12:00:00Z`), formattingLocale, {
      weekday: 'short',
    }),
    value: bar.total,
    today: index === chart.week.length - 1,
    srLabel: t('chart.dayStars', {
      day: formatDateTime(new Date(`${bar.day}T12:00:00Z`), formattingLocale, { weekday: 'long' }),
      count: bar.total,
    }),
  }));

  return (
    <Card data-testid="week-chart" className="gap-4 rounded-[26px] p-5.5">
      <SectionHeading
        title={t('chart.thisWeek')}
        size="card"
        level={2}
        action={
          <StarCount
            data-testid="week-total"
            value={chart.weekTotal}
            srLabel={t('chart.weekTotal', { count: chart.weekTotal })}
            size="md"
          />
        }
      />

      <WeekBars days={bars} />

      <ul className="flex flex-col border-t border-line-subtle">
        {chart.history.slice(0, entries).map((entry) => (
          <li
            key={entry.id}
            data-testid="history-entry"
            className="flex items-center gap-2.5 border-b border-line-subtle py-2.5 last:border-b-0"
          >
            <Icon name="star" filled size="sm" className="shrink-0 text-gold" />
            <span className="min-w-0 flex-1 truncate text-body-sm">
              {entry.note ?? t(`reasons.${entry.reason}`)}
            </span>
            <span className="tnum shrink-0 font-display text-body-sm font-bold text-ink-secondary">
              {t('plusStars', { count: entry.amount })}
            </span>
          </li>
        ))}

        {chart.graduated.slice(0, 1).map((routine) => (
          <li
            key={routine.id}
            data-testid="graduation-badge"
            data-routine-id={routine.id}
            className="flex items-center gap-2.5 border-b border-line-subtle py-2.5 last:border-b-0"
          >
            <Icon name="workspace_premium" filled size="sm" className="shrink-0 text-brand" />
            <span className="min-w-0 flex-1 truncate text-body-sm text-ink-secondary">
              {t('chart.graduatedLine', { title: routine.title })}
            </span>
          </li>
        ))}
      </ul>

      {chart.history.length === 0 && chart.graduated.length === 0 ? (
        <p data-testid="history-empty" className="text-body-sm text-ink-secondary">
          {t('chart.historyEmpty')}
        </p>
      ) : null}
    </Card>
  );
}
