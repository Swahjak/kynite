import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../src/components/button';
import { PageHeader } from '../../src/components/page-header';
import { Section, Specimen } from '../specimen';

/**
 * `PageHeader` — the header at the top of a route: an icon tile, the page
 * title, an optional subtitle, and right-aligned actions.
 *
 * Two surfaces, and the difference is not decoration. `app` is the phone/tablet
 * route header: a squircle icon tile beside a `headline-lg` title (Baloo 2 700,
 * 32px/40px, `-0.02em`). `hub` is the wall display's: no icon tile at all, the
 * title at Display M, and the right-hand slot carrying the clock. A kiosk read
 * from two metres does not need a 56px glyph telling it which page it is on —
 * it needs the words bigger.
 *
 * The title is always an `<h1>`. The *level* is fixed and only the size moves,
 * because a route has exactly one first heading whichever screen it is on.
 */
const meta = {
  title: 'Components/Page header',
  component: PageHeader,
  parameters: { layout: 'padded' },
  argTypes: {
    surface: { control: 'inline-radio', options: ['app', 'hub'] },
    icon: { control: 'text' },
  },
  args: {
    icon: 'checklist',
    title: 'Routines',
    subtitle: 'Ochtend, middag en avond — per kind.',
    surface: 'app',
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Surfaces: Story = {
  render: () => (
    <Section title="Page header — surfaces">
      <div className="flex flex-col gap-10">
        <Specimen name="PageHeader/app" note="Squircle icon tile, `text-h1`, actions on the right.">
          <div className="w-full min-w-0">
            <PageHeader
              icon="workspace_premium"
              iconTint="brand-container"
              iconFilled
              title="Beloningen"
              subtitle="24 sterren te besteden"
              action={<Button size="sm">Ster toekennen</Button>}
            />
          </div>
        </Specimen>

        <Specimen
          name="PageHeader/hub"
          note="No tile, Display M title. The action slot is where the wall clock goes."
        >
          <div className="w-full min-w-0">
            <PageHeader
              surface="hub"
              title="Goedemorgen"
              subtitle="Woensdag 21 oktober"
              action={<span className="tabular-time font-display text-display-md">07:24</span>}
            />
          </div>
        </Specimen>
      </div>
    </Section>
  ),
};
