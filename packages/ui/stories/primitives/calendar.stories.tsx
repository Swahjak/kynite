import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Calendar } from '../../src/components/calendar';
import { FORMATTING_LOCALES } from '../../src/components/formatting-locale';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `Calendar` — the month grid, on `react-day-picker` for the keyboard model
 * (arrows across the grid, PageUp/PageDown across months, a real
 * `role="grid"`) and on our own tokens for everything visible: Baloo 2
 * captions and weekday letters, `tnum` date numbers, an indigo pill on the
 * selected day. `react-day-picker/style.css` is deliberately never imported —
 * it would drop a competing set of `--rdp-*` variables into the app for no
 * gain.
 *
 * Its localisation comes from the **household's** convention, handed in as
 * `formattingLocale`, not from the browser's — which is the entire reason
 * `DateField` exists. The three-up specimen below is where that is checked:
 * the same month, in the three conventions the product supports.
 *
 * The week always starts on Monday, `en-US` included, because the households
 * using this are European and the app's week views already start there.
 */
const meta = {
  title: 'Primitives/Calendar',
  component: Calendar,
  parameters: { layout: 'centered' },
  argTypes: {
    formattingLocale: { control: 'inline-radio', options: FORMATTING_LOCALES },
  },
  // `onSelect` is required on the component, so `satisfies Meta<typeof
  // Calendar>` demands it here — the specimens below drive their own state and
  // ignore it.
  args: { formattingLocale: 'nl-NL', onSelect: () => {} },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

const OCTOBER = new Date(2026, 9, 1);

function LiveCalendar({
  formattingLocale = 'nl-NL' as const,
  min,
  max,
}: {
  formattingLocale?: (typeof FORMATTING_LOCALES)[number];
  min?: Date;
  max?: Date;
}) {
  const [selected, setSelected] = useState(new Date(2026, 9, 23));
  return (
    <Calendar
      formattingLocale={formattingLocale}
      selected={selected}
      onSelect={setSelected}
      defaultMonth={OCTOBER}
      min={min}
      max={max}
    />
  );
}

export const Playground: Story = {
  render: (args) => <LiveCalendar formattingLocale={args.formattingLocale} />,
};

export const Locales: Story = {
  name: 'Three conventions',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Calendar">
      <SpecimenGrid>
        {FORMATTING_LOCALES.map((locale) => (
          <Specimen key={locale} name={`Calendar/${locale}`}>
            <LiveCalendar formattingLocale={locale} />
          </Specimen>
        ))}
      </SpecimenGrid>
    </Section>
  ),
};

export const Bounded: Story = {
  name: 'With min and max',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Calendar — bounds">
      <Specimen
        name="Calendar/bounded"
        note="Days outside the range render but are not selectable; the nav stops at the edge."
      >
        <LiveCalendar min={new Date(2026, 9, 12)} max={new Date(2026, 9, 30)} />
      </Specimen>
    </Section>
  ),
};
