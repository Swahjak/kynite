'use client';

import { Icon } from '@/components/ui/icon';
import type { Goal } from '../domain/economy';
import { rewardIconOf } from './tokens';

/**
 * The featured savings goal — the `savings` horizon's whole reason to exist
 * (ages ~8–12, research §"Age differentiation").
 *
 * One card, one goal, one bar. What it deliberately does not have:
 *
 * - **No deadline and no countdown.** A savings goal that can be *missed* is a
 *   streak with extra steps, and streaks carry the loss-aversion problems
 *   research §"Streaks and loss-framing" documents. The bar only ever fills.
 * - **No comparison.** There is no sibling's bar next to it, ever.
 * - **No currency.** The number is stars, the icon is a star, and nothing on
 *   this card converts to money.
 *
 * The gold fill is the design system's `--gold`, the same token the star pop
 * uses, so "progress towards a reward" and "a star you earned" read as the same
 * material rather than two unrelated highlights.
 */
export function SavingsGoalCard({
  goal,
  icon,
  copy,
}: {
  goal: Goal;
  /** The goal reward's own icon name, as stored. */
  icon: string | null;
  copy: { eyebrow: string; remaining: string; progress: string };
}) {
  const percent = Math.round(goal.ratio * 100);

  return (
    <section
      data-testid="savings-goal"
      data-reward-id={goal.rewardId}
      data-percent={percent}
      className="relative isolate flex flex-col items-center gap-8 overflow-hidden rounded-3xl bg-primary p-8 text-primary-foreground shadow-md md:flex-row md:p-12"
    >
      <span
        aria-hidden
        className="absolute -top-20 -right-20 size-96 rounded-full bg-foreground/5 blur-3xl"
      />

      <span
        aria-hidden
        className="z-10 flex size-32 shrink-0 items-center justify-center rounded-full bg-card/30 backdrop-blur-md md:size-40"
      >
        <Icon name={rewardIconOf(icon)} size="2xl" filled className="scale-[2] text-gold" />
      </span>

      <div className="z-10 flex w-full flex-1 flex-col gap-4">
        <span className="label-overline text-primary-foreground/80">{copy.eyebrow}</span>
        <h2 className="font-display text-display-md font-extrabold">{goal.title}</h2>

        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-4 font-display text-h3 font-bold">
            {/* Counts up to the reward, never down from a deficit. */}
            <span data-testid="goal-remaining">{copy.remaining}</span>
            <span data-testid="goal-progress" className="tabular-time">
              {copy.progress}
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={goal.progressStars}
            aria-valuemin={0}
            aria-valuemax={goal.costStars}
            aria-label={goal.title}
            className="h-4 w-full overflow-hidden rounded-full bg-card/25"
          >
            <span
              data-testid="goal-bar"
              className="block h-full rounded-full bg-gold transition-[width] duration-1000 ease-brand"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
