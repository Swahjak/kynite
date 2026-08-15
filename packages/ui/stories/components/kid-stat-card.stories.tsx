import type { Meta, StoryObj } from '@storybook/react-vite';

import { KidStatCard } from '../../src/components/kid-stat-card';
import { MEMBERS, Section, Specimen } from '../specimen';

/**
 * `KidStatCard` — one child's day as a stat block: face, how much of today's
 * routine work is done, the stars earned, and a bar in that child's own colour.
 *
 * Shared by two tabs — "Routines" draws a grid of the compact size, "Sterren"
 * stacks the large one beside the star matrix — because it is the same three
 * facts either way, and two copies would drift the moment one of them gained a
 * fourth.
 *
 * The bar's colour is the *member's*, not a semantic tone: on a screen showing
 * four children at once the hue is the fastest thing that says whose row this
 * is. It arrives as a class rather than as a `MemberColor`, so the design
 * system draws the hue without knowing whose it is.
 *
 * There is no streak and no level here, deliberately. Both are a product cut,
 * and this block is built from the facts this system actually keeps.
 */
const HUES = [
  { bar: 'bg-cat-pink-solid', surface: 'bg-cat-pink-surface text-cat-pink-fg' },
  { bar: 'bg-cat-blue-solid', surface: 'bg-cat-blue-surface text-cat-blue-fg' },
  { bar: 'bg-cat-purple-solid', surface: 'bg-cat-purple-surface text-cat-purple-fg' },
  { bar: 'bg-cat-yellow-solid', surface: 'bg-cat-yellow-surface text-cat-yellow-fg' },
];

const PROGRESS = [
  { steps: '4 van 5 stappen', percent: 80, stars: 6 },
  { steps: '2 van 5 stappen', percent: 40, stars: 3 },
  { steps: '5 van 5 stappen', percent: 100, stars: 8 },
  { steps: 'Niets te doen vandaag', percent: 0, stars: 0 },
];

const meta = {
  title: 'Components/Kid stat card',
  component: KidStatCard,
  parameters: { layout: 'padded' },
  argTypes: { size: { control: 'inline-radio', options: ['compact', 'default'] } },
  args: {
    name: 'Mila',
    avatarUrl: MEMBERS[0].src,
    avatarSurfaceClass: HUES[0].surface,
    barClass: HUES[0].bar,
    starsToday: 6,
    percent: 80,
    stepsLabel: '4 van 5 stappen',
    starsLabel: '6 sterren vandaag',
    progressLabel: 'Voortgang van Mila',
    size: 'default',
  },
  render: (args) => (
    <div className="w-72 rounded-2xl bg-card p-5 shadow-sm">
      <KidStatCard {...args} />
    </div>
  ),
} satisfies Meta<typeof KidStatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Family: Story = {
  render: () => (
    <Section title="Kid stat card — the family, at both sizes">
      <div className="flex w-full flex-col gap-8">
        <Specimen name="KidStatCard/compact" note="The Routines tab's grid.">
          <div className="grid w-full grid-cols-1 gap-4 rounded-2xl bg-card p-5 shadow-sm sm:grid-cols-2">
            {MEMBERS.map((member, index) => (
              <KidStatCard
                key={member.name}
                size="compact"
                name={member.name}
                avatarUrl={member.src}
                avatarSurfaceClass={HUES[index].surface}
                barClass={HUES[index].bar}
                starsToday={PROGRESS[index].stars}
                percent={PROGRESS[index].percent}
                stepsLabel={PROGRESS[index].steps}
                starsLabel={`${PROGRESS[index].stars} sterren vandaag`}
                progressLabel={`Voortgang van ${member.name}`}
              />
            ))}
          </div>
        </Specimen>

        <Specimen name="KidStatCard/default" note="The Sterren tab, beside the star matrix.">
          <div className="w-80 rounded-2xl bg-card p-5 shadow-sm">
            <KidStatCard
              name={MEMBERS[2].name}
              avatarUrl={MEMBERS[2].src}
              avatarSurfaceClass={HUES[2].surface}
              barClass={HUES[2].bar}
              starsToday={8}
              percent={100}
              stepsLabel="5 van 5 stappen"
              starsLabel="8 sterren vandaag"
              progressLabel="Voortgang van Lotte"
            />
          </div>
        </Specimen>
      </div>
    </Section>
  ),
};
