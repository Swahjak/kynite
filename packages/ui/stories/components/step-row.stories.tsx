import type { Meta, StoryObj } from '@storybook/react-vite';

import { StepRow } from '../../src/components/step-row';
import { Section, Specimen } from '../specimen';

/**
 * `StepRow` — one routine step, and the single control a child uses.
 *
 * Everything about it is one decision repeated:
 *
 * - **One tap, no confirmation, no spinner.** The whole row is the button.
 *   There is no dialog to dismiss and no pending state, because the board flips
 *   it optimistically before the request leaves the device.
 * - **Praise is the headline, the star is secondary.** The praise line is
 *   rendered *first in the DOM* and at heading scale; the star follows it at
 *   caption scale. A DOM-order test and a visual snapshot pin that order.
 * - **Nothing marks anything.** A step that is not done carries an empty
 *   outline, never a cross.
 *
 * The `active` row is the step the routine is *on* — 72px instead of 56px, a
 * left accent bar and a forward arrow, so a glance from across the room lands
 * on "this one next" without reading a word. The arrow is direction, not a
 * verdict: it says nothing about the rows behind it.
 *
 * A step paying `stars={0}` (a graduated routine) renders no star at all. The
 * correct UI for "this no longer pays" is absence — never a struck-through or
 * greyed star, which reads as something taken away.
 */
const meta = {
  title: 'Components/Step row',
  component: StepRow,
  parameters: { layout: 'padded' },
  argTypes: { done: { control: 'boolean' }, active: { control: 'boolean' } },
  args: {
    stepId: 'brush',
    title: 'Tanden poetsen',
    done: false,
    timerSeconds: 120,
    praiseText: 'Goed bezig!',
    stars: 3,
    starLabel: '3 sterren verdiend',
    actionLabel: 'Markeer Tanden poetsen als klaar',
    active: true,
  },
  render: (args) => (
    <ul className="flex w-full max-w-xl flex-col gap-3">
      <StepRow {...args} />
    </ul>
  ),
} satisfies Meta<typeof StepRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <Section title="Step row — the four rows on a board">
      <ul className="flex w-full max-w-xl flex-col gap-3">
        <StepRow
          stepId="dress"
          title="Aankleden"
          done
          timerSeconds={null}
          praiseText="Knap gedaan!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Aankleden is klaar"
        />
        <StepRow
          stepId="brush"
          title="Tanden poetsen"
          done={false}
          active
          timerSeconds={120}
          praiseText="Goed bezig!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Markeer Tanden poetsen als klaar"
        />
        <StepRow
          stepId="bed"
          title="Bed opmaken"
          done={false}
          timerSeconds={null}
          praiseText="Top!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Markeer Bed opmaken als klaar"
        />
        <StepRow
          stepId="pack"
          title="Tas inpakken"
          done
          timerSeconds={null}
          praiseText="Helemaal zelf!"
          stars={0}
          starLabel=""
          actionLabel="Tas inpakken is klaar"
        />
      </ul>
      <Specimen
        name="StepRow/notes"
        note="Row 1 done · row 2 live (72px, accent bar, arrow) · row 3 ahead · row 4 done on a graduated routine — no star, by design."
      >
        <span />
      </Specimen>
    </Section>
  ),
};
