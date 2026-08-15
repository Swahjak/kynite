import type { Meta, StoryObj } from '@storybook/react-vite';

import { GripHandle } from '../../src/components/grip-handle';
import { Icon } from '../../src/components/icon';
import { Section, Specimen } from '../specimen';

/**
 * `GripHandle` — the drag affordance on a reorderable row (`Routines.dc.html`
 * § "Stappen — sleep om te herordenen").
 *
 * Six dots in CSS rather than Material's `drag_indicator` glyph — the icon
 * font is a hard-capped 64 KB subset, and a grip is a shape rather than a
 * symbol. `aria-hidden` by default: it is a visual affordance on a row that
 * carries its own accessible reordering controls elsewhere.
 */
const meta = {
  title: 'Primitives/Grip handle',
  component: GripHandle,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof GripHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const OnAStepRow: Story = {
  name: 'On a reorderable step row',
  render: () => (
    <Section title="Grip handle — the step builder's drag affordance">
      <Specimen
        name="GripHandle/step row"
        note="Leads the row; the icon and title follow, `more_vert` trails."
      >
        <div className="flex w-full max-w-sm min-w-0 items-center gap-2.5 rounded-xl border border-line-subtle bg-card px-3 py-2.5">
          <GripHandle />
          <Icon name="checkroom" size="sm" className="shrink-0 text-ink" />
          <span className="min-w-0 flex-1 truncate text-body-sm font-semibold">Was opruimen</span>
          <Icon name="more_horiz" size="sm" className="shrink-0 text-ink-muted" />
        </div>
      </Specimen>
    </Section>
  ),
};
