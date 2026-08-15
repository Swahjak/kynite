import type { Meta, StoryObj } from '@storybook/react-vite';

import { StarCount } from '../../src/components/star-count';
import { Section, Specimen } from '../specimen';

/**
 * `StarCount` — `Chips & badges` § star count:
 *
 * ```css
 * display:inline-flex;align-items:center;gap:6px;
 * background:rgba(239,141,93,0.16);color:#ef8d5d;
 * font-family:'Poppins';font-weight:700;font-size:14px;
 * padding:7px 14px;border-radius:9999px;
 * ```
 *
 * plus a filled star at 18px. The star sits *after* the number, matching how
 * the count is spoken ("12 sterren").
 *
 * The visible number is `aria-hidden` and paired with a real translated
 * sentence in `srLabel`. "12" next to a star glyph is not a sentence, and the
 * unit has to survive into the accessibility tree — which is also why the label
 * is a required prop rather than something the component tries to build from a
 * number it cannot pluralise.
 */
const meta = {
  title: 'Components/Star count',
  component: StarCount,
  parameters: { layout: 'padded' },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } },
  args: { value: 12, srLabel: '12 sterren', size: 'md' },
} satisfies Meta<typeof StarCount>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <Section title="Star count">
      <Specimen name="StarCount/sm · md · lg" note="`tnum` — the digits never reflow as they tick.">
        <StarCount value={3} srLabel="3 sterren" size="sm" />
        <StarCount value={12} srLabel="12 sterren" size="md" />
        <StarCount value={124} srLabel="124 sterren" size="lg" />
      </Specimen>
    </Section>
  ),
};
