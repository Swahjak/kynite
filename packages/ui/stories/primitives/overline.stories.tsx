import type { Meta, StoryObj } from '@storybook/react-vite';

import { Overline } from '../../src/components/overline';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `Overline` — the section label the design sheets set above a stack: 12px,
 * bold, tracked out, quiet ink ("TITEL & ICOON", "VOOR WIE", "STAPPEN" in
 * `Routines.dc.html`'s edit sheet).
 *
 * It is a *label*, not a heading. Where the routine builder names a form
 * field group, `Overline` is correct; where the same treatment names an
 * actual page region, `SectionHeading` is the component with the heading
 * levels — reach for that one instead.
 */
const meta = {
  title: 'Primitives/Overline',
  component: Overline,
  parameters: { layout: 'padded' },
  args: { children: 'Stappen' },
} satisfies Meta<typeof Overline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const InContext: Story = {
  name: 'As a form group label',
  render: () => (
    <Section title="Overline — naming a group, not a page">
      <SpecimenGrid>
        <Specimen name="Overline/Titel & icoon" note="Above the routine title field.">
          <Overline>Titel &amp; icoon</Overline>
        </Specimen>
        <Specimen name="Overline/Voor wie" note="Above the member-chip multi-select.">
          <Overline>Voor wie</Overline>
        </Specimen>
        <Specimen name="Overline/Stappen" note="Above the reorderable step list.">
          <Overline>Stappen</Overline>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};
