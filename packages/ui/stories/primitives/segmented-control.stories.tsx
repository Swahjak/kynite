import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SegmentedControl, type SegmentedOption } from '../../src/components/segmented-control';
import { Section, Specimen } from '../specimen';

/**
 * `SegmentedControl` — the sheets' two-up switch: a soft track with the
 * chosen half lifted out of it in white ("Herhalend / Eenmalig klusje" in
 * `Routines.dc.html`'s schedule section, "Bonus / Verrassing" in
 * `Beloningen.dc.html`'s give-stars sheet).
 *
 * A radio group underneath, not a row of buttons — the choice is a *mode*,
 * one of these is always true and picking one un-picks the other. Controlled:
 * `value` + `onValueChange`, so the routine builder can swap a weekday picker
 * for a date picker on the same change.
 */
const SCHEDULE_OPTIONS: readonly SegmentedOption<'recurring' | 'once'>[] = [
  { value: 'recurring', label: 'Herhalend' },
  { value: 'once', label: 'Eenmalig klusje' },
];

function Demo<Value extends string>({
  options,
  initial,
  label,
}: {
  options: readonly SegmentedOption<Value>[];
  initial: Value;
  label: string;
}) {
  const [value, setValue] = useState<Value>(initial);
  return (
    <div className="w-72">
      <SegmentedControl
        name="demo"
        options={options}
        value={value}
        onValueChange={setValue}
        label={label}
      />
    </div>
  );
}

const meta = {
  title: 'Primitives/Segmented control',
  component: SegmentedControl,
  parameters: { layout: 'padded' },
  args: {
    name: 'schedule-mode',
    options: SCHEDULE_OPTIONS,
    value: 'recurring',
    label: 'Type routine',
    onValueChange: () => {},
  },
  render: (args) => <Demo options={args.options} initial={args.value} label={args.label} />,
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Examples: Story = {
  render: () => (
    <Section title="Segmented control — the two sheets that use it">
      <div className="flex flex-col items-start gap-8">
        <Specimen
          name="SegmentedControl/Herhalend · Eenmalig"
          note="Routine builder — swaps the weekday picker for a date field."
        >
          <Demo options={SCHEDULE_OPTIONS} initial="recurring" label="Type routine" />
        </Specimen>

        <Specimen
          name="SegmentedControl/Bonus · Verrassing"
          note="Give-stars sheet — the reason a bonus star was given."
        >
          <Demo
            options={
              [
                { value: 'bonus', label: 'Bonus' },
                { value: 'surprise', label: 'Verrassing' },
              ] as const
            }
            initial="bonus"
            label="Reden"
          />
        </Specimen>
      </div>
    </Section>
  ),
};
