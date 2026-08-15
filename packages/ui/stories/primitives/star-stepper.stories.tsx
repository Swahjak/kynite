import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { StarStepper } from '../../src/components/star-stepper';
import { Section, Specimen } from '../specimen';

/**
 * `StarStepper` — how many stars, the one number a parent sets by hand
 * (`Beloningen.dc.html` § "Hoeveel sterren", the give-stars sheet).
 *
 * The floor is a prop and its default is 0 — there is no mode, variant or
 * prop anywhere on this component that makes the value negative. A star
 * already earned is a fact about the past, so nothing here subtracts one; "alleen
 * positief: de stepper gaat niet onder nul en er is geen aftrek-modus."
 *
 * The decrement is typeset (`−`, U+2212) rather than drawn, because the 64 KB
 * icon subset has no `remove` glyph.
 */
function Demo({
  size,
  showStar,
  min = 0,
  max = 20,
}: {
  size?: 'md' | 'lg';
  showStar?: boolean;
  min?: number;
  max?: number;
}) {
  const [value, setValue] = useState(5);
  return (
    <StarStepper
      value={value}
      onValueChange={setValue}
      min={min}
      max={max}
      size={size}
      showStar={showStar}
      copy={{ decrease: 'Minder sterren', increase: 'Meer sterren', value: `${value} sterren` }}
    />
  );
}

const meta = {
  title: 'Primitives/Star stepper',
  component: StarStepper,
  parameters: { layout: 'padded' },
  args: {
    value: 5,
    onValueChange: () => {},
    copy: { decrease: 'Minder sterren', increase: 'Meer sterren', value: '5 sterren' },
  },
  render: () => <Demo />,
} satisfies Meta<typeof StarStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <Section title="Star stepper — md · lg">
      <Specimen name="StarStepper/md" note="Default — the routine builder's per-step reward.">
        <Demo size="md" />
      </Specimen>
      <Specimen
        name="StarStepper/lg + star"
        note='The give-stars sheet: `showStar`, centred, "Hoeveel sterren".'
      >
        <Demo size="lg" showStar />
      </Specimen>
    </Section>
  ),
};

export const Bounds: Story = {
  name: 'At the floor',
  render: () => (
    <Section title="Star stepper — never below zero">
      <Specimen
        name="StarStepper/min reached"
        note="The decrease button disables at `min`, not before."
      >
        <StarStepper
          value={0}
          onValueChange={() => {}}
          copy={{ decrease: 'Minder sterren', increase: 'Meer sterren', value: '0 sterren' }}
        />
      </Specimen>
    </Section>
  ),
};
