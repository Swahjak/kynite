'use client';

import { Card } from './card';
import { Icon } from './icon';
import type { IconName } from './icon-codepoints';
import { ProgressBar } from './progress-bar';

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
 * The bar runs `--gold` → `--gold-bright` left to right, so the warm end
 * arrives at the finish: it reads as getting *closer* rather than merely
 * longer, which is the one bar in this product a child watches for weeks.
 *
 * The card is white on the cream page (`Beloningen.dc.html`) rather than a
 * filled hero. On the store's left column it sits above the week card, and two
 * saturated blocks stacked would make the shelf — the thing the screen is
 * actually for — the third most colourful thing on it.
 *
 * The `<section>` around it is not decoration. This card is the goal region of
 * the store — the one thing on the page with an `h2` — and `Card` is a `div`,
 * so the landmark is restored by wrapping. It is named by its own heading via
 * `aria-labelledby`, because an unnamed `<section>` is not a landmark at all.
 */

/**
 * The read subset of the app's `Goal` (`modules/rewards/domain/economy.ts`),
 * restated so the package does not import the rewards slice — a `Goal` is
 * structurally assignable to it.
 */
export type SavingsGoal = {
  rewardId: string;
  title: string;
  costStars: number;
  progressStars: number;
  /** 0..1 — the bar's width, and the `data-percent` the snapshots read. */
  ratio: number;
};

export function SavingsGoalCard({
  goal,
  icon,
  copy,
}: {
  goal: SavingsGoal;
  /**
   * The goal reward's icon, already resolved to a real glyph. The app narrows
   * a stored string through `rewardIconOf`; the package only draws it.
   */
  icon: IconName;
  copy: { eyebrow: string; remaining: string; progress: string };
}) {
  const percent = Math.round(goal.ratio * 100);
  const headingId = `savings-goal-${goal.rewardId}-title`;

  return (
    <section aria-labelledby={headingId}>
      <Card
        data-testid="savings-goal"
        data-reward-id={goal.rewardId}
        data-percent={percent}
        className="group/goal relative isolate gap-0 overflow-hidden rounded-xl p-5.5"
      >
        {/* The warm glow behind the goal's icon. Ambience, not information. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-15 -right-10 -z-10 size-42 rounded-full bg-gold/10 blur-lg transition-transform duration-700 ease-brand group-hover/goal:scale-110"
        />

        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-16 shrink-0 items-center justify-center rounded-md bg-gold/15 text-gold"
          >
            <Icon name={icon} size="2xl" filled />
          </span>

          <div className="min-w-0 flex-1">
            <span className="label-overline block text-ink-muted">{copy.eyebrow}</span>
            <h2
              id={headingId}
              className="font-display text-h1 leading-tight font-extrabold text-ink"
            >
              {goal.title}
            </h2>
          </div>
        </div>

        <ProgressBar
          data-testid="goal-bar"
          value={goal.progressStars}
          max={goal.costStars}
          label={goal.title}
          tone="gold-gradient"
          size="lg"
          className="mt-4.5 h-3.5"
        />

        <div className="mt-2.5 flex items-baseline justify-between gap-4">
          <span data-testid="goal-progress" className="tnum text-body-sm text-ink-secondary">
            {copy.progress}
          </span>
          {/* Counts up to the reward, never down from a deficit. */}
          <span
            data-testid="goal-remaining"
            className="tnum font-display text-h2 font-extrabold text-gold-ink"
          >
            {copy.remaining}
          </span>
        </div>
      </Card>
    </section>
  );
}
