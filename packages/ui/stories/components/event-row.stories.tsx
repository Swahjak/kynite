import type { Meta, StoryObj } from '@storybook/react-vite';

import { Card } from '../../src/components/card';
import { EventRow } from '../../src/components/event-row';
import type { StackedFace } from '../../src/components/face-stack';
import { MEMBERS, Section, Specimen } from '../specimen';

/**
 * `EventRow` — one event as a line in a list, in the anatomy the August sheet
 * settled on: category rail → time gutter → category glyph → title → faces →
 * at most one status token.
 *
 * The two things worth staring at here are what the row *stopped* doing. It no
 * longer names people in a second line ("Mila & Daan" under every title cost a
 * nine-event day its scroll), and it no longer draws the category as a dot —
 * eleven event types share eight hues, so colour alone cannot separate school
 * from opvang. The glyph is the half that can, and a 4px rail carries a hue
 * better than an 8px dot did.
 *
 * The row draws its own `border-t` hairline and suppresses it on the first
 * child, which is what lets a stack of rows read as one object rather than as
 * N floating tiles. `Stacked in a card` below is the specimen for that.
 *
 * Colour and formatting both arrive as strings: `railClass`/`iconClass` come
 * from the app's `CATEGORY_CLASSES`, and `startTime`/`endTime` are already
 * formatted in the household's timezone. The package does no date work.
 */

const FACES: readonly StackedFace[] = MEMBERS.slice(0, 2).map((member, index) => ({
  id: String(index),
  name: member.name,
  avatarUrl: member.src,
}));

const meta = {
  title: 'Components/Event row',
  component: EventRow,
  parameters: { layout: 'padded' },
  argTypes: {
    size: { control: 'inline-radio', options: ['compact', 'default', 'roomy'] },
    state: { control: 'inline-radio', options: ['default', 'now', 'past'] },
    busy: { control: 'boolean' },
  },
  args: {
    size: 'default',
    state: 'default',
    startTime: '08:30',
    endTime: '09:15',
    title: 'Zwemles',
    iconName: 'pool',
    railClass: 'bg-cat-blue-solid',
    iconClass: 'text-cat-blue-icon',
    faces: { faces: FACES, label: 'Mila en Daan' },
  },
  render: (args) => (
    <Card className="w-full max-w-xl px-2">
      <EventRow {...args} />
    </Card>
  ),
} satisfies Meta<typeof EventRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/**
 * 40 / 48 / 56px, with the gutter at 44 / 52 / 56px. The gutter is wider than
 * the times need at every step because `08:00` and `12:00 PM` have to sit on
 * the same left edge down a whole list.
 */
export const Sizes: Story = {
  render: () => (
    <Section title="Event row — the three sizes">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <Specimen
          name="EventRow/compact"
          note="40px — the phone's list, where nine rows have to fit."
        >
          <Card className="w-full px-2">
            <EventRow
              size="compact"
              startTime="08:30"
              endTime="09:15"
              title="Zwemles"
              iconName="pool"
              railClass="bg-cat-blue-solid"
              iconClass="text-cat-blue-icon"
              faces={{ faces: FACES, label: 'Mila en Daan' }}
            />
          </Card>
        </Specimen>

        <Specimen
          name="EventRow/default"
          note="48px — the hub's list and the default everywhere else."
        >
          <Card className="w-full px-2">
            <EventRow
              startTime="08:30"
              endTime="09:15"
              title="Zwemles"
              iconName="pool"
              railClass="bg-cat-blue-solid"
              iconClass="text-cat-blue-icon"
              faces={{ faces: FACES, label: 'Mila en Daan' }}
            />
          </Card>
        </Specimen>

        <Specimen name="EventRow/roomy" note="56px — a wall display read from across the kitchen.">
          <Card className="w-full px-2">
            <EventRow
              size="roomy"
              startTime="08:30"
              endTime="09:15"
              title="Zwemles"
              subtitle="Sportcentrum De Vliet"
              iconName="pool"
              railClass="bg-cat-blue-solid"
              iconClass="text-cat-blue-icon"
              faces={{ faces: FACES, label: 'Mila en Daan' }}
            />
          </Card>
        </Specimen>
      </div>
    </Section>
  ),
};

/**
 * `now` is the only row a glance is meant to land on, so it is the only one
 * that gains a ground, a colour and a token. `past` dims and strikes rather
 * than hides — nothing is dropped from a day. `busy` is a private calendar
 * rendered free/busy: neutral rail, muted ink, a lock instead of a category,
 * which is exactly as much as the viewer is allowed to know.
 */
export const States: Story = {
  render: () => (
    <Section title="Event row — the four states">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <Specimen name="EventRow/default">
          <Card className="w-full px-2">
            <EventRow
              startTime="14:00"
              endTime="15:00"
              title="Tandarts"
              iconName="medical_services"
              railClass="bg-cat-red-solid"
              iconClass="text-cat-red-icon"
            />
          </Card>
        </Specimen>

        <Specimen name="EventRow/now" note="Tinted, rounded, brand times, bold title, one pill.">
          <Card className="w-full px-2">
            <EventRow
              state="now"
              statusLabel="NU"
              startTime="12:30"
              endTime="13:15"
              title="Lunch met opa"
              iconName="restaurant"
              railClass="bg-cat-orange-solid"
              iconClass="text-cat-orange-icon"
              faces={{ faces: FACES, label: 'Mila en Daan' }}
            />
          </Card>
        </Specimen>

        <Specimen name="EventRow/past" note="Dimmed and struck through — over, not gone.">
          <Card className="w-full px-2">
            <EventRow
              state="past"
              startTime="07:45"
              endTime="08:15"
              title="Naar school brengen"
              iconName="school"
              railClass="bg-cat-blue-solid"
              iconClass="text-cat-blue-icon"
            />
          </Card>
        </Specimen>

        <Specimen
          name="EventRow/busy"
          note="A free/busy calendar: neutral rail, muted ink, a lock for a category it may not name."
        >
          <Card className="w-full px-2">
            <EventRow
              busy
              startTime="10:00"
              endTime="11:30"
              title="Bezet"
              iconName="lock"
              railClass="bg-cat-purple-solid"
              iconClass="text-cat-purple-icon"
            />
          </Card>
        </Specimen>
      </div>
    </Section>
  ),
};

/**
 * The reason the row owns its hairline. Nine rows in one card read as one
 * object; nine bordered tiles read as nine. `first:border-t-0` keeps the top
 * of the list clean, and the `now` row's tinted ground sits inside the same
 * rhythm rather than breaking it.
 */
export const StackedInACard: Story = {
  name: 'Stacked in a card',
  render: () => (
    <Section title="Event row — a day in one card">
      <div className="flex w-full max-w-xl flex-col gap-6">
        <Specimen name="EventRow/list" note="Hairlines between rows, none above the first.">
          <Card className="w-full px-2">
            <EventRow
              state="past"
              startTime="07:45"
              endTime="08:15"
              title="Naar school brengen"
              iconName="school"
              railClass="bg-cat-blue-solid"
              iconClass="text-cat-blue-icon"
              faces={{ faces: FACES, label: 'Mila en Daan' }}
            />
            <EventRow startTime="10:00" endTime="11:30" title="Bezet" busy iconName="lock" />
            <EventRow
              state="now"
              statusLabel="NU"
              startTime="12:30"
              endTime="13:15"
              title="Lunch met opa"
              iconName="restaurant"
              railClass="bg-cat-orange-solid"
              iconClass="text-cat-orange-icon"
              faces={{ faces: FACES, label: 'Mila en Daan' }}
            />
            <EventRow
              startTime="14:00"
              endTime="15:00"
              title="Tandarts"
              subtitle="Praktijk Molenstraat 4"
              iconName="medical_services"
              railClass="bg-cat-red-solid"
              iconClass="text-cat-red-icon"
              faces={{ faces: FACES.slice(0, 1), label: 'Mila' }}
            />
            <EventRow
              startTime="Hele dag"
              title="Verjaardag Lotte"
              iconName="cake"
              railClass="bg-cat-pink-solid"
              iconClass="text-cat-pink-icon"
              faces={{ faces: FACES, label: 'Mila en Daan' }}
            />
          </Card>
        </Specimen>

        <Specimen name="EventRow/list — compact" note="The same day at 390px.">
          <Card className="w-full max-w-90 px-2">
            <EventRow
              size="compact"
              state="past"
              startTime="07:45"
              endTime="08:15"
              title="Naar school brengen"
              iconName="school"
              railClass="bg-cat-blue-solid"
              iconClass="text-cat-blue-icon"
            />
            <EventRow
              size="compact"
              state="now"
              statusLabel="NU"
              startTime="12:30"
              endTime="13:15"
              title="Lunch met opa"
              iconName="restaurant"
              railClass="bg-cat-orange-solid"
              iconClass="text-cat-orange-icon"
              faces={{ faces: FACES, label: 'Mila en Daan' }}
            />
            <EventRow
              size="compact"
              startTime="Hele dag"
              title="Verjaardag Lotte"
              iconName="cake"
              railClass="bg-cat-pink-solid"
              iconClass="text-cat-pink-icon"
            />
          </Card>
        </Specimen>
      </div>
    </Section>
  ),
};
