import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../src/components/alert-dialog';
import { Button } from '../../src/components/button';
import { Field, FieldLabel } from '../../src/components/field';
import { FieldPicker } from '../../src/components/field-picker';
import { Input } from '../../src/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../src/components/select';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * The three primitives that open something: `Select`, `AlertDialog` and
 * `FieldPicker`.
 *
 * All three take their copy as props — there is no `useTranslations` anywhere
 * below, which is precisely what makes them renderable here at all. The app's
 * `Dialog`, `Sheet` and `Toast` do not appear in Storybook yet for the
 * opposite reason: they still read `next-intl` for their close/confirm labels,
 * so they stayed in `apps/web`. See the phase-3 notes.
 */
const meta = {
  title: 'Primitives/Overlays',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Selects: Story = {
  name: 'Select',
  render: () => (
    <Section title="Select">
      <SpecimenGrid>
        <Specimen name="Select/default" note="The disclosure row: 12px radius, trailing chevron.">
          <Select defaultValue="weekly">
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Niet herhalen</SelectItem>
              <SelectItem value="daily">Elke dag</SelectItem>
              <SelectItem value="weekly">Wekelijks</SelectItem>
              <SelectItem value="monthly">Maandelijks</SelectItem>
            </SelectContent>
          </Select>
        </Specimen>
        <Specimen name="Select/hub" note="48px trigger — the tap-target floor.">
          <Select defaultValue="mila">
            <SelectTrigger size="hub" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mila">Mila</SelectItem>
              <SelectItem value="daan">Daan</SelectItem>
              <SelectItem value="lotte">Lotte</SelectItem>
            </SelectContent>
          </Select>
        </Specimen>
      </SpecimenGrid>
    </Section>
  ),
};

export const Confirm: Story = {
  name: 'AlertDialog',
  render: () => (
    <Section title="AlertDialog">
      <Specimen
        name="AlertDialog/destructive"
        note="Every string is a prop; nothing here is localised by the package."
      >
        <AlertDialog>
          <Button variant="destructive-soft" size="hub" render={<AlertDialogClose />}>
            Routine verwijderen
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Routine verwijderen?</AlertDialogTitle>
              <AlertDialogDescription>
                &quot;Bedtijd&quot; verdwijnt van de hub en uit de weekplanning. Dit kan niet
                ongedaan worden gemaakt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="ghost" size="hub" render={<AlertDialogClose />}>
                Annuleren
              </Button>
              <Button variant="destructive" size="hub" render={<AlertDialogClose />}>
                Verwijderen
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Specimen>
    </Section>
  ),
};

function PickerSpecimen() {
  const [open, setOpen] = useState(false);
  return (
    <Field className="w-64">
      <FieldLabel>Datum</FieldLabel>
      <div className="flex items-center gap-2">
        <Input size="hub" defaultValue="23-10-2026" />
        <FieldPicker
          icon="event"
          label="Kies een datum"
          size="hub"
          open={open}
          onOpenChange={setOpen}
        >
          <div className="w-64 p-4 text-body-sm text-ink-secondary">
            The app drops its `Calendar` in here. The picker itself only owns the trigger, the
            popover and where focus lands when it closes.
          </div>
        </FieldPicker>
      </div>
    </Field>
  );
}

export const Picker: Story = {
  name: 'FieldPicker',
  render: () => (
    <Section title="FieldPicker">
      <Specimen
        name="FieldPicker/hub"
        note="The in-field trigger. Its `label` is the accessible name — a prop, not a translation."
      >
        <PickerSpecimen />
      </Specimen>
    </Section>
  ),
};
