import type { Meta, StoryObj } from '@storybook/react-vite';

import { FabSlot, FabSpeedDial } from '../../src/components/fab';
import { Section, Specimen } from '../specimen';

/**
 * `FabSpeedDial` — the FAB that expands into two or three labelled actions.
 *
 * Same corner, same slot and the same 56 → 64px indigo circle as `Fab`, so a
 * surface can swap one for the other without anything moving. Tapping the FAB
 * rotates its `add` glyph 45° — the close it turns into is the same glyph —
 * and unfolds the actions upward, staggered 40ms apart.
 *
 * The whole row is the control, chip included: 48px of circle clears the touch
 * minimum for a thumb, but the wall hub is aimed at from across a room with an
 * arm, so the target is the ~200px row. It also makes the accessible name the
 * visible text instead of an `aria-label` nobody can check.
 *
 * Closing is whatever the user reaches for: the FAB again, a tap outside, or
 * Escape — and focus goes back to the trigger in each case, because what the
 * user was pointing at has just gone. Actions are `inert` while closed, so
 * they stay out of the tab order and the accessibility tree rather than
 * lurking invisibly in it.
 *
 * Navigating actions pass `render` exactly as `Fab` does: the app hands it
 * `next/link`, the story a plain `<a>`.
 */
const meta = {
  title: 'Primitives/FAB Speed Dial',
  component: FabSpeedDial,
  parameters: { layout: 'padded' },
  args: {
    label: 'Toevoegen',
    closeLabel: 'Sluiten',
    actions: [
      { id: 'event', icon: 'event', label: 'Afspraak toevoegen' },
      { id: 'timer', icon: 'timer', label: 'Timer starten', render: <a href="#timers" /> },
      { id: 'star', icon: 'star', label: 'Ster geven' },
    ],
  },
} satisfies Meta<typeof FabSpeedDial>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The slot is `position: fixed`, so a story frame is enough of a shell. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-96">
      {children}
      <FabSlot />
    </div>
  );
}

export const Playground: Story = {
  render: (args) => (
    <Shell>
      <FabSpeedDial {...args} />
    </Shell>
  ),
};

/**
 * Rest. One FAB, indistinguishable from the plain one — which is the point:
 * nothing about the corner announces that there are three actions behind it
 * until it is tapped.
 */
export const Closed: Story = {
  render: (args) => (
    <Shell>
      <Section title="Speed dial — gesloten">
        <Specimen
          name="FAB/speed-dial · closed"
          note="Tik de FAB om te openen. De glyph draait 45° en wordt het kruis."
        >
          <FabSpeedDial {...args} />
        </Specimen>
      </Section>
    </Shell>
  ),
};

/**
 * `defaultOpen` rather than `open`: the dial is uncontrolled here, so the
 * specimen opens unfolded and still closes on Escape or an outside tap.
 */
export const Open: Story = {
  render: (args) => (
    <Shell>
      <Section title="Speed dial — open">
        <Specimen
          name="FAB/speed-dial · open"
          note="Drie acties, van onderaf gestapeld. De hele rij — chip én cirkel — is de knop; de middelste is een link."
        >
          <FabSpeedDial {...args} defaultOpen />
        </Specimen>
      </Section>
    </Shell>
  ),
};

/** Two actions is the other size the app uses; nothing about the layout changes. */
export const TwoActions: Story = {
  args: {
    actions: [
      { id: 'event', icon: 'event', label: 'Afspraak toevoegen' },
      { id: 'timer', icon: 'timer', label: 'Timer starten' },
    ],
  },
  render: (args) => (
    <Shell>
      <Section title="Speed dial — twee acties">
        <Specimen name="FAB/speed-dial · 2 acties">
          <FabSpeedDial {...args} defaultOpen />
        </Specimen>
      </Section>
    </Shell>
  ),
};
