import type { Meta, StoryObj } from '@storybook/react-vite';

import { Section } from '../specimen';

/**
 * `Foundations/Colors` — the palette, read out of the tokens rather than
 * retyped. Every swatch below paints itself with the same CSS variable a
 * component would use, so a token that changes in
 * `packages/ui/src/styles/tokens.css` changes here in the same commit, and a
 * token that is *missing* renders as a transparent hole rather than as a
 * plausible-looking colour.
 */

type Swatch = { name: string; token: string; note?: string };

const CORE: Swatch[] = [
  { name: 'Primary', token: '--brand', note: '#5d5fef' },
  { name: 'Primary hover', token: '--brand-hover' },
  { name: 'Primary Container', token: '--brand-container', note: '#2e5bff' },
  { name: 'Secondary', token: '--gold', note: '#ef8d5d' },
  { name: 'Secondary hover', token: '--gold-hover' },
  { name: 'Tertiary / success', token: '--success', note: '#006056' },
  { name: 'Error', token: '--error', note: '#ba1a1a' },
  { name: 'Warning', token: '--warning' },
];

const SURFACES: Swatch[] = [
  { name: 'Surface', token: '--background', note: '#fbf9f4 — the app ground' },
  { name: 'Surface Lowest', token: '--surface-container-lowest' },
  { name: 'Surface Container', token: '--surface-container', note: '#f5f3ee' },
  { name: 'Surface Container High', token: '--surface-container-high' },
  { name: 'On Surface', token: '--ink', note: '#191c1d' },
  { name: 'On Surface Variant', token: '--ink-secondary' },
  { name: 'Outline Variant', token: '--line' },
  { name: 'Border', token: '--line-subtle' },
];

/**
 * The eight categories, each generated from one hue — see the formula in
 * `tokens.css`. Rendered as the chip the palette exists for, so the four
 * tones are shown doing their actual jobs (fill, border, text, dot) rather
 * than as four disconnected rectangles.
 */
const CATEGORIES = [
  { name: 'School', key: 'blue' },
  { name: 'Sports', key: 'green' },
  { name: 'Health', key: 'red' },
  { name: 'Chores', key: 'purple' },
  { name: 'Family', key: 'pink' },
  { name: 'Personal', key: 'teal' },
  { name: 'Play', key: 'yellow' },
  { name: 'Travel', key: 'orange' },
] as const;

function SwatchTile({ name, token, note }: Swatch) {
  return (
    <div className="flex w-40 flex-col gap-2">
      <div
        className="h-18 rounded-xl border border-line-subtle"
        style={{ background: `var(${token})` }}
      />
      <div>
        <div className="font-display text-body-sm font-semibold">{name}</div>
        <div className="font-mono text-caption text-ink-muted">{token}</div>
        {note ? <div className="text-caption text-ink-muted">{note}</div> : null}
      </div>
    </div>
  );
}

function CategoryChip({ name, token }: { name: string; token: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-4xl border px-4 py-2 font-display text-body-sm font-semibold"
      style={{
        background: `var(--cat-${token}-surface)`,
        borderColor: `var(--cat-${token}-border)`,
        color: `var(--cat-${token}-fg)`,
      }}
    >
      <span
        className="size-2 rounded-full"
        style={{ background: `var(--cat-${token}-solid)` }}
        aria-hidden
      />
      {name}
    </span>
  );
}

const meta = {
  title: 'Foundations/Colors',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Core: Story = {
  name: 'Core palette',
  render: () => (
    <Section title="Colors — core">
      <div className="flex flex-wrap gap-6">
        {CORE.map((swatch) => (
          <SwatchTile key={swatch.token} {...swatch} />
        ))}
      </div>
    </Section>
  ),
};

export const Surfaces: Story = {
  render: () => (
    <Section title="Colors — surfaces & ink">
      <div className="flex flex-wrap gap-6">
        {SURFACES.map((swatch) => (
          <SwatchTile key={swatch.token} {...swatch} />
        ))}
      </div>
    </Section>
  ),
};

export const Categories: Story = {
  name: 'Category palette',
  render: () => (
    <Section title="Colors — the eight categories">
      <p className="max-w-prose text-body-sm text-ink-secondary">
        One hue per category, four tones each: <code>surface</code> fills the chip,{' '}
        <code>border</code> outlines it, <code>fg</code> is its text and <code>solid</code> is the
        dot — and the 4px rule on an event chip, which must never use the pale <code>border</code>{' '}
        tone.
      </p>
      <div className="flex flex-wrap gap-3">
        {CATEGORIES.map((category) => (
          <CategoryChip key={category.key} name={category.name} token={category.key} />
        ))}
      </div>
    </Section>
  ),
};

export const Dark: Story = {
  name: 'Dark theme',
  parameters: { backgrounds: { value: 'dark' } },
  render: () => (
    <div className="dark rounded-2xl bg-background p-8 text-foreground">
      <Section title="Colors — dark">
        <p className="max-w-prose text-body-sm text-ink-secondary">
          The design system specifies no dark palette; this one is derived from the two dark
          surfaces it does name (<code>#191c1d</code>, <code>#2e3132</code>) and the light indigo it
          uses for icon-on-dark. Same token names throughout, which is why nothing below had to be
          restated.
        </p>
        <div className="flex flex-wrap gap-6">
          {[...CORE, ...SURFACES].map((swatch) => (
            <SwatchTile key={swatch.token} {...swatch} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map((category) => (
            <CategoryChip key={category.key} name={category.name} token={category.key} />
          ))}
        </div>
      </Section>
    </div>
  ),
};
