import type { Meta, StoryObj } from '@storybook/react-vite';

import { Fab, FabSlot } from '../../src/components/fab';
import { Section, Specimen } from '../specimen';

/**
 * `Fab` — the floating action button: 56px, indigo, `0 4px 14px
 * rgba(93,95,239,0.35)`, stepping to 64px from `sm`. The glyph rotates 90° on
 * hover, which is the whole of its personality.
 *
 * It comes in two halves that never touch. `FabSlot` is an empty fixed
 * container the **shell** renders, positioned clear of the mobile bottom bar
 * and the safe-area inset; `Fab` is what a **page** renders, anywhere in its
 * own tree, and portals into that slot by id. In the App Router a page cannot
 * render into its layout, and hoisting the FAB into the layout would make the
 * shell import every page's concerns — so a portal is the seam.
 *
 * Which is why both appear in the story below: a `<Fab>` with no `<FabSlot>`
 * mounted renders **nothing**, deliberately (the hub kiosk has no slot, and a
 * FAB escaping onto a wall display is worse than a missing one).
 *
 * Navigating FABs pass their element through `render` — the app hands it
 * `next/link`; the story hands it a plain `<a>`, which is exactly the
 * substitution the package boundary exists to allow.
 */
const meta = {
  title: 'Primitives/FAB',
  component: Fab,
  parameters: { layout: 'padded' },
  argTypes: {
    icon: { control: 'text' },
    label: { control: 'text' },
  },
  args: { icon: 'add', label: 'Afspraak toevoegen' },
} satisfies Meta<typeof Fab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The slot is `position: fixed`, so a story frame is enough of a shell. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-72">
      {children}
      <FabSlot />
    </div>
  );
}

export const Playground: Story = {
  render: (args) => (
    <Shell>
      <Fab {...args} />
    </Shell>
  ),
};

/**
 * Two stories rather than two specimens on one page: `FAB_SLOT_ID` is a single
 * id, so two `<Fab>`s on the same page portal into the same container and land
 * on top of one another — the "exactly one mounted at a time" rule, showing
 * itself.
 */
export const AsButton: Story = {
  name: 'Button',
  render: () => (
    <Shell>
      <Section title="FAB — button">
        <Specimen
          name="FAB/button"
          note="Bottom-right, above the mobile bar. Hover the glyph — it rotates 90°."
        >
          <Fab icon="add" label="Afspraak toevoegen" />
        </Specimen>
      </Section>
    </Shell>
  ),
};

export const AsLink: Story = {
  name: 'Link',
  render: () => (
    <Shell>
      <Section title="FAB — link">
        <Specimen
          name="FAB/link"
          note="`render` takes the element: `next/link` in the app, a plain anchor here."
        >
          <Fab icon="event" label="Routine bewerken" render={<a href="#routines" />} />
        </Specimen>
      </Section>
    </Shell>
  ),
};
