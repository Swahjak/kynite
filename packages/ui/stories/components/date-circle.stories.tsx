import type { Meta, StoryObj } from '@storybook/react-vite';

import { Card } from '../../src/components/card';
import { DateCircle } from '../../src/components/date-circle';
import { Section, Specimen } from '../specimen';

/**
 * `DateCircle` — the weekday-over-number atom, one mark used in five places.
 *
 * The week strip, the month grid, the phone's month grid, the agenda's date
 * rail and the hub's big date each drew this by hand, at 30 / 32 / 34 / 56px,
 * disagreeing about weight and about whether "today" was a fill or a colour.
 * Three marks that agree read as one system; five that nearly agree read as
 * five accidents.
 *
 * **The ramp is four steps, not five.** `sm` 28 · `md` 32 · `lg` 40 · `xl` 56.
 * `md` absorbs the old 30 / 32 / 34 — a two-pixel difference between two
 * circles is drift, not a decision, and seven `md` circles still fit across
 * 390px with their dots underneath on screen.
 *
 * `today` is a *colour* and `selected` is a *fill*, so a strip browsed away
 * from today still shows where today was, and a view never has two filled
 * circles competing. When a day is both, `selected` wins.
 *
 * It is an atom, not a control: a `<span>` with no click behaviour, no
 * `aria-current`, no roving focus. Each caller wraps it in its own `<button>`
 * with its own selection semantics.
 */
const meta = {
  title: 'Components/Date circle',
  component: DateCircle,
  parameters: { layout: 'centered' },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'xl'] },
    state: { control: 'inline-radio', options: ['default', 'today', 'selected', 'muted'] },
    dot: { control: 'boolean' },
  },
  args: { label: 'wo', number: 14, size: 'md', state: 'default', dot: false },
} satisfies Meta<typeof DateCircle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <Section title="Date circle — the four-step ramp">
      <div className="flex flex-col gap-6">
        <Specimen name="DateCircle/sm" note="28px — dense grids, a month at 390px.">
          <DateCircle size="sm" label="wo" number={14} />
          <DateCircle size="sm" label="do" number={15} state="today" />
          <DateCircle size="sm" label="vr" number={16} state="selected" />
        </Specimen>

        <Specimen name="DateCircle/md" note="32px — the default: week strips and month cells.">
          <DateCircle size="md" label="wo" number={14} />
          <DateCircle size="md" label="do" number={15} state="today" />
          <DateCircle size="md" label="vr" number={16} state="selected" />
        </Specimen>

        <Specimen name="DateCircle/lg" note="40px — an agenda's date rail.">
          <DateCircle size="lg" label="wo" number={14} />
          <DateCircle size="lg" label="do" number={15} state="today" />
          <DateCircle size="lg" label="vr" number={16} state="selected" />
        </Specimen>

        <Specimen name="DateCircle/xl" note="56px — the one big date at the top of a hub.">
          <DateCircle size="xl" label="woensdag" number={14} />
          <DateCircle size="xl" label="donderdag" number={15} state="selected" />
        </Specimen>
      </div>
    </Section>
  ),
};

export const States: Story = {
  render: () => (
    <Section title="Date circle — the four states">
      <Specimen
        name="DateCircle/state"
        note="today is a colour, selected is a fill, muted is an outside day. selected wins when a day is both."
      >
        <DateCircle label="ma" number={12} state="default" />
        <DateCircle label="di" number={13} state="today" />
        <DateCircle label="wo" number={14} state="selected" />
        <DateCircle label="do" number={15} state="muted" />
      </Specimen>
    </Section>
  ),
};

/**
 * The dot slot keeps its height whether or not there is an event, so a strip
 * of days with and without events stays on one baseline. `dot` accepts `true`
 * for the built-in 4px marker, or a node for the callers that colour it by
 * category.
 */
export const WeekStrip: Story = {
  name: 'Week strip',
  render: () => (
    <Section title="Date circle — a week of them">
      <div className="flex flex-col gap-6">
        <Specimen
          name="DateCircle/strip"
          note="The built-in dot: brand on the selected day, --line elsewhere."
        >
          <Card className="flex-row justify-between gap-1 px-3">
            {[
              { label: 'ma', number: 12, dot: true },
              { label: 'di', number: 13, dot: false },
              { label: 'wo', number: 14, dot: true, state: 'today' as const },
              { label: 'do', number: 15, dot: true, state: 'selected' as const },
              { label: 'vr', number: 16, dot: false },
              { label: 'za', number: 17, dot: true, state: 'muted' as const },
              { label: 'zo', number: 18, dot: false, state: 'muted' as const },
            ].map((day) => (
              <DateCircle
                key={day.number}
                label={day.label}
                number={day.number}
                state={day.state}
                dot={day.dot}
              />
            ))}
          </Card>
        </Specimen>

        <Specimen
          name="DateCircle/dot — custom"
          note="A node instead of true, for a category-coloured marker."
        >
          <DateCircle
            label="wo"
            number={14}
            dot={<span className="size-1 rounded-full bg-cat-pink-solid" />}
          />
          <DateCircle
            label="do"
            number={15}
            state="today"
            dot={<span className="size-1 rounded-full bg-cat-blue-solid" />}
          />
        </Specimen>
      </div>
    </Section>
  ),
};
