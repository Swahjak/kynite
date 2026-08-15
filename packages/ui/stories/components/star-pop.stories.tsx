import type { Meta, StoryObj } from '@storybook/react-vite';

import { StarPop } from '../../src/components/star-pop';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `StarPop` — the deliberately *quiet* half of completion feedback (Motion &
 * celebration).
 *
 * The praise text is the headline and the star is secondary, so the star does
 * not burst, spin or fill the screen: it scales up once, settles, and stays. A
 * single non-repeating transform is also, conveniently, unable to strobe — the
 * WCAG 2.3.1 flash rate here is zero by construction rather than by tuning.
 *
 * `intensity` only picks how long the settle takes (`CELEBRATION_PRESETS`); the
 * *shape* of the animation never changes, because "a bigger moment" is a bigger
 * confetti burst, not a louder star.
 *
 * `amount={0}` renders **nothing at all**. A graduated routine pays no stars,
 * and the correct UI for that is absence — never a struck-through or greyed-out
 * star, which reads as something taken away.
 *
 * The pop plays on mount, so reload the story frame to watch it again.
 */
const meta = {
  title: 'Components/Star pop',
  component: StarPop,
  parameters: { layout: 'padded' },
  argTypes: { intensity: { control: 'inline-radio', options: ['gentle', 'standard', 'big'] } },
  args: { amount: 3, label: '3 sterren verdiend', intensity: 'gentle' },
} satisfies Meta<typeof StarPop>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Intensities: Story = {
  render: () => (
    <Section title="Star pop">
      <SpecimenGrid>
        {(['gentle', 'standard', 'big'] as const).map((intensity) => (
          <Specimen key={intensity} name={`StarPop/${intensity}`}>
            <StarPop amount={3} label="3 sterren verdiend" intensity={intensity} />
          </Specimen>
        ))}
        <Specimen name="StarPop/0" note="A graduated step pays nothing — and shows nothing.">
          <StarPop amount={0} label="" />
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};
