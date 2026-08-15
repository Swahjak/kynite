import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../src/components/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../src/components/sheet';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `Sheet` — the same modal machinery as `Dialog` (Base UI's dialog, the same
 * scrim, the same focus trap) hung off an edge instead of centred.
 *
 * Which edge is the whole design decision. The app uses `bottom` on a phone,
 * where a panel rising from the thumb is reachable and a centred dialog is
 * not, and `right` on a tablet or the hub, where it reads as a drawer beside
 * the content rather than on top of it. All four sides are here because the
 * transform for each is a separate line of the class list and a story is the
 * only place they can be checked against one another.
 *
 * Its `closeLabel` works exactly as `Dialog`'s — see that story.
 */
const meta = {
  title: 'Primitives/Sheet',
  component: SheetContent,
  parameters: { layout: 'centered' },
  argTypes: {
    side: { control: 'inline-radio', options: ['top', 'right', 'bottom', 'left'] },
    size: { control: 'inline-radio', options: ['default', 'hub'] },
    showCloseButton: { control: 'boolean' },
  },
} satisfies Meta<typeof SheetContent>;

export default meta;
type Story = StoryObj<typeof meta>;

function MenuSheet({
  side = 'right',
  size = 'default',
  showCloseButton = true,
  closeLabel = 'Sluiten',
}: {
  side?: 'top' | 'right' | 'bottom' | 'left';
  size?: 'default' | 'hub';
  showCloseButton?: boolean;
  closeLabel?: string;
}) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size={size === 'hub' ? 'hub' : 'default'} />}>
        Meer ({side})
      </SheetTrigger>
      <SheetContent
        side={side}
        size={size}
        showCloseButton={showCloseButton}
        closeLabel={closeLabel}
      >
        <SheetHeader>
          <SheetTitle>Instellingen</SheetTitle>
          <SheetDescription>Alles wat niet in de balk paste.</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <Button variant="ghost" size={size === 'hub' ? 'hub' : 'default'} render={<SheetClose />}>
            Sluiten
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export const Playground: Story = {
  args: { side: 'right', size: 'default', showCloseButton: true },
  render: (args) => (
    <MenuSheet
      side={args.side}
      size={args.size}
      showCloseButton={args.showCloseButton}
      closeLabel={args.closeLabel}
    />
  ),
};

export const Sides: Story = {
  name: 'Four edges',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Sheet">
      <SpecimenGrid>
        <Specimen name="Sheet/bottom" note="The phone default — rises into thumb reach.">
          <MenuSheet side="bottom" />
        </Specimen>
        <Specimen name="Sheet/right" note="The tablet and hub default — a drawer beside content.">
          <MenuSheet side="right" size="hub" />
        </Specimen>
        <Specimen name="Sheet/left">
          <MenuSheet side="left" />
        </Specimen>
        <Specimen name="Sheet/top">
          <MenuSheet side="top" />
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};
