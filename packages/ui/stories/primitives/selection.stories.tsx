import type { Meta, StoryObj } from '@storybook/react-vite';

import { Checkbox } from '../../src/components/checkbox';
import { Icon } from '../../src/components/icon';
import { Switch } from '../../src/components/switch';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `Selection controls` — the design system's checkbox, switch, radio and the
 * two task-row toggles.
 *
 * The checkbox and the switch are `@kynite/ui` primitives; the radio is still
 * drawn here from the sheet's own CSS, marked as such — a specimen waiting for
 * a component, not a component being documented.
 *
 * Checkbox and switch look adjacent and mean opposite things. A checkbox is an
 * *event*: it pops, it celebrates, a star lands. A switch is a *setting*: a
 * routine in the parent's beheer list is running or paused, and nothing is
 * being achieved by flipping it. Wave C's `Pages/Routines` beheer screen is
 * what made the distinction load-bearing enough to promote.
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

export const Switches: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Selection controls — switch">
      <SpecimenGrid>
        <Specimen name="Switch/On" note="A routine that is running. No pop, no star — a setting.">
          <label className="flex items-center gap-3 text-body">
            <Switch defaultChecked />
            Ochtendroutine actief
          </label>
        </Specimen>
        <Specimen name="Switch/Off">
          <label className="flex items-center gap-3 text-body">
            <Switch />
            Was opruimen gepauzeerd
          </label>
        </Specimen>
        <Specimen name="Switch/Disabled">
          <label className="flex items-center gap-3 text-body text-ink-muted">
            <Switch disabled defaultChecked />
            Vergrendeld
          </label>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const NotYetComponents: Story = {
  name: 'Radio (not yet a component)',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Selection controls — awaiting a component">
      <p className="max-w-prose text-body-sm text-ink-secondary">
        Drawn from the design sheet&apos;s own CSS. Nothing in the product renders a radio yet,
        which is why it is markup here rather than a primitive — promote it when a screen needs one.
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
      </SpecimenGrid>
    </Section>
  ),
};
