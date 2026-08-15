import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { DateField } from '../../src/components/date-field';
import { DateTimeField } from '../../src/components/date-time-field';
import { Field, FieldGroupLabel, FieldLabel } from '../../src/components/field';
import { FORMATTING_LOCALES, type FormattingLocale } from '../../src/components/formatting-locale';
import { TimeField } from '../../src/components/time-field';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `DateField`, `TimeField`, `DateTimeField` — the three fields that replaced
 * `<input type="date">`, `type="time"` and `type="datetime-local"`.
 *
 * They exist because a native date input renders its digits *and* its picker
 * in the **browser's** UI locale, with no API to override it: an en-US Chrome
 * showed `08/21/2026` and `2:30 PM` in a household that had explicitly chosen
 * `nl-NL`. So these are text inputs, formatted and parsed against the
 * household's convention — which arrives as the `locale` prop, and which is
 * what the locale toolbar below each specimen is really testing.
 *
 * The value crossing the component boundary is unchanged from the native
 * input's: ISO `yyyy-MM-dd`, 24-hour `HH:mm`, `yyyy-MM-ddTHH:mm`, submitted
 * through a hidden input under `name`. Typing is lenient (`21-8-26`,
 * `21082026`) and normalises on blur; unreadable text keeps the field in its
 * error state and emits `''` rather than a half-parsed date.
 *
 * Every string is a prop (`labels`), with English defaults — the app's
 * wrappers in `apps/web/src/components/ui/` inject the translated copy and
 * read `locale` from `useFormattingLocale()`. That is the whole of what kept
 * these three in the app until Wave A.
 */
const meta = {
  title: 'Primitives/Date & time fields',
  component: DateField,
  parameters: { layout: 'padded' },
  argTypes: {
    locale: { control: 'inline-radio', options: FORMATTING_LOCALES },
    size: { control: 'inline-radio', options: ['default', 'hub'] },
    disabled: { control: 'boolean' },
  },
  args: { locale: 'nl-NL', size: 'hub', disabled: false },
} satisfies Meta<typeof DateField>;

export default meta;
type Story = StoryObj<typeof meta>;

const DUTCH = {
  date: { pick: 'Kies een datum', invalid: 'Gebruik dd-mm-jjjj.', outOfRange: 'Buiten bereik.' },
  time: { pick: 'Kies een tijd', invalid: 'Gebruik uu:mm.' },
};

/** The wire value beside the field — the whole contract, visible. */
function Wire({ value }: { value: string }) {
  return (
    <p className="font-mono text-caption text-ink-muted">verstuurd: {value === '' ? '—' : value}</p>
  );
}

function DateSpecimen({ locale }: { locale: FormattingLocale }) {
  const [value, setValue] = useState('2026-10-23');
  return (
    <Field className="w-64">
      <FieldLabel>Datum</FieldLabel>
      <DateField
        locale={locale}
        labels={DUTCH.date}
        size="hub"
        value={value}
        onValueChange={setValue}
      />
      <Wire value={value} />
    </Field>
  );
}

function TimeSpecimen({ locale }: { locale: FormattingLocale }) {
  const [value, setValue] = useState('14:30');
  return (
    <Field className="w-48">
      <FieldLabel>Tijd</FieldLabel>
      <TimeField
        locale={locale}
        labels={DUTCH.time}
        size="hub"
        value={value}
        onValueChange={setValue}
      />
      <Wire value={value} />
    </Field>
  );
}

export const Playground: Story = {
  parameters: { layout: 'centered' },
  render: (args) => (
    <div className="w-64">
      <DateField {...args} labels={DUTCH.date} defaultValue="2026-10-23" aria-label="Datum" />
    </div>
  ),
};

export const Dates: Story = {
  name: 'DateField',
  render: () => (
    <Section title="DateField">
      <SpecimenGrid>
        {FORMATTING_LOCALES.map((locale) => (
          <Specimen
            key={locale}
            name={`DateField/${locale}`}
            note="Same instant, three conventions — the wire value never moves."
          >
            <DateSpecimen locale={locale} />
          </Specimen>
        ))}
      </SpecimenGrid>
    </Section>
  ),
};

export const Times: Story = {
  name: 'TimeField',
  render: () => (
    <Section title="TimeField">
      <SpecimenGrid>
        {FORMATTING_LOCALES.map((locale) => (
          <Specimen
            key={locale}
            name={`TimeField/${locale}`}
            note="`en-US` is the only 12-hour convention here. The picker lists quarter hours."
          >
            <TimeSpecimen locale={locale} />
          </Specimen>
        ))}
      </SpecimenGrid>
    </Section>
  ),
};

function DateTimeSpecimen() {
  const [value, setValue] = useState('2026-10-23T14:30');
  return (
    <div className="flex flex-col gap-2">
      <FieldGroupLabel id="starts-at">Begint om</FieldGroupLabel>
      <DateTimeField
        aria-labelledby="starts-at"
        dateLabel="Datum"
        timeLabel="Tijd"
        dateLabels={DUTCH.date}
        timeLabels={DUTCH.time}
        size="hub"
        className="w-80"
        value={value}
        onValueChange={setValue}
      />
      <Wire value={value} />
    </div>
  );
}

export const DateTimes: Story = {
  name: 'DateTimeField',
  render: () => (
    <Section title="DateTimeField">
      <Specimen
        name="DateTimeField/default"
        note="A `role=group` labelled once, with a short label on each half — so a screen reader says “Begint om, Datum”, not the same word twice."
      >
        <DateTimeSpecimen />
      </Specimen>
    </Section>
  ),
};
