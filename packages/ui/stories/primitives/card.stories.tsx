import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar, AvatarFallback, AvatarImage } from '../../src/components/avatar';
import { Badge } from '../../src/components/badge';
import { Button } from '../../src/components/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../src/components/card';
import { Icon } from '../../src/components/icon';
import { MEMBERS, Section, Specimen } from '../specimen';

/**
 * `Cards` — the five variants, and then the four specimens from the design
 * sheet rebuilt out of them (attention, stat, toast, task row).
 *
 * Every card is 24px-radius with the same resting elevation; what changes
 * between variants is the *ground*, never the shape.
 */
const meta = {
  title: 'Primitives/Cards',
  component: Card,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['default', 'muted', 'hero', 'inverse', 'outlined'],
    },
    size: { control: 'inline-radio', options: ['default', 'sm'] },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Cards — variants">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(['default', 'muted', 'hero', 'inverse', 'outlined'] as const).map((variant) => (
          <Card key={variant} variant={variant} className="w-72 px-5">
            <CardHeader>
              <CardTitle>{variant}</CardTitle>
              <CardDescription>
                Reserved for high-contrast highlights and celebration moments.
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </Section>
  ),
};

export const Attention: Story = {
  name: 'Card/Attention',
  parameters: { layout: 'padded' },
  render: () => (
    <Specimen
      name="Card/Attention"
      note="The approval request: avatar, ask, and a two-button footer."
    >
      <Card variant="muted" className="relative w-88 px-5">
        <span
          className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-primary/6 blur-xl"
          aria-hidden
        />
        <CardHeader className="flex-row items-center gap-3">
          <Avatar size="lg" style={{ background: `oklch(94% 0.03 ${MEMBERS[0].hue})` }}>
            <AvatarImage src={MEMBERS[0].src} alt={MEMBERS[0].name} />
            <AvatarFallback>MI</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <CardTitle className="font-body text-body font-medium">
              Mila asked for a reward
            </CardTitle>
            <CardDescription>
              Movie night pick — <strong className="text-gold-ink">12 stars</strong>
            </CardDescription>
          </div>
        </CardHeader>
        <CardFooter className="gap-3 pb-5">
          <Button size="hub" className="flex-1">
            Approve
          </Button>
          <Button size="hub" variant="outline" className="flex-1 border-primary/20 text-brand-ink">
            Deny
          </Button>
        </CardFooter>
      </Card>
    </Specimen>
  ),
};

export const Stat: Story = {
  name: 'Card/Stat',
  parameters: { layout: 'padded' },
  render: () => (
    <Specimen name="Card/Stat" note="Member progress: header row, divider, 8px progress track.">
      <Card className="w-88 px-4.5">
        <CardHeader className="flex-row items-center gap-3">
          <Avatar size="hub" style={{ background: `oklch(94% 0.03 ${MEMBERS[0].hue})` }}>
            <AvatarImage src={MEMBERS[0].src} alt={MEMBERS[0].name} />
            <AvatarFallback>MI</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <CardTitle className="font-body text-body font-medium">Mila</CardTitle>
            <CardDescription>3 of 4 tasks done</CardDescription>
          </div>
          <CardAction>
            <Badge variant="gold" size="md">
              <Icon name="star" filled size="sm" inline="start" />
              12
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="border-t border-line-subtle pt-4">
          <div className="h-2 w-full overflow-hidden rounded-4xl bg-line-subtle">
            <div className="h-full w-3/4 rounded-4xl bg-success" />
          </div>
        </CardContent>
      </Card>
    </Specimen>
  ),
};

export const Toast: Story = {
  name: 'Card/Toast',
  parameters: { layout: 'padded', backgrounds: { value: 'cream' } },
  render: () => (
    <Specimen
      name="Card/Toast"
      note="The dark card. The app's real Toast adds the dismiss button — its `close` glyph is not in the icon subset, so it is absent here."
    >
      <Card variant="inverse" className="w-88 px-4">
        <CardContent className="flex flex-row items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/25">
            <Icon name="check" size="sm" className="text-[#b8c3ff]" />
          </span>
          <p className="flex-1 text-body-sm">Bedtime routine updated on the family hub</p>
        </CardContent>
      </Card>
    </Specimen>
  ),
};

export const TaskRow: Story = {
  name: 'Card/Task row',
  parameters: { layout: 'padded' },
  render: () => (
    <Specimen name="Card/Task row">
      <Card className="w-88 px-5">
        <CardContent className="flex flex-row items-center justify-between gap-3">
          <span className="flex items-center gap-3 text-body-sm">
            <Icon name="radio_button_unchecked" size="sm" className="text-line" />
            Boodschappen bestellen
          </span>
          <Avatar size="xs" style={{ background: `oklch(94% 0.03 ${MEMBERS[2].hue})` }}>
            <AvatarImage src={MEMBERS[2].src} alt={MEMBERS[2].name} />
            <AvatarFallback>LO</AvatarFallback>
          </Avatar>
        </CardContent>
      </Card>
    </Specimen>
  ),
};
