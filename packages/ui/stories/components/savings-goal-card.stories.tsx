import type { Meta, StoryObj } from '@storybook/react-vite';

import { SavingsGoalCard, type SavingsGoal } from '../../src/components/savings-goal-card';
import { Section } from '../specimen';

/**
 * `SavingsGoalCard` — the featured savings goal (Rewards § "Savings goal ·
 * ages 8–12"), and the `hero` card variant's reference implementation.
 *
 * One card, one goal, one bar. What it deliberately does not have:
 *
 * - **No deadline and no countdown.** A savings goal that can be *missed* is a
 *   streak with extra steps, and streaks carry loss-aversion problems. The bar
 *   only ever fills.
 * - **No comparison.** There is never a sibling's bar next to it.
 * - **No currency.** The number is stars, the icon is a star, and nothing on
 *   this card converts to money.
 *
 * The gold fill is the design system's `--gold`, the same token the star pop
 * uses, so "progress towards a reward" and "a star you earned" read as the same
 * material rather than as two unrelated highlights.
 *
 * The `<section>` around the card is not decoration: this is the goal region of
 * the store — the one thing on the page with an `h2` — named by its own heading
 * via `aria-labelledby`, because an unnamed `<section>` is not a landmark at
 * all.
 */
const GOAL: SavingsGoal = {
  rewardId: 'bike',
  title: 'Nieuwe fiets',
  costStars: 50,
  progressStars: 31,
  ratio: 31 / 50,
};

const meta = {
  title: 'Components/Savings goal card',
  component: SavingsGoalCard,
  parameters: { layout: 'padded' },
  args: {
    goal: GOAL,
    icon: 'redeem',
    copy: { eyebrow: 'Spaardoel', remaining: 'Nog 19 sterren', progress: '31 / 50' },
  },
  render: (args) => (
    <div className="w-full max-w-3xl">
      <SavingsGoalCard {...args} />
    </div>
  ),
} satisfies Meta<typeof SavingsGoalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Progress: Story = {
  render: () => (
    <Section title="Savings goal — the bar only fills">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        {[
          { progressStars: 4, remaining: 'Nog 46 sterren', progress: '4 / 50' },
          { progressStars: 31, remaining: 'Nog 19 sterren', progress: '31 / 50' },
          { progressStars: 50, remaining: 'Je kunt hem ophalen!', progress: '50 / 50' },
        ].map((step) => (
          <SavingsGoalCard
            key={step.progressStars}
            goal={{ ...GOAL, progressStars: step.progressStars, ratio: step.progressStars / 50 }}
            icon="redeem"
            copy={{ eyebrow: 'Spaardoel', remaining: step.remaining, progress: step.progress }}
          />
        ))}
      </div>
    </Section>
  ),
};
