import type { Meta, StoryObj } from '@storybook/react-vite';

import { Icon } from '../../src/components/icon';
import { Section, Specimen } from '../specimen';

/**
 * `Foundations/Brand` — the mark, the wordmark and the two lockups.
 *
 * The two SVGs are the app's own (`apps/web/public/images`), copied into
 * `.storybook/static/brand/` so the specimen shows the file that ships rather
 * than a redrawing of it. The constructed app-icon specimen beside them is the
 * design system's build recipe — two offset circles under a filled star —
 * kept as markup because that is how it is specified.
 */

const meta = {
  title: 'Foundations/Brand',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The three colours are the *tokens* the sheet's literals name —
 * `oklch(58% 0.14 245)` is `--cat-blue-solid`, `oklch(58% 0.14 335)` is
 * `--cat-pink-solid`, `#5d5fef` is `--brand`. Spelled as classes rather than as
 * inline `oklch()` strings so the mark cannot drift away from the palette that
 * feeds it, and so the theme banner's tile (which is this construction, in the
 * day's colours) is demonstrably the same object.
 */
function AppIcon({ size = 120 }: { size?: number }) {
  return (
    <div
      className="relative overflow-hidden bg-cat-blue-solid shadow-2xl"
      style={{ width: size, height: size, borderRadius: size * 0.233 }}
    >
      <span
        className="absolute rounded-full bg-cat-pink-solid/85"
        style={{
          width: size * 0.933,
          height: size * 0.933,
          left: -size * 0.317,
          top: -size * 0.25,
        }}
      />
      <span
        className="absolute rounded-full bg-brand/85"
        style={{
          width: size * 0.933,
          height: size * 0.933,
          right: -size * 0.342,
          bottom: -size * 0.317,
        }}
      />
      <span className="absolute inset-0 grid place-items-center">
        <Icon
          name="star"
          filled
          className="text-white drop-shadow-md"
          style={{ fontSize: size * 0.617, width: size * 0.617, height: size * 0.617 }}
        />
      </span>
    </div>
  );
}

export const Mark: Story = {
  name: 'Brand mark',
  render: () => (
    <Section title="Brand mark">
      <div className="flex flex-wrap items-end gap-12">
        <Specimen
          name="Icon/App icon"
          note="120px, radius 28, two offset circles under a filled star."
        >
          <AppIcon />
        </Specimen>
        <Specimen name="Icon/Shipped SVG" note="apps/web/public/images/logo-icon.svg">
          <img src="/brand/logo-icon.svg" alt="Kynite icon" className="size-[120px]" />
        </Specimen>
      </div>
    </Section>
  ),
};

export const Lockups: Story = {
  render: () => (
    <Section title="Lockups">
      <div className="flex flex-wrap items-start gap-12">
        <Specimen name="Lockup/Horizontal — light">
          <div className="flex items-center gap-3.5 rounded-xl border border-line-subtle bg-surface px-7 py-5">
            <AppIcon size={44} />
            <span className="font-display text-[28px] font-bold tracking-[-0.01em] text-ink">
              Kynite
            </span>
          </div>
        </Specimen>
        <Specimen name="Lockup/Horizontal — dark">
          <div className="flex items-center gap-3 rounded-xl bg-surface-night px-6.5 py-4.5">
            <AppIcon size={36} />
            <span className="font-display text-[22px] font-bold text-white">Kynite</span>
          </div>
        </Specimen>
        <Specimen name="Lockup/Shipped SVG" note="apps/web/public/images/logo-horizontal.svg">
          <img src="/brand/logo-horizontal.svg" alt="Kynite" className="h-11" />
        </Specimen>
        <Specimen name="Sidebar mini mark">
          <span className="grid size-7 place-items-center rounded-full bg-primary font-display text-[13px] font-extrabold text-primary-foreground">
            K
          </span>
        </Specimen>
      </div>
    </Section>
  ),
};
