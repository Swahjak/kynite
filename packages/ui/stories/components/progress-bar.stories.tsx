import type { Meta, StoryObj } from '@storybook/react-vite';

import { ProgressBar } from '../../src/components/progress-bar';
import { Section, Specimen } from '../specimen';

/**
 * `ProgressBar` — the track from `Cards` § `Card/Stat`:
 *
 * ```css
 * width:100%;height:8px;border-radius:9999px;background:#e1e3e4;overflow:hidden;
 * ```
 *
 * with the fill at the percentage width, also `border-radius:9999px`. The
 * streak specimen in Motion & celebration is the same object at 10px with a
 * shimmer overlay — hence `shimmer`.
 *
 * Six hand-rolled copies of this existed, disagreeing about the track colour,
 * the corner radius and, more importantly, about accessibility: only one
 * exposed `role="progressbar"`. Here that is a prop with a deliberate default.
 * A bar that repeats a number the adjacent text already gives is decoration and
 * stays `aria-hidden`; pass `label` when the bar is the *only* place the
 * progress appears, and it becomes a real `progressbar` with `aria-valuenow`.
 *
 * `fillClassName` exists for the one case a token cannot express: a bar drawn
 * in a *member's* own hue, where the colour identifies a person rather than a
 * meaning.
 */
const meta = {
  title: 'Components/Progress bar',
  component: ProgressBar,
  parameters: { layout: 'padded' },
  argTypes: {
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg'] },
    tone: { control: 'inline-radio', options: ['brand', 'gold', 'success', 'inverse'] },
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
    shimmer: { control: 'boolean' },
  },
  args: { value: 62, max: 100, size: 'md', tone: 'brand', label: 'Voortgang' },
  render: (args) => (
    <div className="w-80">
      <ProgressBar {...args} />
    </div>
  ),
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: () => (
    <Section title="Progress bar — tones and sizes">
      <div className="flex w-full flex-col gap-8">
        <Specimen name="ProgressBar/tones" note="Brand, gold (stars), success. `inverse` below.">
          <div className="flex w-80 flex-col gap-3">
            <ProgressBar value={62} tone="brand" label="Voortgang" />
            <ProgressBar value={62} tone="gold" label="Sterren gespaard" />
            <ProgressBar value={62} tone="success" label="Klaar" />
          </div>
        </Specimen>

        <Specimen name="ProgressBar/inverse" note="On a filled card, where the track is the card.">
          <div className="w-80 rounded-2xl bg-primary p-5">
            <ProgressBar
              value={62}
              tone="inverse"
              size="lg"
              className="bg-card/25"
              label="31 van 50"
            />
          </div>
        </Specimen>

        <Specimen name="ProgressBar/sizes" note="4 · 6 · 8 · 10px.">
          <div className="flex w-80 flex-col gap-3">
            {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
              <ProgressBar key={size} value={48} size={size} />
            ))}
          </div>
        </Specimen>

        <Specimen
          name="ProgressBar/shimmer"
          note="`kynite-shimmer-sweep` — the streak bar in Motion & celebration."
        >
          <div className="w-80">
            <ProgressBar value={80} size="lg" tone="gold" shimmer label="5 dagen op rij" />
          </div>
        </Specimen>

        <Specimen name="ProgressBar/vertical" note="The star matrix's per-day column.">
          <div className="flex h-32 items-end gap-3">
            {[20, 45, 70, 100, 35].map((value) => (
              <ProgressBar key={value} value={value} orientation="vertical" size="lg" />
            ))}
          </div>
        </Specimen>
      </div>
    </Section>
  ),
};
