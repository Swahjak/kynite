'use client';

import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/kynite';
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
 *
 * M19: the filled-primary treatment this card hand-rolled is now the shared
 * `<Card variant="hero">` (`components/ui/card.tsx`) — this component was the
 * reference for it, so adopting the variant is a de-duplication rather than a
 * restyle. Radius steps 32px → 24px with it, which is what the design system
 * calls a hero card; the ambient glow and the gold bar are unchanged.
 *
 * The `<section>` around it is not decoration. This card is the goal region of
 * the store — the one thing on the page with an `h2` — and adopting `<Card>`
 * (a `div`) dropped the landmark the heading used to sit in, so a screen reader
 * navigating by region lost the goal entirely. `Card` takes no `asChild`, so
 * the landmark is restored by wrapping rather than by widening a shared
 * primitive for one caller. It is named by its own heading via
 * `aria-labelledby`, because an unnamed `<section>` is not a landmark at all.
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
  const headingId = `savings-goal-${goal.rewardId}-title`;

  return (
    <section aria-labelledby={headingId}>
      <Card
        variant="hero"
        data-testid="savings-goal"
        data-reward-id={goal.rewardId}
        data-percent={percent}
        className="group/goal isolate flex-row flex-wrap items-center gap-8 p-8 max-md:flex-col md:p-12"
      >
        <span
          aria-hidden
          className="absolute -top-20 -right-20 size-96 rounded-full bg-foreground/5 blur-3xl transition-transform duration-700 ease-brand group-hover/goal:scale-110"
        />

        <span
          aria-hidden
          className="z-10 flex size-32 shrink-0 items-center justify-center rounded-full bg-card/30 backdrop-blur-md md:size-40"
        >
          <Icon name={rewardIconOf(icon)} size="2xl" filled className="scale-[2] text-gold" />
        </span>

        <div className="z-10 flex w-full flex-1 flex-col gap-4">
          <span className="label-overline text-primary-foreground">{copy.eyebrow}</span>
          <h2 id={headingId} className="font-display text-display-md font-extrabold">
            {goal.title}
          </h2>

          <div className="flex flex-col gap-2">
            <div className="flex items-end justify-between gap-4 font-display text-h3 font-bold">
              {/* Counts up to the reward, never down from a deficit. */}
              <span data-testid="goal-remaining">{copy.remaining}</span>
              <span data-testid="goal-progress" className="tabular-time">
                {copy.progress}
              </span>
            </div>

            <ProgressBar
              data-testid="goal-bar"
              value={goal.progressStars}
              max={goal.costStars}
              label={goal.title}
              tone="gold"
              size="lg"
              className="bg-card/25"
            />
          </div>
        </div>
      </Card>
    </section>
  );
}
