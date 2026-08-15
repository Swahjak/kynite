import type { Meta, StoryObj } from '@storybook/react-vite';

import { RewardCard, type RewardCardCopy, type RewardTile } from '../../src/components/reward-card';
import { Section } from '../specimen';

/**
 * `RewardCard` — one reward on the child's shelf, in its three readings.
 *
 * - **Affordable** — a vivid, full-colour tile that is entirely one tap. No
 *   menu, no confirm dialog, no quantity picker.
 * - **Out of reach** — the *same* tile at one reduced opacity, plus a forward
 *   hint: "nog 6 sterren". Not locked, not crossed out, not greyscale, and the
 *   hint counts *up* to something rather than reporting a shortfall. The one
 *   treatment this product has for "not yet" is dimming, and it is the same
 *   dimming the routine board uses.
 * - **Requested** — an hourglass on a blurred scrim over a settled tile: the
 *   question has been asked and the answer is somebody else's. Deliberately
 *   *not* a spinner — a spinner implies seconds, and this may take until after
 *   dinner. The price is frozen and the tile stays identifiable underneath,
 *   because "which one did I ask for?" has to stay answerable.
 *
 * There is no fourth state. A denied request removes the badge and the tile
 * goes back to being an ordinary tile — no mark, no cooldown, no explanation —
 * because a denial is a conversation and not an app mechanic.
 *
 * `tileClass` is the category hue. Category is a *sorting* signal, not a status
 * one, so the palette entries are picked for distinctness rather than meaning,
 * and red is absent from the set the way it is absent from the confetti.
 */
const COPY: RewardCardCopy = {
  cost: '10 sterren',
  shortHint: 'nog 6 sterren',
  requestedLabel: 'Papa kijkt ernaar',
  actionLabel: 'Vraag IJsje halen aan',
};

const TILE: RewardTile = {
  id: 'icecream',
  title: 'IJsje halen',
  icon: 'icecream',
  costStars: 10,
  state: 'affordable',
};

const meta = {
  title: 'Components/Reward card',
  component: RewardCard,
  parameters: { layout: 'padded' },
  argTypes: {
    tileClass: { control: 'text' },
  },
  args: { tile: TILE, tileClass: 'bg-cat-orange-surface text-cat-orange-fg', copy: COPY },
  render: (args) => (
    <ul className="w-64">
      <RewardCard {...args} onRequest={() => {}} />
    </ul>
  ),
} satisfies Meta<typeof RewardCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <Section title="Reward tile — affordable · out of reach · requested">
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <RewardCard
          tile={TILE}
          tileClass="bg-cat-orange-surface text-cat-orange-fg"
          copy={COPY}
          onRequest={() => {}}
        />
        <RewardCard
          tile={{
            id: 'zoo',
            title: 'Dierentuin',
            icon: 'park',
            costStars: 30,
            state: 'outOfReach',
          }}
          tileClass="bg-cat-purple-surface text-cat-purple-fg"
          copy={{ ...COPY, shortHint: 'nog 6 sterren', actionLabel: 'Vraag Dierentuin aan' }}
        />
        <RewardCard
          tile={{
            id: 'movie',
            title: 'Filmavond kiezen',
            icon: 'movie',
            costStars: 12,
            state: 'requested',
          }}
          tileClass="bg-cat-blue-surface text-cat-blue-fg"
          copy={{ ...COPY, cost: '12 sterren', actionLabel: 'Vraag Filmavond kiezen aan' }}
        />
      </ul>
    </Section>
  ),
};
