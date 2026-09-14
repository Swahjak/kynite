import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { IconPicker } from '../../src/components/icon-picker';
import type { IconName } from '../../src/components/icon-codepoints';
import { Section, Specimen } from '../specimen';

/**
 * `IconPicker` — the grid of 48px icon tiles shared by the routine, step and
 * task editors (M5 of the 2026-09-14 taken-board-routines-page plan). Built
 * on a native `role="radiogroup"` of radio inputs, which is what makes it
 * keyboard navigable (arrow keys move the browser's own radio selection) for
 * free.
 *
 * Structural on purpose: `labelFor` and `tileClassFor` arrive as props rather
 * than being looked up here, so an app can supply translated labels and its
 * own icon → tile-colour mapping without this file importing `next-intl` or
 * any app state.
 */
const ICONS = [
  'task_alt',
  'restaurant',
  'backpack',
  'checkroom',
  'dentistry',
  'crib',
  'pets',
  'celebration',
] as const satisfies readonly IconName[];

const TILE_CLASS: Record<(typeof ICONS)[number], string> = {
  task_alt: 'bg-cat-blue-surface text-cat-blue-fg',
  restaurant: 'bg-cat-orange-surface text-cat-orange-fg',
  backpack: 'bg-cat-blue-surface text-cat-blue-fg',
  checkroom: 'bg-cat-blue-surface text-cat-blue-fg',
  dentistry: 'bg-cat-teal-surface text-cat-teal-fg',
  crib: 'bg-cat-purple-surface text-cat-purple-fg',
  pets: 'bg-cat-pink-surface text-cat-pink-fg',
  celebration: 'bg-cat-orange-surface text-cat-orange-fg',
};

const LABEL: Record<(typeof ICONS)[number], string> = {
  task_alt: 'Checkmark',
  restaurant: 'Food',
  backpack: 'Backpack',
  checkroom: 'Clothes',
  dentistry: 'Teeth',
  crib: 'Crib',
  pets: 'Pet',
  celebration: 'Celebration',
};

function InteractivePicker() {
  const [value, setValue] = useState<IconName>('task_alt');

  return (
    <IconPicker
      icons={ICONS}
      value={value}
      onChange={setValue}
      name="story-icon-picker"
      ariaLabel="Pick an icon"
      labelFor={(icon) => LABEL[icon as (typeof ICONS)[number]] ?? icon}
      tileClassFor={(icon) => TILE_CLASS[icon as (typeof ICONS)[number]] ?? ''}
    />
  );
}

const meta = {
  title: 'Components/Icon picker',
  component: IconPicker,
  parameters: { layout: 'padded' },
  args: {
    icons: ICONS,
    value: 'task_alt',
    onChange: () => {},
    name: 'icon-picker',
    ariaLabel: 'Pick an icon',
    labelFor: (icon) => LABEL[icon as (typeof ICONS)[number]] ?? icon,
    tileClassFor: (icon) => TILE_CLASS[icon as (typeof ICONS)[number]] ?? '',
  },
} satisfies Meta<typeof IconPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <Section title="Icon picker">
      <Specimen
        name="IconPicker/interactive"
        note="Click a tile, or tab in and use the arrow keys — it's a native radiogroup."
      >
        <InteractivePicker />
      </Specimen>
    </Section>
  ),
};
