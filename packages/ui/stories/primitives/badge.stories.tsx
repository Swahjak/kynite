import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../../src/components/badge';
import { Icon } from '../../src/components/icon';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `Chips & badges` — the design system's seven specimens, plus the sizes.
 *
 * The category chip is not a `Badge` variant: categories are a *palette*
 * (eight hues × four tones), so the chip is composed from the `--cat-*`
 * tokens. It is shown here anyway, because a reader looking for "the chip"
 * looks in this section.
 */
const meta = {
  title: 'Primitives/Chips & badges',
  component: Badge,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'outline',
        'ghost',
        'muted',
        'soft',
        'gold',
        'now',
        'today',
        'status',
        'count',
        'destructive',
        'link',
      ],
    },
    size: { control: 'inline-radio', options: ['default', 'md', 'lg', 'hub'] },
  },
  args: { children: 'Badge', variant: 'default', size: 'md' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Specimens: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Chips & badges">
      <SpecimenGrid>
        <Specimen name="Badge/Count" note="Destructive tint, 10px Baloo 2, 0.05em.">
          <Badge variant="count" size="md">
            2 NEW
          </Badge>
        </Specimen>
        <Specimen name="Badge/Status" note="Solid indigo — NOW, LIVE, VANDAAG.">
          <Badge variant="status" size="md">
            NOW
          </Badge>
        </Specimen>
        <Specimen name="Badge/Now" note="The red current-time marker.">
          <Badge variant="now" size="md">
            NU
          </Badge>
        </Specimen>
        <Specimen name="Badge/Today">
          <Badge variant="today" size="md">
            VANDAAG
          </Badge>
        </Specimen>
        <Specimen name="Chip/Star count" note="Orange tint, filled star, Poppins 700.">
          <Badge variant="gold" size="md">
            <Icon name="star" filled size="sm" inline="start" />
            12
          </Badge>
        </Specimen>
        <Specimen name="Chip/Default">
          <Badge variant="muted" size="md">
            Default chip
          </Badge>
        </Specimen>
        <Specimen name="Chip/Selected">
          <Badge variant="default" size="md">
            Selected
          </Badge>
        </Specimen>
        <Specimen
          name="Chip/Removable"
          note="Trailing affordance; the app wires the handler. The sheet uses a `close` glyph, which the 64 KB subset does not carry — `delete` stands in."
        >
          <Badge variant="muted" size="md" className="pr-2.5">
            Removable
            <Icon name="delete" size="xs" inline="end" className="ml-1.5" />
          </Badge>
        </Specimen>
        <Specimen name="Chip/Soft">
          <Badge variant="soft" size="md">
            Soft
          </Badge>
        </Specimen>
        <Specimen name="Chip/Outline">
          <Badge variant="outline" size="md">
            Outline
          </Badge>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const Sizes: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Chips & badges — sizes">
      <Specimen name="default · md · lg · hub" note="`hub` is the 48px wall-readable step.">
        <Badge size="default">default</Badge>
        <Badge size="md">md</Badge>
        <Badge size="lg">lg</Badge>
        <Badge size="hub">hub</Badge>
      </Specimen>
    </Section>
  ),
};

const CATEGORIES = [
  { name: 'School', key: 'blue' },
  { name: 'Sports', key: 'green' },
  { name: 'Health', key: 'red' },
  { name: 'Chores', key: 'purple' },
  { name: 'Family', key: 'pink' },
  { name: 'Personal', key: 'teal' },
  { name: 'Play', key: 'yellow' },
  { name: 'Travel', key: 'orange' },
];

export const CategoryChips: Story = {
  name: 'Chip/Category',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Chips & badges — categories">
      <Specimen
        name="Chip/Category"
        note="Composed from the --cat-* palette rather than from a Badge variant: eight hues, four tones each."
      >
        {CATEGORIES.map((category) => (
          <span
            key={category.key}
            className="inline-flex items-center gap-2 rounded-4xl border px-4 py-2 font-display text-body-sm font-semibold"
            style={{
              background: `var(--cat-${category.key}-surface)`,
              borderColor: `var(--cat-${category.key}-border)`,
              color: `var(--cat-${category.key}-fg)`,
            }}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: `var(--cat-${category.key}-solid)` }}
              aria-hidden
            />
            {category.name}
          </span>
        ))}
      </Specimen>
    </Section>
  ),
};
