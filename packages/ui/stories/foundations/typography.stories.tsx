import type { Meta, StoryObj } from '@storybook/react-vite';

import { Section, Specimen } from '../specimen';

/**
 * `Foundations/Typography` — the type scale, set in the fonts it is specified
 * in. Every row uses the `text-*` utility a component would use, so the sizes
 * shown are the compiled `--text-*` tokens and not a table that has to be kept
 * in step with them.
 */

const SCALE = [
  { token: 'display-hub', className: 'text-display-hub', spec: 'Baloo 2 800 · 72/80 · −0.04em' },
  { token: 'display-xl', className: 'text-display-xl', spec: 'Baloo 2 800 · 80 · −0.04em' },
  { token: 'display-lg', className: 'text-display-lg', spec: 'Baloo 2 800 · 56/1.04 · −0.03em' },
  { token: 'display-md', className: 'text-display-md', spec: 'Baloo 2 800 · 36 · −0.02em' },
  { token: 'h1', className: 'text-h1', spec: 'Baloo 2 700 · 32/40 · −0.02em' },
  { token: 'h2', className: 'text-h2', spec: 'Baloo 2 700 · 24' },
  { token: 'h3', className: 'text-h3', spec: 'Baloo 2 600 · 20/28' },
  { token: 'body-lg', className: 'text-body-lg', spec: 'Poppins 400 · 18/28' },
  { token: 'body', className: 'text-body', spec: 'Poppins 400 · 16/24' },
  { token: 'body-sm', className: 'text-body-sm', spec: 'Poppins 400 · 14' },
  { token: 'caption', className: 'text-caption', spec: 'Poppins 400 · 12' },
] as const;

const SAMPLES: Record<string, string> = {
  'display-hub': '18:00',
  'display-xl': '18:00',
  'display-lg': 'Today at home',
  'display-md': '04:32',
  h1: 'Today at home',
  h2: 'Needs your attention',
  h3: 'Needs your attention',
  'body-lg': 'Movie night pick — 12 stars',
  body: 'Bring gym clothes',
  'body-sm': 'Bring gym clothes',
  caption: 'Synced 2 minutes ago',
};

const meta = {
  title: 'Foundations/Typography',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Scale: Story = {
  name: 'Type scale',
  render: () => (
    <Section title="Typography">
      <div className="flex flex-col gap-7">
        {SCALE.map((step) => (
          <div key={step.token} className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-brand-ink">{step.token}</span>
              <span className="text-caption text-ink-muted">{step.spec}</span>
            </div>
            <div
              className={
                step.token.startsWith('display') || step.token.startsWith('h')
                  ? `${step.className} font-display`
                  : step.className
              }
            >
              {SAMPLES[step.token]}
            </div>
          </div>
        ))}
      </div>
    </Section>
  ),
};

export const Utilities: Story = {
  name: 'Type utilities',
  render: () => (
    <Section title="Typography — utilities">
      <div className="flex flex-wrap gap-x-14 gap-y-8">
        <Specimen
          name="label-overline"
          note="Uppercase metadata label — Baloo 2 700, 12/16, 0.05em. Used for STREAK, TODAY, WEEKLY STARS and every field label."
        >
          <span className="label-overline text-ink-secondary">MONDAY, OCT 23</span>
        </Specimen>
        <Specimen name="tnum" note="Tabular numerals — any digit that sits in a row that moves.">
          <span className="tnum text-body font-medium">08:45 · 12 pts</span>
        </Specimen>
        <Specimen
          name="tabular-time"
          note="The clock-face variant: tabular Baloo 2, tightened. Countdowns and wall clocks."
        >
          <span className="tabular-time text-display-md">04:32</span>
        </Specimen>
      </div>
    </Section>
  ),
};

export const Kiosk: Story = {
  name: 'Kiosk scale (data-surface="hub")',
  render: () => (
    <Section title="Typography — the six-foot scale">
      <p className="max-w-prose text-body-sm text-ink-secondary">
        The wall hub redefines the scale itself rather than branching every component: inside{' '}
        <code>[data-surface=&quot;hub&quot;]</code> the <code>--text-*</code> variables are ~1.45×
        on the reading sizes, and nothing is typeset below 16px. Same markup on both sides.
      </p>
      <div className="grid gap-8 md:grid-cols-2">
        {(['phone', 'hub'] as const).map((surface) => (
          <div
            key={surface}
            data-surface={surface === 'hub' ? 'hub' : undefined}
            className="flex flex-col gap-3 rounded-2xl bg-card p-6 shadow-sm"
          >
            <span className="label-overline text-ink-muted">{surface}</span>
            <span className="font-display text-h2">Needs your attention</span>
            <span className="text-body">Bring gym clothes</span>
            <span className="text-caption">Synced 2 minutes ago</span>
          </div>
        ))}
      </div>
    </Section>
  ),
};
