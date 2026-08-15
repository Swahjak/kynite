import type { Meta, StoryObj } from '@storybook/react-vite';

import { Field, FieldDescription, FieldError, FieldLabel } from '../../src/components/field';
import { Input } from '../../src/components/input';
import { Textarea } from '../../src/components/textarea';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `Inputs` — the design system's Inputs section: an *underline* text field
 * (`#f5f3ee` fill, 2px bottom border, top corners only), an uppercase Baloo 2
 * label above it, and the pill search variant.
 *
 * The specimens below are `Field` + `FieldLabel` + `Input` together, because
 * that is the unit: the label turns brand-indigo on focus through
 * `group-data-[focused]/field`, so a bare `Input` cannot show the focused
 * specimen at all.
 */
const meta = {
  title: 'Primitives/Inputs',
  component: Input,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'search', 'bare'] },
    size: { control: 'inline-radio', options: ['default', 'hub'] },
    disabled: { control: 'boolean' },
  },
  args: { placeholder: 'Family Dinner', variant: 'default', size: 'hub' },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  decorators: [(Story) => <div className="w-72">{Story()}</div>],
};

export const States: Story = {
  name: 'Text field states',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Inputs — states">
      <SpecimenGrid>
        <Specimen name="Input/Default">
          <Field className="w-64">
            <FieldLabel>Event title</FieldLabel>
            <Input size="hub" defaultValue="Family Dinner" />
          </Field>
        </Specimen>
        <Specimen name="Input/Focused" note="Click in: the underline and the label both go brand.">
          <Field className="w-64">
            <FieldLabel>Focused</FieldLabel>
            <Input size="hub" defaultValue="Tandarts Lotte" autoFocus />
          </Field>
        </Specimen>
        <Specimen name="Input/Error">
          <Field className="w-64">
            <FieldLabel>Error</FieldLabel>
            <Input size="hub" placeholder="Verplicht veld" aria-invalid />
            <FieldError match="valueMissing">Dit veld is verplicht</FieldError>
          </Field>
        </Specimen>
        <Specimen name="Input/Disabled">
          <Field className="w-64">
            <FieldLabel>Disabled</FieldLabel>
            <Input size="hub" defaultValue="Ontbijt" disabled />
          </Field>
        </Specimen>
        <Specimen name="Input/With description">
          <Field className="w-64">
            <FieldLabel>Locatie</FieldLabel>
            <Input size="hub" placeholder="Sporthal De Kuip" />
            <FieldDescription>Optioneel — verschijnt op de hub.</FieldDescription>
          </Field>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const Search: Story = {
  name: 'Search field',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Inputs — search">
      <Specimen
        name="Input/Search"
        note="Pill, 48px tall. The sheet draws a leading `search` glyph; the 64 KB icon subset does not carry one, because nothing in the product renders it yet. Adding it is a budget decision, not a story fix — so the specimen is shown without."
      >
        <div className="w-80">
          <Input variant="search" placeholder="Search family, tasks, events" />
        </div>
      </Specimen>
    </Section>
  ),
};

export const MultiLine: Story = {
  name: 'Textarea',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Inputs — textarea">
      <SpecimenGrid>
        <Specimen name="Textarea/default">
          <Field className="w-72">
            <FieldLabel>Notitie</FieldLabel>
            <Textarea placeholder="Gymkleren mee, zwemtas in de gang." rows={3} />
          </Field>
        </Specimen>
        <Specimen name="Textarea/hub">
          <Field className="w-72">
            <FieldLabel>Notitie</FieldLabel>
            <Textarea size="hub" placeholder="Gymkleren mee." rows={3} />
          </Field>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};
