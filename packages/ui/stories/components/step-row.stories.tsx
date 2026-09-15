import type { Meta, StoryObj } from '@storybook/react-vite';

import { StepRow } from '../../src/components/step-row';
import { Section, Specimen } from '../specimen';

/** Raspberry's own tokens (U1) — see `MEMBER_COLOR_CLASSES.raspberry`. */
const raspberryClasses = {
  tile: 'bg-member-raspberry-tegel',
  tileSoft: 'bg-member-raspberry-tegel-zacht',
  tileDone: 'bg-member-raspberry-tegel-klaar',
  icon: 'text-member-raspberry-inkt-tegel',
  iconDone: 'text-member-raspberry-inkt-klaar',
  circleDone: 'bg-member-raspberry-lijn',
  rowDone: 'bg-member-raspberry-rij-klaar',
  checkDone: 'text-member-raspberry-lijn',
};

/**
 * `StepRow` — one routine step, and the single control a child uses.
 *
 * Everything about it is one decision repeated:
 *
 * - **One tap, no confirmation, no spinner.** The whole row is the button.
 *   There is no dialog to dismiss and no pending state, because the board flips
 *   it optimistically before the request leaves the device.
 * - **Praise is the headline, the star is secondary.** The praise line is
 *   rendered *first in the DOM* and at heading scale; the star follows it at
 *   caption scale. A DOM-order test and a visual snapshot pin that order.
 * - **Nothing marks anything.** A step that is not done carries an empty
 *   outline, never a cross.
 *
 * The `active` row is the step the routine is *on* — 72px instead of 56px, a
 * left accent bar and a forward arrow, so a glance from across the room lands
 * on "this one next" without reading a word. The arrow is direction, not a
 * verdict: it says nothing about the rows behind it.
 *
 * A step paying `stars={0}` (a graduated routine) renders no star at all. The
 * correct UI for "this no longer pays" is absence — never a struck-through or
 * greyed star, which reads as something taken away.
 *
 * `variant="tile"` is the other shape: the design sheets' two-column grid
 * cell inside an expanded `RoutineCard` (`Routines.dc.html`) — a bordered
 * 80px tile that turns green and strikes its own title through once done.
 * Praise-before-star still holds; it just carries both at caption scale under
 * the title, the smallest place they can honestly go.
 */
const meta = {
  title: 'Components/Step row',
  component: StepRow,
  parameters: { layout: 'padded' },
  argTypes: { done: { control: 'boolean' }, active: { control: 'boolean' } },
  args: {
    stepId: 'brush',
    title: 'Tanden poetsen',
    done: false,
    timerSeconds: 120,
    praiseText: 'Goed bezig!',
    stars: 3,
    starLabel: '3 sterren verdiend',
    actionLabel: 'Markeer Tanden poetsen als klaar',
    active: true,
    icon: 'dentistry',
    iconTintClass: 'bg-cat-teal-surface text-cat-teal-fg',
  },
  render: (args) => (
    <ul className="flex w-full max-w-xl flex-col gap-3">
      <StepRow {...args} />
    </ul>
  ),
} satisfies Meta<typeof StepRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
  render: () => (
    <Section title="Step row — the four rows on a board">
      <ul className="flex w-full max-w-xl flex-col gap-3">
        <StepRow
          stepId="dress"
          title="Aankleden"
          done
          timerSeconds={null}
          praiseText="Knap gedaan!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Aankleden is klaar"
          icon="checkroom"
          iconTintClass="bg-cat-teal-surface text-cat-teal-fg"
        />
        <StepRow
          stepId="brush"
          title="Tanden poetsen"
          done={false}
          active
          timerSeconds={120}
          praiseText="Goed bezig!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Markeer Tanden poetsen als klaar"
          icon="dentistry"
          iconTintClass="bg-cat-teal-surface text-cat-teal-fg"
        />
        <StepRow
          stepId="bed"
          title="Bed opmaken"
          done={false}
          timerSeconds={null}
          praiseText="Top!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Markeer Bed opmaken als klaar"
          icon="crib"
          iconTintClass="bg-cat-teal-surface text-cat-teal-fg"
        />
        <StepRow
          stepId="pack"
          title="Tas inpakken"
          done
          timerSeconds={null}
          praiseText="Helemaal zelf!"
          stars={0}
          starLabel=""
          actionLabel="Tas inpakken is klaar"
          icon="backpack"
          iconTintClass="bg-cat-teal-surface text-cat-teal-fg"
        />
      </ul>
      <Specimen
        name="StepRow/notes"
        note="Row 1 done · row 2 live (72px, accent bar, arrow) · row 3 ahead · row 4 done on a graduated routine — no star, by design."
      >
        <span />
      </Specimen>
    </Section>
  ),
};

export const Tiles: Story = {
  name: 'Tile variant — the expanded card grid',
  render: () => (
    <Section title="Step row — the tile shape, inside RoutineCard's expanded grid">
      <ul className="grid w-full max-w-xl grid-cols-2 gap-3">
        <StepRow
          variant="tile"
          stepId="uit-bed"
          title="Uit bed"
          done
          timerSeconds={null}
          praiseText="Goed bezig!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Uit bed is klaar"
          icon="bedtime"
          iconTintClass="bg-cat-teal-surface text-cat-teal-fg"
        />
        <StepRow
          variant="tile"
          stepId="tanden"
          title="Tanden poetsen"
          done={false}
          active
          timerSeconds={120}
          praiseText="Knap gedaan!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Markeer Tanden poetsen als klaar"
          icon="dentistry"
          iconTintClass="bg-cat-teal-surface text-cat-teal-fg"
        />
        <StepRow
          variant="tile"
          stepId="tas"
          title="Tas inpakken"
          done={false}
          timerSeconds={null}
          praiseText="Top!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Markeer Tas inpakken als klaar"
          icon="backpack"
          iconTintClass="bg-cat-teal-surface text-cat-teal-fg"
        />
        <StepRow
          variant="tile"
          stepId="ontbijt"
          title="Ontbijt opeten"
          done
          timerSeconds={null}
          praiseText="Helemaal zelf!"
          stars={0}
          starLabel=""
          actionLabel="Ontbijt opeten is klaar"
          icon="restaurant"
          iconTintClass="bg-cat-teal-surface text-cat-teal-fg"
        />
      </ul>
      <Specimen
        name="StepRow/tile notes"
        note="Tile 1 done (green, struck) · tile 2 live (border, empty ring, timer) · tile 3 ahead · tile 4 done on a graduated routine — no star."
      >
        <span />
      </Specimen>
    </Section>
  ),
};

export const MemberColour: Story = {
  name: 'Member colour (raspberry)',
  render: () => (
    <Section title="Step row — member colour via `memberClasses`">
      <ul className="flex w-full max-w-xl flex-col gap-3">
        <StepRow
          stepId="dress"
          title="Aankleden"
          done
          timerSeconds={null}
          praiseText="Knap gedaan!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Aankleden is klaar"
          icon="checkroom"
          memberClasses={raspberryClasses}
        />
        <StepRow
          stepId="brush"
          title="Tanden poetsen"
          done={false}
          timerSeconds={120}
          praiseText="Goed bezig!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Markeer Tanden poetsen als klaar"
          icon="dentistry"
          memberClasses={raspberryClasses}
        />
      </ul>
      <Specimen
        name="StepRow/member notes"
        note="Same rows, tinted by `memberClasses` instead of a category surface — the 46px circle and the icon tile both carry raspberry's own steps once done."
      >
        <span />
      </Specimen>

      <ul className="grid w-full max-w-xl grid-cols-2 gap-3">
        <StepRow
          variant="tile"
          stepId="uit-bed"
          title="Uit bed"
          done
          timerSeconds={null}
          praiseText="Goed bezig!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Uit bed is klaar"
          icon="bedtime"
          memberClasses={raspberryClasses}
        />
        <StepRow
          variant="tile"
          stepId="tanden"
          title="Tanden poetsen"
          done={false}
          active
          timerSeconds={120}
          praiseText="Knap gedaan!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Markeer Tanden poetsen als klaar"
          icon="dentistry"
          memberClasses={raspberryClasses}
        />
      </ul>
      <Specimen
        name="StepRow/member tile notes"
        note="Tile 1 done — `tileDone`/`iconDone` (tegel-klaar/inkt-klaar), a `#8a8c98` struck title, and the check in raspberry's own `lijn` (`checkDone`) rather than green. Tile 2 still to do — `tileSoft` (tegel-zacht), the softer step than the flat row's `tile` above."
      >
        <span />
      </Specimen>
    </Section>
  ),
};

export const DenseTiles: Story = {
  name: 'Tile variant — dense (family board)',
  render: () => (
    <Section title="Step row — dense tile, the family-wide `/hub/routines` column">
      <ul className="grid w-full max-w-xs grid-cols-1 gap-2">
        <StepRow
          variant="tile"
          dense
          stepId="uit-bed"
          title="Uit bed"
          done
          timerSeconds={null}
          praiseText="Goed bezig!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Uit bed is klaar"
          icon="bedtime"
          iconTintClass="bg-cat-teal-surface text-cat-teal-fg"
        />
        <StepRow
          variant="tile"
          dense
          stepId="tanden"
          title="Tanden poetsen"
          done={false}
          active
          timerSeconds={120}
          praiseText="Knap gedaan!"
          stars={3}
          starLabel="3 sterren verdiend"
          actionLabel="Markeer Tanden poetsen als klaar"
          icon="dentistry"
          iconTintClass="bg-cat-teal-surface text-cat-teal-fg"
        />
      </ul>
      <Specimen
        name="StepRow/dense tile notes"
        note="64px minimum height (`min-h-16`) instead of 80px — the one-column width a routine card gets on the family board."
      >
        <span />
      </Specimen>
    </Section>
  ),
};
