import type { Meta, StoryObj } from '@storybook/react-vite';

import { WeekBars, type WeekBar } from '../../src/components/week-bars';
import { WEEK_STARS } from '../family';
import { Section, Specimen } from '../specimen';

/**
 * `WeekBars` — a week of stars as seven bars (`Beloningen.dc.html` §
 * "Deze week"), and nothing more than that.
 *
 * Two rules hold it to the design sheet:
 *
 * - **Seven bars, always.** A day with nothing earned keeps its column and
 *   its label and draws a hairline rule where its bar would be — the absence
 *   *is* the rendering.
 * - **Today is the only marked column.** Solid gold, darker label; the rest
 *   are the same gold at less weight. Nothing marks a day as bad.
 */
const DAYS: readonly WeekBar[] = WEEK_STARS.map((day) => ({
  key: day.day,
  label: day.day,
  value: day.stars,
  today: day.today,
  srLabel: `${day.day}: ${day.stars} sterren`,
}));

const meta = {
  title: 'Primitives/Week bars',
  component: WeekBars,
  parameters: { layout: 'padded' },
  args: { days: DAYS },
  render: (args) => (
    <div className="w-96">
      <WeekBars {...args} />
    </div>
  ),
} satisfies Meta<typeof WeekBars>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const ZeroDays: Story = {
  name: 'Empty days keep their column',
  render: () => (
    <Section title="Week bars — the zero day is a hairline, not a gap">
      <Specimen
        name="WeekBars/ma–zo"
        note='"do", "za" and "zo" earned nothing — same width, no colour, 2px rule.'
      >
        <div className="w-96">
          <WeekBars days={DAYS} />
        </div>
      </Specimen>
    </Section>
  ),
};

export const AllQuiet: Story = {
  name: 'A week with no stars yet',
  render: () => (
    <Section title="Week bars — nothing earned">
      <Specimen name="WeekBars/all zero">
        <div className="w-96">
          <WeekBars
            days={DAYS.map((day) => ({ ...day, value: 0, srLabel: `${day.label}: 0 sterren` }))}
          />
        </div>
      </Specimen>
    </Section>
  ),
};
