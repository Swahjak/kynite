import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { PillTabs, PillTabsPanel, type PillTabItem } from '../../src/components/pill-tabs';
import { Section, Specimen } from '../specimen';

/**
 * `PillTabs` — a row of standalone pills that switch between panels.
 *
 * The design system has *two* tab controls and they are not interchangeable.
 * `Primitives/Navigation` shows the segmented pill: a track with an inner
 * marker, used where a switch sits inside another component's chrome (the
 * calendar header, a section heading). This is the other shape the mockups use
 * — separate white pills with their own border and shadow, sitting directly on
 * the cream page, the active one filled in primary. It reads as page-level
 * navigation rather than as a setting on the thing below it, which is exactly
 * what `/today`'s four views are.
 *
 * It is a composite *over* the primitive, not a re-implementation: Base UI's
 * `Tabs` still owns roving focus, `aria-selected`, arrow-key movement and the
 * panel wiring. Only the skin differs.
 *
 * The list scrolls horizontally rather than wrapping — at 390px four labelled
 * pills do not fit, and a second row of navigation on a phone costs more than
 * a swipe does.
 */
const ITEMS: PillTabItem<string>[] = [
  { value: 'dag', label: 'Dag', icon: 'calendar_month' },
  { value: 'personen', label: 'Personen', icon: 'group' },
  { value: 'routines', label: 'Routines', icon: 'checklist' },
  { value: 'sterren', label: 'Sterren', icon: 'star' },
];

function Demo({ width }: { width: string }) {
  const [value, setValue] = useState('dag');
  return (
    <div className={width}>
      <PillTabs items={ITEMS} value={value} onValueChange={setValue} label="Weergave">
        {ITEMS.map((item) => (
          <PillTabsPanel key={item.value} value={item.value}>
            <div className="rounded-2xl bg-card p-6 shadow-sm">
              <p className="font-display text-h3 font-bold">{item.label}</p>
              <p className="text-body-sm text-ink-secondary">
                Het paneel van deze tab. De pagina laadt ze alle vier op de server; alleen de
                schakelaar is client-werk.
              </p>
            </div>
          </PillTabsPanel>
        ))}
      </PillTabs>
    </div>
  );
}

const meta: Meta = {
  title: 'Components/Pill tabs',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

export const Playground: Story = {
  render: () => <Demo width="w-full max-w-2xl" />,
};

export const Narrow: Story = {
  name: 'Phone width',
  render: () => (
    <Section title="Pill tabs — 390px">
      <Specimen
        name="PillTabs/scroll"
        note="The row scrolls inside itself; the page never scrolls sideways."
      >
        <div className="w-[390px] rounded-2xl bg-background p-4">
          <Demo width="w-full" />
        </div>
      </Specimen>
    </Section>
  ),
};
