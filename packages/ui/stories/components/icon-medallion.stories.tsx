import type { Meta, StoryObj } from '@storybook/react-vite';

import { IconMedallion } from '../../src/components/icon-medallion';
import { StarMedallion } from '../../src/components/star-count';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `IconMedallion` — a tinted tile with one icon in it, and the single most
 * repeated shape in the product: the leading glyph on a list row, the tile
 * beside a section heading, the star medallion on the rewards board, the icon
 * in an empty state.
 *
 * The design sheet does not name it as a component, but it composes it
 * everywhere. `Card/Toast`'s "leading icon badge: `32px; border-radius:9999px;
 * background:rgba(93,95,239,0.25)`" and the checkbox-pop specimen's "`48px`
 * rounded-square badge (`border-radius:12px`)" are the same object at two sizes
 * and two corner treatments — which is exactly what `size` and `shape` are.
 *
 * `StarMedallion` is the one fixed instance worth its own name: the star
 * currency as a tile rather than as a chip (rewards balance, child launcher,
 * page title). Five hand-rolled copies of it existed at four sizes.
 */
const TINTS = [
  'brand',
  'brand-solid',
  'brand-container',
  'gold',
  'muted',
  'success',
  'destructive',
] as const;

const SIZES = ['sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const;

const meta = {
  title: 'Components/Icon medallion',
  component: IconMedallion,
  parameters: { layout: 'padded' },
  argTypes: {
    tint: { control: 'inline-radio', options: TINTS },
    shape: { control: 'inline-radio', options: ['circle', 'squircle'] },
    size: { control: 'inline-radio', options: SIZES },
    filled: { control: 'boolean' },
  },
  args: { icon: 'star', tint: 'gold', shape: 'circle', size: 'lg', filled: true },
} satisfies Meta<typeof IconMedallion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tints: Story = {
  render: () => (
    <Section title="Icon medallion — tints">
      <SpecimenGrid>
        {TINTS.map((tint) => (
          <Specimen key={tint} name={`Medallion/${tint}`}>
            <IconMedallion icon="task_alt" tint={tint} filled />
            <IconMedallion icon="task_alt" tint={tint} shape="squircle" filled />
          </Specimen>
        ))}
      </SpecimenGrid>
    </Section>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Section title="Icon medallion — size ramp">
      <Specimen
        name="Medallion/sizes"
        note="32 · 40 · 48 · 56 · 64 · 96px. The glyph size follows the tile; `iconSize` overrides it."
      >
        {SIZES.map((size) => (
          <IconMedallion key={size} icon="celebration" tint="brand-container" size={size} filled />
        ))}
      </Specimen>
    </Section>
  ),
};

export const Star: Story = {
  render: () => (
    <Section title="Star medallion">
      <SpecimenGrid>
        <Specimen name="StarMedallion/circle" note="The rewards balance headline.">
          <StarMedallion size="2xl" label="24 sterren" />
        </Specimen>
        <Specimen name="StarMedallion/squircle" note="Beside a page title.">
          <StarMedallion shape="squircle" size="xl" label="24 sterren" />
        </Specimen>
        <Specimen
          name="StarMedallion/animate"
          note="`kynite-anim-pop` — the idle celebrate from Motion & celebration."
        >
          <StarMedallion size="2xl" animate label="24 sterren" />
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};
