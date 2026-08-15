import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '../../src/components/badge';
import { Button } from '../../src/components/button';
import { SectionHeading } from '../../src/components/section-heading';
import { Section, Specimen } from '../specimen';

/**
 * `SectionHeading` — the heading row above a block of a page.
 *
 * Two sizes, from `typography.md`: `section` is Baloo 2 700 at 24px
 * (`text-h2`), `card` is the 16–18px card heading (`text-h3`). The `eyebrow` is
 * the `label-caps` specimen — Baloo 2 700, 12px/16px, `0.05em`, uppercase.
 *
 * `level` and `size` are separate props on purpose: an `<h3>` inside a section
 * that already has an `<h2>` may still need to *look* like a section heading,
 * and a document outline is not a type ramp.
 *
 * The design sheet's own "Day band" (Routines § "section header with progress")
 * is this component with a tinted medallion and a count in the action slot —
 * the last specimen below.
 */
const meta = {
  title: 'Components/Section heading',
  component: SectionHeading,
  parameters: { layout: 'padded' },
  argTypes: {
    size: { control: 'inline-radio', options: ['section', 'card'] },
    level: { control: 'inline-radio', options: [2, 3] },
  },
  args: { icon: 'redeem', title: 'Beloningen', size: 'section' },
} satisfies Meta<typeof SectionHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: () => (
    <Section title="Section heading">
      <div className="flex w-full flex-col gap-8">
        <Specimen name="SectionHeading/section" note="`text-h2`, medallion at `md`.">
          <div className="w-full min-w-0">
            <SectionHeading
              icon="redeem"
              iconTint="brand-container"
              iconFilled
              title="Beloningswinkel"
              action={
                <Button variant="ghost" size="sm">
                  Alles
                </Button>
              }
            />
          </div>
        </Specimen>

        <Specimen name="SectionHeading/card" note="`text-h3`, medallion at `sm`.">
          <div className="w-full min-w-0">
            <SectionHeading
              level={3}
              size="card"
              icon="schedule"
              title="Wachtrij"
              description="Twee aanvragen wachten op een antwoord."
            />
          </div>
        </Specimen>

        <Specimen
          name="SectionHeading/day band"
          note="Routines § day band: eyebrow, tinted medallion, progress in the action slot."
        >
          <div className="w-full min-w-0">
            <SectionHeading
              icon="wb_twilight"
              iconTint="gold"
              iconFilled
              eyebrow="Vandaag"
              title="Ochtend"
              action={
                <Badge variant="soft" size="md">
                  3 van 7 klaar
                </Badge>
              }
            />
          </div>
        </Specimen>
      </div>
    </Section>
  ),
};
