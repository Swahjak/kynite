import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../../src/components/badge';
import { Button } from '../../src/components/button';
import { IconMedallion } from '../../src/components/icon-medallion';
import { MediaRow } from '../../src/components/media-row';
import { MemberFace } from '../../src/components/member-face';
import { MEMBERS, Section, Specimen } from '../specimen';

/**
 * `MediaRow` — the list row every module drew by hand: a leading visual, a
 * title with optional meta beneath it, and trailing actions.
 *
 * `layout.md` § "Content area" gives the compact shape (a leading marker,
 * stacked title/sub-label text); `components.md` § `Card/Attention` gives the
 * padded, tinted one. Seven near-identical copies existed across routines,
 * rewards, timers and devices, disagreeing about radius (`xl` vs `2xl`),
 * whether there was a border, and whether the row had a minimum height. The
 * three `variant`s below are the *whole* set of answers, and there is no
 * fourth.
 */
const meta = {
  title: 'Components/Media row',
  component: MediaRow,
  parameters: { layout: 'padded' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['plain', 'tinted', 'outlined'] },
  },
  args: {
    title: 'Tanden poetsen',
    meta: '2 minuten · elke ochtend',
    variant: 'outlined',
  },
} satisfies Meta<typeof MediaRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div className="w-full max-w-xl">
      <MediaRow {...args} leading={<IconMedallion icon="brush" />} />
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <Section title="Media row — variants">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <Specimen name="MediaRow/plain" note="No ground of its own — for rows already in a card.">
          <div className="w-full min-w-0">
            <MediaRow
              leading={<IconMedallion icon="schedule" tint="muted" size="md" />}
              title="Werklunch"
              meta="12:30 · Tom"
            />
          </div>
        </Specimen>

        <Specimen name="MediaRow/tinted" note="The `#f5f3ee` tile the docs use for a row-as-card.">
          <div className="w-full min-w-0">
            <MediaRow
              variant="tinted"
              leading={<MemberFace name={MEMBERS[0].name} avatarUrl={MEMBERS[0].src} />}
              title="Mila"
              meta={<Badge variant="soft">3 van 5 stappen</Badge>}
              actions={
                <Button variant="ghost" size="sm">
                  Bekijk
                </Button>
              }
            />
          </div>
        </Specimen>

        <Specimen name="MediaRow/outlined" note="A bordered card row, for lists that are the page.">
          <div className="w-full min-w-0">
            <MediaRow
              variant="outlined"
              leading={<IconMedallion icon="icecream" tint="gold" filled />}
              title="IJsje halen"
              meta="10 sterren · traktatie"
              actions={<Button size="sm">Bewerk</Button>}
            />
          </div>
        </Specimen>
      </div>
    </Section>
  ),
};
