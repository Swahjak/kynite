import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  RoutineCard,
  type RoutineCardProps,
  type RoutineCardRoutine,
} from '../../src/components/routine-card';
import { Section, Specimen } from '../specimen';

/**
 * `RoutineCard` — the child's board card, in the readings the Routines section
 * of the design sheet lays out: **due (expanded)**, **done**, **grace**,
 * **upcoming** and **graduated**.
 *
 * One card is expanded at a time — the first that is actionable now. Everything
 * else collapses, so the board stays glanceable from six feet instead of
 * becoming a wall of rows.
 *
 * The thing worth staring at here is what the states *do not* look like. A
 * routine still ahead and a routine from yesterday still inside its grace
 * window get the **same** neutral dimming: one opacity, no colour change, no
 * border, no icon, and no word about being late. "Missed" and "not yet" look
 * identical because neither is a failure, and grace is phrased as an invitation
 * ("van gisteren — mag nog tot vanavond") rather than as a penalty. A routine
 * that is genuinely gone is simply absent; there is no sixth state.
 *
 * `data-state` and `data-complete` are the contract the Playwright assertions
 * and the visual snapshots read; the classes are what a family sees.
 */
const COPY: RoutineCardProps['copy'] = {
  stepCount: '3 van 5 stappen',
  inProgress: 'NU',
  doneLine: 'Klaar — goed gedaan!',
  countdown: null,
  starLabel: (amount) => `${amount} sterren verdiend`,
  actionLabel: (title) => `Markeer ${title} als klaar`,
  praise: (key) => ({ great: 'Goed bezig!', proud: 'Knap gedaan!' })[key] ?? 'Top!',
  graduated: null,
};

const MORNING: RoutineCardRoutine = {
  id: 'morning',
  title: 'Ochtendroutine',
  icon: 'wb_sunny',
  state: 'due',
  complete: false,
  starsPerCompletion: 3,
  steps: [
    { id: '1', title: 'Aankleden', done: true, timerSeconds: null, praiseKey: 'great' },
    { id: '2', title: 'Tanden poetsen', done: false, timerSeconds: 120, praiseKey: 'proud' },
    { id: '3', title: 'Ontbijt opeten', done: false, timerSeconds: null, praiseKey: 'great' },
  ],
};

const meta = {
  title: 'Components/Routine card',
  component: RoutineCard,
  parameters: { layout: 'padded' },
  argTypes: { expanded: { control: 'boolean' } },
  args: { routine: MORNING, expanded: true, copy: COPY },
  render: (args) => (
    <div className="w-full max-w-xl">
      <RoutineCard {...args} />
    </div>
  ),
} satisfies Meta<typeof RoutineCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <Section title="Routine card — the five readings">
      <div className="flex w-full max-w-xl flex-col gap-8">
        <Specimen
          name="RoutineCard/due (expanded)"
          note="The one live card: 56px step rows, the live step at 72px with its accent bar."
        >
          <div className="w-full min-w-0">
            <RoutineCard routine={MORNING} expanded copy={COPY} onComplete={() => {}} />
          </div>
        </Specimen>

        <Specimen name="RoutineCard/done" note="A calm success line. Not a trophy, not a score.">
          <div className="w-full min-w-0">
            <RoutineCard
              expanded={false}
              copy={COPY}
              routine={{
                ...MORNING,
                id: 'woken',
                title: 'Wakker worden',
                icon: 'wb_twilight',
                complete: true,
                steps: MORNING.steps.map((step) => ({ ...step, done: true })),
              }}
            />
          </div>
        </Specimen>

        <Specimen
          name="RoutineCard/grace"
          note="Yesterday's, still open. Dimmed — and nothing says it is late."
        >
          <div className="w-full min-w-0">
            <RoutineCard
              expanded={false}
              routine={{
                ...MORNING,
                id: 'laundry',
                title: 'Was opruimen',
                icon: 'checkroom',
                state: 'grace',
              }}
              copy={{ ...COPY, stepCount: 'van gisteren — mag nog tot vanavond' }}
            />
          </div>
        </Specimen>

        <Specimen
          name="RoutineCard/upcoming"
          note="Still ahead. The same dimming, plus a countdown chip — a fact, not a warning."
        >
          <div className="w-full min-w-0">
            <RoutineCard
              expanded={false}
              routine={{
                ...MORNING,
                id: 'homework',
                title: 'Huiswerk',
                icon: 'backpack',
                state: 'upcoming',
              }}
              copy={{ ...COPY, stepCount: '3 stappen · +2 sterren', countdown: 'over 4 uur' }}
            />
          </div>
        </Specimen>

        <Specimen
          name="RoutineCard/graduated"
          note="A quiet badge, never a downgrade. Stars stop; the routine does not."
        >
          <div className="w-full min-w-0">
            <RoutineCard
              expanded={false}
              routine={{
                ...MORNING,
                id: 'breakfast',
                title: 'Ontbijt',
                icon: 'restaurant',
                state: 'none',
                starsPerCompletion: 0,
              }}
              copy={{
                ...COPY,
                stepCount: '2 stappen',
                graduated: 'Afgestudeerd — dat kun jij al zelf!',
              }}
            />
          </div>
        </Specimen>
      </div>
    </Section>
  ),
};
