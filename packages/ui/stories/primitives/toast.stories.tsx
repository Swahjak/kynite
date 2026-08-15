import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../src/components/button';
import { createToastManager, Toaster } from '../../src/components/toast';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `Toast` — the quiet confirmation a form owes its user.
 *
 * Every `useActionState` form in the app has the same problem: a successful
 * save returns the state the form started in, so the page does nothing and a
 * parent taps "Opslaan" again. This is what answers instead.
 *
 * The stack is the part worth looking at here rather than in a screenshot: the
 * toasts sit on top of each other with a 12px peek and a per-index scale, and
 * expand into a list on hover or focus. All of that is CSS driven by
 * `--toast-index`, so it only really shows itself with three or four of them
 * queued — which is what the buttons below are for.
 *
 * Each story gets its **own** toast manager. The module-level `toast` export
 * is a singleton, and sharing it would leak toasts from one story into the
 * next as you click through the sidebar.
 */
const meta = {
  title: 'Primitives/Toast',
  component: Toaster,
  parameters: { layout: 'padded' },
  argTypes: {
    size: { control: 'inline-radio', options: ['default', 'hub'] },
  },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

const manager = createToastManager();

const TYPES = ['success', 'info', 'warning', 'error', 'loading'] as const;

const COPY: Record<(typeof TYPES)[number], { title: string; description: string }> = {
  success: { title: 'Opgeslagen', description: 'De routine staat op de hub.' },
  info: { title: 'Agenda gekoppeld', description: 'Nieuwe afspraken verschijnen binnen 15 min.' },
  warning: { title: 'Bijna vol', description: 'Nog 2 van de 20 routines beschikbaar.' },
  error: { title: 'Niet gelukt', description: 'Controleer je verbinding en probeer opnieuw.' },
  loading: { title: 'Synchroniseren…', description: 'Google Agenda wordt opgehaald.' },
};

export const Types: Story = {
  name: 'Toast types',
  args: { size: 'default' },
  render: (args) => (
    <Toaster toastManager={manager} size={args.size} closeLabel={args.closeLabel ?? 'Sluiten'}>
      <Section title="Toast">
        <Specimen
          name="Toast/types"
          note="The icon is the type. Push a few in a row to see the stack peek and expand."
        >
          <SpecimenGrid>
            {TYPES.map((type) => (
              <Button
                key={type}
                variant="outline"
                size="hub"
                onClick={() => manager.add({ ...COPY[type], type })}
              >
                {type}
              </Button>
            ))}
          </SpecimenGrid>
        </Specimen>
        <Specimen name="Toast/with action" note="`ToastAction` renders an outline button inline.">
          <Button
            size="hub"
            onClick={() =>
              manager.add({
                title: 'Routine verwijderd',
                description: '"Bedtijd" staat niet meer op de hub.',
                type: 'success',
                actionProps: { children: 'Ongedaan maken' },
              })
            }
          >
            Verwijderen
          </Button>
        </Specimen>
      </Section>
    </Toaster>
  ),
};
