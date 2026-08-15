import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../src/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../src/components/dialog';
import { Field, FieldLabel } from '../../src/components/field';
import { Input } from '../../src/components/input';
import { Section, Specimen } from '../specimen';

/**
 * `Dialog` — the centred modal every "add" and "edit" form in the app opens
 * into: a 16px-radius popup on the popover surface, a translucent scrim behind
 * it, and a footer bar on `bg-muted/50` bled to the popup's edges.
 *
 * It arrived here in Wave A. The one thing that had kept it in `apps/web` was
 * a `useTranslations('common')` call for the corner close button's screen
 * reader label — now `closeLabel`, defaulted to English so a story is a
 * one-liner, and injected with `t('close')` by the app's thin wrapper so no
 * product call site has to think about it.
 *
 * The `hub` size is not decoration: the wall display is used with fingers, so
 * the close target grows from 32px to 48px there.
 */
const meta = {
  title: 'Primitives/Dialog',
  component: DialogContent,
  parameters: { layout: 'centered' },
  argTypes: {
    size: { control: 'inline-radio', options: ['default', 'hub'] },
    showCloseButton: { control: 'boolean' },
  },
} satisfies Meta<typeof DialogContent>;

export default meta;
type Story = StoryObj<typeof meta>;

function EventDialog({
  size = 'default',
  showCloseButton = true,
  closeLabel,
}: {
  size?: 'default' | 'hub';
  showCloseButton?: boolean;
  closeLabel?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size={size === 'hub' ? 'hub' : 'default'} />}>
        Afspraak toevoegen
      </DialogTrigger>
      <DialogContent size={size} showCloseButton={showCloseButton} closeLabel={closeLabel}>
        <DialogHeader>
          <DialogTitle>Nieuwe afspraak</DialogTitle>
          <DialogDescription>
            Verschijnt op de hub en in de agenda van iedereen in het gezin.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>Titel</FieldLabel>
          <Input size={size} placeholder="Zwemles Mila" />
        </Field>
        <DialogFooter>
          <Button
            variant="ghost"
            size={size === 'hub' ? 'hub' : 'default'}
            render={<DialogClose />}
          >
            Annuleren
          </Button>
          <Button size={size === 'hub' ? 'hub' : 'default'}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const Playground: Story = {
  args: { size: 'default', showCloseButton: true },
  render: (args) => (
    <EventDialog
      size={args.size}
      showCloseButton={args.showCloseButton}
      closeLabel={args.closeLabel}
    />
  ),
};

export const Sizes: Story = {
  name: 'Default and hub',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="Dialog">
      <Specimen
        name="Dialog/default"
        note="32px close target, top-right. `closeLabel` names it for screen readers."
      >
        <EventDialog closeLabel="Sluiten" />
      </Specimen>
      <Specimen name="Dialog/hub" note="48px close target — the kiosk tap-target floor.">
        <EventDialog size="hub" closeLabel="Sluiten" />
      </Specimen>
      <Specimen
        name="Dialog/no close button"
        note="For a decision that has to be made in the footer rather than dismissed."
      >
        <EventDialog showCloseButton={false} />
      </Specimen>
    </Section>
  ),
};
