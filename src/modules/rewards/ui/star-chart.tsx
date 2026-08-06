import { getFormatter, getTranslations } from 'next-intl/server';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { StarChartData } from '../page-data';

/**
 * One child's star chart (M08's `(hub)/hub/stars/[memberId]`).
 *
 * The screen exists to make two numbers legible and to keep them apart:
 *
 * - **Earned** is the headline, at display scale. It is the sum of an
 *   append-only ledger, so it only ever goes up, and for the youngest children
 *   it is *the* metric (research §Decisions 2: a number that only grows cannot
 *   be lost). Spending a star does not move it.
 * - **Available** is secondary, at body scale. It is what the store spends
 *   against, and it goes down when a reward is granted — which is a thing the
 *   child chose, not a thing that happened to them.
 *
 * The two are labelled, adjacent and different sizes on purpose: "you have 40
 * stars" and "you can spend 12" are both true, and a chart that showed only one
 * of them would either hide the child's whole history or promise more than the
 * shelf will accept.
 *
 * Age-tiered, like the store. `instant` gets the total and the recent history,
 * icon-first and short. `savings` additionally gets the week — seven bars and a
 * weekly sum — because "how am I doing this week" is a question a nine-year-old
 * asks and a five-year-old does not.
 *
 * This screen shows exactly one child. There is no variant, prop or query
 * parameter that adds a second (research §Decisions 3).
 */
export async function StarChart({ chart }: { chart: StarChartData }) {
  const t = await getTranslations('rewards');
  const format = await getFormatter();

  const savings = chart.horizon === 'savings';
  const peak = Math.max(1, ...chart.week.map((bar) => bar.total));

  return (
    <div
      data-testid="star-chart"
      data-member-id={chart.member.id}
      data-horizon={chart.horizon}
      className="flex flex-col gap-8"
    >
      <section className="flex flex-wrap items-center gap-8 rounded-3xl bg-card p-8 shadow-sm ring-1 ring-foreground/10">
        <span
          aria-hidden
          className="flex size-24 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-ink"
        >
          <Icon name="star" size="2xl" filled className="scale-150" />
        </span>

        <div className="flex flex-col">
          <span
            data-testid="earned-stars"
            className="font-display text-display-lg leading-none font-extrabold text-gold-ink tabular-time"
          >
            {chart.totals.earned}
          </span>
          <span className="label-overline text-ink-secondary">{t('chart.earnedStars')}</span>
        </div>

        <div className="flex flex-col md:ml-auto">
          <span
            data-testid="chart-available-stars"
            className="font-display text-h1 leading-none font-bold text-foreground tabular-time"
          >
            {chart.totals.available}
          </span>
          <span className="label-overline text-ink-secondary">{t('chart.availableStars')}</span>
        </div>
      </section>

      {savings ? (
        <section data-testid="week-chart" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-4">
            <h2 className="font-display text-h2 font-bold text-foreground">
              {t('chart.thisWeek')}
            </h2>
            <span data-testid="week-total" className="text-body-lg text-ink-secondary">
              {t('chart.weekTotal', { count: chart.weekTotal })}
            </span>
          </div>

          <ol className="flex items-end gap-3">
            {chart.week.map((bar) => (
              <li
                key={bar.day}
                data-testid="week-bar"
                data-day={bar.day}
                data-total={bar.total}
                className="flex min-w-0 flex-1 flex-col items-center gap-2"
              >
                <span className="text-caption text-ink-secondary tabular-time">{bar.total}</span>
                <span
                  aria-hidden
                  className="flex h-32 w-full items-end overflow-hidden rounded-lg bg-muted"
                >
                  {/* A zero day is an empty bar and nothing else — no label, no
                      colour, no annotation. Absence is the whole treatment. */}
                  <span
                    className={cn(
                      'block w-full rounded-lg bg-gold transition-[height] duration-500 ease-brand'
                    )}
                    style={{ height: `${Math.round((bar.total / peak) * 100)}%` }}
                  />
                </span>
                <span className="text-caption text-ink-secondary">
                  {format.dateTime(new Date(`${bar.day}T12:00:00Z`), { weekday: 'short' })}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h2 font-bold text-foreground">{t('chart.history')}</h2>

        {chart.history.length === 0 ? (
          <p data-testid="history-empty" className="text-body-lg text-ink-secondary">
            {t('chart.historyEmpty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {chart.history.map((entry) => (
              <li
                key={entry.id}
                data-testid="history-entry"
                className="flex items-center gap-4 rounded-xl bg-card px-4 py-3 shadow-sm ring-1 ring-foreground/5"
              >
                <Icon name="star" size="md" filled className="text-gold-ink" />
                <span className="min-w-0 flex-1 truncate text-body-lg">
                  {entry.note ?? t(`reasons.${entry.reason}`)}
                </span>
                <span className="shrink-0 text-body-lg font-bold text-gold-ink tabular-time">
                  {t('plusStars', { count: entry.amount })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {chart.graduated.length > 0 ? (
        <section data-testid="graduated-routines" className="flex flex-col gap-4">
          <h2 className="font-display text-h2 font-bold text-foreground">
            {t('chart.graduatedTitle')}
          </h2>
          {/* The fade path's reward (research §Decisions 7, FR17): a routine
              that stopped paying stars is presented as something the child
              outgrew, at the same visual weight as the things that still pay.
              Nothing here reads as a downgrade, because it is not one. */}
          <p className="text-body-lg text-ink-secondary">{t('chart.graduatedBody')}</p>
          <ul className="flex flex-wrap gap-3">
            {chart.graduated.map((routine) => (
              <li
                key={routine.id}
                data-testid="graduation-badge"
                data-routine-id={routine.id}
                className="flex h-12 items-center gap-2 rounded-4xl bg-brand-ink px-5 font-display text-body-lg font-bold text-primary-foreground"
              >
                <Icon name="workspace_premium" size="md" filled />
                {routine.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
