import type { Meta, StoryObj } from '@storybook/react-vite';

import { Icon, ICON_SIZES } from '../../src/components/icon';
import { ICON_CODEPOINTS, type IconName } from '../../src/components/icon-codepoints';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `Icon` — Material Symbols Outlined, rendered from the self-hosted subset.
 *
 * The gallery below is generated from `ICON_CODEPOINTS`, which is *generated*
 * by `apps/web/scripts/subset-icons.mjs` from the `<Icon name="…">` call sites
 * in both source trees. So it is not a curated list: it is exactly the glyphs
 * the product ships, and it cannot show one the font does not carry. The
 * subset is held to a 64 KB budget with roughly 1–2 KB of headroom, which is
 * why "add an icon" is a deliberate act rather than a free one.
 */
const meta = {
  title: 'Primitives/Icon',
  component: Icon,
  parameters: { layout: 'centered' },
  argTypes: {
    name: { control: 'select', options: Object.keys(ICON_CODEPOINTS) },
    size: { control: 'inline-radio', options: Object.keys(ICON_SIZES) },
    filled: { control: 'boolean' },
  },
  args: { name: 'star', size: 'xl', filled: false },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Icon — sizes">
      <SpecimenGrid>
        <Specimen name="xs 14 · sm 18 · md 24 · lg 28 · xl 32 · 2xl 40">
          {(Object.keys(ICON_SIZES) as (keyof typeof ICON_SIZES)[]).map((size) => (
            <Icon key={size} name="calendar_month" size={size} />
          ))}
        </Specimen>
        <Specimen
          name="Icon/filled"
          note="`FILL 1` — the active/emphasised state, one variation axis."
        >
          <Icon name="star" size="xl" />
          <Icon name="star" size="xl" filled className="text-gold" />
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const Gallery: Story = {
  name: 'The subset',
  parameters: { layout: 'padded' },
  render: () => {
    const names = Object.keys(ICON_CODEPOINTS) as IconName[];
    return (
      <Section title={`Icon — all ${names.length} shipped glyphs`}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-4">
          {names.map((name) => (
            <div
              key={name}
              className="flex flex-col items-center gap-2 rounded-xl bg-card p-3 text-center shadow-sm"
            >
              <Icon name={name} size="lg" />
              <span className="font-mono text-[10px] break-all text-ink-muted">{name}</span>
            </div>
          ))}
        </div>
      </Section>
    );
  },
};
