import type { Meta, StoryObj } from '@storybook/react-vite';

import { ConfirmButton } from '../../src/components/confirm-button';
import { Icon } from '../../src/components/icon';
import { Section, Specimen } from '../specimen';

/**
 * `ConfirmButton` — the two-tap confirmation, for destructive actions where a
 * modal would be too much.
 *
 * Weight has to match stake. `AlertDialog` traps focus, dims the page and
 * demands a decision, which is right when the action takes *other* data with
 * it ("214 afspraken verdwijnen"). It is wrong for one row in a list, where
 * the row is already the context and the question fits beside it. This is that
 * second case: tap once and the trigger is *replaced* by the question plus a
 * real `type="submit"`, so the form posts on the browser's own behaviour and
 * progressive enhancement survives.
 *
 * Two details a story shows better than prose: the armed confirm takes focus
 * (the trigger it replaced has just unmounted, so otherwise the focus ring
 * lands on `<body>` and a keyboard user is told nothing happened), and the
 * falling edge of `pending` disarms it — an action that comes back an error
 * must not leave a live one-tap delete under the parent's finger.
 *
 * `cancelLabel` is the only string with a default; the rest name what is being
 * deleted, so only a call site can write them.
 */
const meta = {
  title: 'Primitives/ConfirmButton',
  component: ConfirmButton,
  parameters: { layout: 'centered' },
  argTypes: {
    disabled: { control: 'boolean' },
    pending: { control: 'boolean' },
  },
  args: {
    children: 'Verwijderen',
    question: 'Zeker weten?',
    confirmLabel: 'Ja, verwijderen',
    cancelLabel: 'Annuleren',
    disabled: false,
    pending: false,
  },
} satisfies Meta<typeof ConfirmButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Shapes: Story = {
  name: 'Text and icon triggers',
  parameters: { layout: 'padded' },
  render: () => (
    <Section title="ConfirmButton">
      <Specimen name="ConfirmButton/text" note="Tap once — the trigger becomes the question.">
        <ConfirmButton
          question="Routine verwijderen?"
          confirmLabel="Verwijderen"
          cancelLabel="Annuleren"
        >
          Verwijderen
        </ConfirmButton>
      </Specimen>
      <Specimen
        name="ConfirmButton/icon"
        note="`triggerLabel` is the accessible name when the trigger is a glyph."
      >
        <ConfirmButton
          question="Lid verwijderen?"
          confirmLabel="Verwijderen"
          cancelLabel="Annuleren"
          triggerLabel="Lid verwijderen"
        >
          <Icon name="delete" size="sm" />
        </ConfirmButton>
      </Specimen>
      <Specimen name="ConfirmButton/pending" note="In flight: the confirm is disabled, not gone.">
        <ConfirmButton
          question="Beloning verwijderen?"
          confirmLabel="Verwijderen"
          cancelLabel="Annuleren"
          pending
        >
          Verwijderen
        </ConfirmButton>
      </Specimen>
    </Section>
  ),
};
