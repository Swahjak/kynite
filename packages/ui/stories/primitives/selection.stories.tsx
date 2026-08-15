import type { Meta, StoryObj } from '@storybook/react-vite';

import { Checkbox } from '../../src/components/checkbox';
import { Icon } from '../../src/components/icon';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `Selection controls` — the design system's checkbox, radio, switch and the
 * two task-row toggles.
 *
 * Only the checkbox is a `@kynite/ui` primitive today. The radio and the
 * switch are drawn here from the sheet's own CSS, marked as such: they are
 * specimens waiting for a component, not a component being documented. Adding
 * them to the package is a phase-3 item.
 */
const meta = {
  title: 'Primitives/Selection controls',
  component: Checkbox,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Checkboxes: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Selection controls — checkbox">
      <SpecimenGrid>
        <Specimen name="Checkbox/Off">
          <label className="flex items-center gap-3 text-body">
            <Checkbox />
            Unchecked
          </label>
        </Specimen>
        <Specimen name="Checkbox/On" note="The check glyph pops in once — `kynite-anim-check`.">
          <label className="flex items-center gap-3 text-body">
            <Checkbox defaultChecked />
            Checked
          </label>
        </Specimen>
        <Specimen name="Checkbox/Indeterminate">
          <label className="flex items-center gap-3 text-body">
            <Checkbox indeterminate />
            Partly done
          </label>
        </Specimen>
        <Specimen name="Checkbox/Disabled">
          <label className="flex items-center gap-3 text-body text-ink-muted">
            <Checkbox disabled />
            Disabled
          </label>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const TaskRowToggles: Story = {
  name: 'Task row toggles',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Selection controls — task rows">
      <SpecimenGrid>
        <Specimen name="Toggle/Task row — open">
          <span className="flex items-center gap-3 text-body-sm">
            <Icon name="radio_button_unchecked" size="sm" className="text-line" />
            Boodschappen bestellen
          </span>
        </Specimen>
        <Specimen name="Toggle/Task row — done">
          <span className="flex items-center gap-3 text-body-sm text-ink-muted line-through">
            <Icon name="check_circle" filled size="sm" style={{ color: 'oklch(55% 0.14 155)' }} />
            Tafel afruimen
          </span>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const NotYetComponents: Story = {
  name: 'Radio & switch (not yet components)',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Selection controls — awaiting a component">
      <p className="max-w-prose text-body-sm text-ink-secondary">
        Drawn from the design sheet&apos;s own CSS. Nothing in the product renders these yet, which
        is why they are markup here rather than primitives — promote them when a screen needs one.
      </p>
      <SpecimenGrid>
        <Specimen name="Radio/Off">
          <span className="flex items-center gap-3 text-body">
            <span className="size-5.5 rounded-full border-2 border-line" />
            Radio off
          </span>
        </Specimen>
        <Specimen name="Radio/On">
          <span className="flex items-center gap-3 text-body">
            <span className="size-5.5 rounded-full border-6 border-primary" />
            Radio on
          </span>
        </Specimen>
        <Specimen name="Switch/On">
          <span className="flex items-center gap-3 text-body">
            <span className="flex h-6.5 w-11 items-center justify-end rounded-4xl bg-primary p-[3px]">
              <span className="size-5 rounded-full bg-white" />
            </span>
            Switch on
          </span>
        </Specimen>
        <Specimen name="Switch/Off">
          <span className="flex items-center gap-3 text-body">
            <span className="flex h-6.5 w-11 items-center justify-start rounded-4xl bg-line p-[3px]">
              <span className="size-5 rounded-full bg-white" />
            </span>
            Switch off
          </span>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};
