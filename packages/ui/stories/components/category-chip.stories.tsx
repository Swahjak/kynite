import type { Meta, StoryObj } from '@storybook/react-vite';

import { CategoryChip, CategoryDot } from '../../src/components/category-chip';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * `CategoryChip` — `Chips & badges` § category, in the eight-hue palette:
 *
 * ```css
 * display:inline-flex;align-items:center;gap:8px;
 * padding:8px 16px;border-radius:9999px;
 * background: oklch(94% 0.025 H);
 * border: 1px solid oklch(85% 0.05 H);
 * color: oklch(32% 0.08 H);
 * font-family:'Baloo 2';font-weight:600;font-size:13px;
 * ```
 *
 * The hue lives in the `--cat-*` tokens, so the chip takes the *class triplet*
 * for its category rather than a colour value. That is deliberate: which hue a
 * thing wears is a product decision (an event category, a family member), and
 * the design system's job is to draw whichever one it is handed. The app passes
 * the classes from `modules/calendar/ui/tokens.ts` or `MEMBER_COLOR_CLASSES`.
 *
 * `CategoryDot` is the same palette in its other documented form — "small
 * dot-only usage (calendar strip / month grid event markers): 4–8px, radius
 * 9999px". The three sizes below are those 4, 6 and 8px.
 */
const HUES = ['blue', 'purple', 'orange', 'green', 'red', 'yellow', 'pink', 'teal'] as const;

/**
 * Written out rather than interpolated: Tailwind scans source *text*, so
 * `bg-cat-${hue}-surface` would never make it into the stylesheet. The app's
 * own token tables spell them out for the same reason.
 */
const HUE_CLASSES: Record<
  (typeof HUES)[number],
  { surface: string; border: string; solid: string }
> = {
  blue: {
    surface: 'bg-cat-blue-surface text-cat-blue-fg',
    border: 'border-cat-blue-border',
    solid: 'bg-cat-blue-solid',
  },
  purple: {
    surface: 'bg-cat-purple-surface text-cat-purple-fg',
    border: 'border-cat-purple-border',
    solid: 'bg-cat-purple-solid',
  },
  orange: {
    surface: 'bg-cat-orange-surface text-cat-orange-fg',
    border: 'border-cat-orange-border',
    solid: 'bg-cat-orange-solid',
  },
  green: {
    surface: 'bg-cat-green-surface text-cat-green-fg',
    border: 'border-cat-green-border',
    solid: 'bg-cat-green-solid',
  },
  red: {
    surface: 'bg-cat-red-surface text-cat-red-fg',
    border: 'border-cat-red-border',
    solid: 'bg-cat-red-solid',
  },
  yellow: {
    surface: 'bg-cat-yellow-surface text-cat-yellow-fg',
    border: 'border-cat-yellow-border',
    solid: 'bg-cat-yellow-solid',
  },
  pink: {
    surface: 'bg-cat-pink-surface text-cat-pink-fg',
    border: 'border-cat-pink-border',
    solid: 'bg-cat-pink-solid',
  },
  teal: {
    surface: 'bg-cat-teal-surface text-cat-teal-fg',
    border: 'border-cat-teal-border',
    solid: 'bg-cat-teal-solid',
  },
};

const meta = {
  title: 'Components/Category chip',
  component: CategoryChip,
  parameters: { layout: 'padded' },
  args: {
    children: 'School',
    dot: true,
    surfaceClass: HUE_CLASSES.blue.surface,
    borderClass: HUE_CLASSES.blue.border,
    dotClass: HUE_CLASSES.blue.solid,
  },
} satisfies Meta<typeof CategoryChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Palette: Story = {
  render: () => (
    <Section title="Category chip — the eight hues">
      <SpecimenGrid>
        {HUES.map((hue) => (
          <Specimen key={hue} name={`Chip/${hue}`}>
            <CategoryChip
              surfaceClass={HUE_CLASSES[hue].surface}
              borderClass={HUE_CLASSES[hue].border}
            >
              {hue}
            </CategoryChip>
            <CategoryChip
              dot
              dotClass={HUE_CLASSES[hue].solid}
              surfaceClass={HUE_CLASSES[hue].surface}
              borderClass={HUE_CLASSES[hue].border}
            >
              {hue}
            </CategoryChip>
          </Specimen>
        ))}
      </SpecimenGrid>
    </Section>
  ),
};

export const Dots: Story = {
  render: () => (
    <Section title="Category dot — the marker form">
      <Specimen
        name="Dot/xs · sm · md"
        note="4 · 6 · 8px, as used in the week strip and month grid."
      >
        {(['xs', 'sm', 'md'] as const).map((size) =>
          HUES.map((hue) => (
            <CategoryDot key={`${size}-${hue}`} size={size} className={HUE_CLASSES[hue].solid} />
          ))
        )}
      </Specimen>
    </Section>
  ),
};
