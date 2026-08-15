import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../src/components/button';
import { Icon } from '../../src/components/icon';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `Buttons` — every specimen the design system's Buttons section shows, drawn
 * with the real `Button`.
 *
 * The sheet's "standard button" (48px tall, 24px of horizontal padding) is the
 * `hub` size here, not `default`: `default` is the dense in-card step the same
 * section also shows ("Card-context buttons at a smaller size"). Both are
 * below, side by side, because that mapping is the one thing about this
 * component that is easy to get wrong.
 */
const meta = {
  title: 'Primitives/Buttons',
  component: Button,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'brand-outline',
        'outline',
        'secondary',
        'ghost',
        'gold',
        'destructive',
        'destructive-soft',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'default', 'lg', 'hub', 'tablet', 'icon', 'icon-sm', 'icon-hub'],
    },
    disabled: { control: 'boolean' },
  },
  args: { children: 'Primary', variant: 'default', size: 'hub' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Buttons — variants">
      <SpecimenGrid>
        <Specimen name="Button/Primary" note="bg #5d5fef, shadow 0 2px 8px rgba(93,95,239,.28)">
          <Button size="hub">Primary</Button>
        </Specimen>
        <Specimen name="Button/Secondary" note="2px indigo border, transparent fill">
          <Button size="hub" variant="brand-outline">
            Secondary
          </Button>
        </Specimen>
        <Specimen name="Button/Ghost">
          <Button size="hub" variant="ghost">
            Ghost
          </Button>
        </Specimen>
        <Specimen name="Button/Destructive">
          <Button size="hub" variant="destructive">
            Destructive
          </Button>
        </Specimen>
        <Specimen name="Button/Disabled">
          <Button size="hub" disabled>
            Disabled
          </Button>
        </Specimen>
        <Specimen name="Button/Gold" note="Not in the sheet — the rewards accent, same shape.">
          <Button size="hub" variant="gold">
            Award stars
          </Button>
        </Specimen>
        <Specimen name="Button/Outline" note="1px #c4c5d9 on white — the sheet's icon-button shell">
          <Button size="hub" variant="outline">
            Deny
          </Button>
        </Specimen>
        <Specimen name="Button/Link">
          <Button variant="link">Bekijk alles</Button>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const Sizes: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Buttons — sizes">
      <SpecimenGrid>
        <Specimen name="xs · sm · default · lg" note="The dense in-card steps.">
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </Specimen>
        <Specimen
          name="hub"
          note="48px — the design system's standard button and the tap-target floor."
        >
          <Button size="hub">Approve</Button>
        </Specimen>
        <Specimen name="tablet" note="64px — primary/high-frequency actions on the wall hub.">
          <Button size="tablet">Klaar</Button>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const WithIcons: Story = {
  name: 'Icons & icon buttons',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Buttons — icons">
      <SpecimenGrid>
        <Specimen name="Icon inline-start" note="`inline` tightens the padding on the icon's side.">
          <Button size="hub">
            <Icon name="add" inline="start" />
            Nieuw event
          </Button>
        </Specimen>
        <Specimen name="Icon inline-end">
          <Button size="hub" variant="brand-outline">
            Volgende
            <Icon name="arrow_forward" inline="end" />
          </Button>
        </Specimen>
        <Specimen name="Button/Icon" note="48×48 circle, 1px #c4c5d9 on white.">
          <Button size="icon-hub" variant="outline" aria-label="Agenda">
            <Icon name="event" />
          </Button>
        </Specimen>
        <Specimen
          name="Button/FAB"
          note="56×56, shadow 0 4px 14px rgba(93,95,239,.35). The app's `Fab` adds the link + portal."
        >
          <Button
            size="icon-hub"
            aria-label="Toevoegen"
            className="size-14 shadow-[0_4px_14px_rgb(93_95_239_/_0.35)]"
          >
            <Icon name="add" size="lg" />
          </Button>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const InCard: Story = {
  name: 'Card-context pair',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Buttons — the approve/deny pair">
      <div className="flex w-[360px] gap-3">
        <Button size="hub" className="flex-1">
          Approve
        </Button>
        <Button size="hub" variant="outline" className="flex-1 border-primary/20 text-brand-ink">
          Deny
        </Button>
      </div>
    </Section>
  ),
};
