import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../src/components/button';
import { EmptyState } from '../../src/components/empty-state';
import { Section, Specimen } from '../specimen';

/**
 * `EmptyState` — the zero-state block: an optional icon medallion, a title, an
 * optional description, an optional action.
 *
 * Three sizes, because the product shows this at three scales and every one of
 * them was hand-rolled before: `inline` inside a card or a list, `page` as a
 * centred block filling a route, and `hub` at kiosk type sizes for the wall
 * display.
 *
 * `framed` draws the dashed outline the calendar's "free day" uses, so a
 * genuinely empty region still reads as a region rather than as a rendering
 * failure. Nothing here is an error treatment: an empty day is a good day.
 */
const meta = {
  title: 'Components/Empty state',
  component: EmptyState,
  parameters: { layout: 'padded' },
  argTypes: {
    size: { control: 'inline-radio', options: ['inline', 'page', 'hub'] },
    framed: { control: 'boolean' },
  },
  args: {
    icon: 'event_available',
    title: 'Niets gepland',
    description: 'Een vrije dag. Voeg iets toe als er toch wat komt.',
    size: 'page',
    framed: false,
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <Section title="Empty state — sizes">
      <div className="flex w-full flex-col gap-8">
        <Specimen name="EmptyState/inline" note="One line of muted copy, inside a card or list.">
          <div className="w-full max-w-md rounded-2xl bg-card p-2 shadow-sm">
            <EmptyState icon="checklist" title="Geen stappen" description="Nog niets te doen." />
          </div>
        </Specimen>

        <Specimen name="EmptyState/page framed" note="The calendar's dashed free-day region.">
          <div className="w-full max-w-lg">
            <EmptyState
              framed
              size="page"
              icon="event_available"
              title="Niets gepland"
              description="Een vrije dag. Voeg iets toe als er toch wat komt."
              action={<Button size="sm">Afspraak toevoegen</Button>}
            />
          </div>
        </Specimen>

        <Specimen name="EmptyState/hub" note="Kiosk type sizes for the wall display.">
          <div className="w-full max-w-2xl rounded-2xl bg-card shadow-sm">
            <EmptyState
              size="hub"
              icon="celebration"
              title="Alles klaar!"
              description="Alle routines van vandaag zijn afgerond."
            />
          </div>
        </Specimen>
      </div>
    </Section>
  ),
};
