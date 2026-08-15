import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '../../src/components/button';
import {
  CELEBRATION_COLORS,
  CELEBRATION_LIMITS,
  CELEBRATION_PRESETS,
} from '../../src/components/celebration-presets';
import { ConfettiBurst } from '../../src/components/confetti-burst';
import { Icon } from '../../src/components/icon';
import { IconMedallion } from '../../src/components/icon-medallion';
import { ProgressBar } from '../../src/components/progress-bar';
import { StarPop } from '../../src/components/star-pop';
import { Section, Specimen, SpecimenGrid } from '../specimen';

/**
 * **Motion & celebration** — light and bouncy-friendly, reserved for the
 * moments worth marking.
 *
 * Two constraints shape every number in `CELEBRATION_PRESETS`, and neither is
 * decoration:
 *
 * - **Non-strobing.** A wall display in a kitchen sits at eye level for a child
 *   who may be photosensitive. WCAG 2.3.1 puts the flash threshold at three per
 *   second; every preset fires a *single* burst with a slow gravity fall and no
 *   repeat, so the flash rate is zero by construction rather than by tuning.
 *   `ticks` is what bounds a particle's life — one that never dies is one that
 *   keeps flickering at the bottom of the screen.
 * - **Intensity-configurable.** A morning routine step is not a savings goal
 *   being reached. `gentle` is the everyday tap, `standard` a whole routine
 *   finished, `big` the rare moment. A household that finds any of it too much
 *   turns the dial down — never off, because "off" leaves a child with nothing.
 *
 * The palette is the brand's, deliberately excluding red: red particles read as
 * an alert, and nothing in this product marks anything.
 *
 * The burst is told twice, on purpose. `fireConfettiBurst` lives in the app
 * (`components/celebration/confetti-burst.ts`) and draws on a *viewport* canvas
 * through a dynamically imported `canvas-confetti`: that is the burst a tap
 * fires, over the whole screen, and the package does not depend on it so no
 * consumer pays for a canvas library. `ConfettiBurst` is the same event in CSS,
 * for the places a viewport canvas cannot go — a 140px specimen tile, a static
 * Storybook build, a card that wants confetti behind its own heading. Both read
 * their geometry and their palette from `celebration-presets.ts`, so there is
 * one design and two renderers rather than two designs.
 *
 * The specimens below **loop**, and the product never does. A motion sheet that
 * fires once is a motion sheet nobody ever sees fire; a checklist with looping
 * confetti over it is wallpaper. `kynite-anim-pop-loop` and `<ConfettiBurst
 * loop>` are the documentation forms, and the single-fire demo under them is
 * the real thing.
 */
const meta: Meta = {
  title: 'Pages/Motion & celebration',
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

function CheckboxPop() {
  const [checked, setChecked] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setChecked((value) => !value)}
      aria-pressed={checked}
      className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-sm"
    >
      <span
        className={
          checked
            ? 'flex size-12 items-center justify-center rounded-2xl bg-success text-white'
            : 'flex size-12 items-center justify-center rounded-2xl border-2 border-line'
        }
      >
        {checked ? <Icon name="check" filled className="kynite-anim-check" /> : null}
      </span>
      <span className="font-display font-bold">Tik om af te vinken</span>
    </button>
  );
}

/** The single fire, as the product does it: one burst per tap, nothing looping. */
function ConfettiOnTap() {
  const [fired, setFired] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setFired((count) => count + 1)}
      className="relative flex h-[140px] w-[220px] items-center justify-center overflow-hidden rounded-[20px] bg-card shadow-sm"
    >
      {fired > 0 ? <ConfettiBurst key={fired} intensity="big" /> : null}
      <span className="relative flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 font-display text-body-sm font-bold text-brand-foreground">
        <Icon key={fired} name="celebration" filled className="kynite-anim-pop-big" size="sm" />
        Claimed!
      </span>
    </button>
  );
}

export const Specimens: Story = {
  render: () => (
    <div className="flex flex-col gap-12">
      <Section title="Motion — the specimens">
        <SpecimenGrid>
          <Specimen
            name="Motion/confetti burst"
            note="Five pieces, ~60px of travel, staggered 0.15s apart. Looping here; one fire in the product."
          >
            <div className="relative flex h-[140px] w-[220px] items-center justify-center overflow-hidden rounded-[20px] bg-card shadow-sm">
              <ConfettiBurst loop />
              <Icon
                name="star"
                filled
                size="2xl"
                className="kynite-anim-pop-loop relative text-gold"
              />
            </div>
          </Specimen>

          <Specimen
            name="Motion/confetti pop — big celebration"
            note="Eight pieces, twice the travel, gold in the mix, and the bigger icon pop. Reward approvals and streak milestones only."
          >
            <div className="relative flex h-[140px] w-[220px] items-center justify-center overflow-hidden rounded-[20px] bg-surface-night shadow-sm">
              <ConfettiBurst loop intensity="big" />
              <Icon
                name="celebration"
                filled
                size="2xl"
                className="kynite-anim-pop-big-loop relative text-gold"
              />
            </div>
          </Specimen>

          <Specimen
            name="Motion/confetti — the single fire"
            note="What a tap actually does: one burst, then nothing. Tap it again to fire again."
          >
            <ConfettiOnTap />
          </Specimen>

          <Specimen
            name="Motion/star pop"
            note="Scales up once and settles. A single non-repeating transform cannot strobe."
          >
            <StarPop amount={3} label="3 sterren verdiend" />
            <StarPop amount={12} label="12 sterren verdiend" intensity="standard" />
          </Specimen>

          <Specimen name="Motion/checkbox pop" note="`kynite-anim-check` — the haptic-style pop.">
            <CheckboxPop />
          </Specimen>

          <Specimen
            name="Motion/streak shimmer"
            note="`kynite-shimmer-sweep` on a 10px gold bar — the streak specimen."
          >
            <div className="flex w-64 items-center gap-3">
              <IconMedallion icon="local_fire_department" tint="gold" size="md" filled />
              <div className="flex-1">
                <ProgressBar value={80} size="lg" tone="gold" shimmer label="5 dagen op rij" />
              </div>
            </div>
          </Specimen>

          <Specimen
            name="Motion/big tap target"
            note='64px on tablet vs. the 48px kiosk minimum — `size="tablet"` and `size="hub"`.'
          >
            <Button size="hub">48px</Button>
            <Button size="tablet">64px</Button>
          </Specimen>
        </SpecimenGrid>
      </Section>

      <Section title="Presets — the numbers, and their ceiling">
        <div className="w-full max-w-3xl overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-line-subtle font-display text-caption text-ink-muted uppercase">
              <tr>
                <th className="py-2 pr-4">Intensity</th>
                <th className="py-2 pr-4">Particles</th>
                <th className="py-2 pr-4">Spread</th>
                <th className="py-2 pr-4">Ticks</th>
                <th className="py-2">Duur</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {(['gentle', 'standard', 'big'] as const).map((intensity) => (
                <tr key={intensity} className="border-b border-line-subtle">
                  <td className="py-2 pr-4 font-semibold">{intensity}</td>
                  <td className="py-2 pr-4">{CELEBRATION_PRESETS[intensity].particleCount}</td>
                  <td className="py-2 pr-4">{CELEBRATION_PRESETS[intensity].spread}°</td>
                  <td className="py-2 pr-4">{CELEBRATION_PRESETS[intensity].ticks}</td>
                  <td className="py-2">{CELEBRATION_PRESETS[intensity].durationMs} ms</td>
                </tr>
              ))}
              <tr className="text-ink-muted">
                <td className="py-2 pr-4 font-semibold">ceiling</td>
                <td className="py-2 pr-4">{CELEBRATION_LIMITS.maxParticleCount}</td>
                <td className="py-2 pr-4">—</td>
                <td className="py-2 pr-4">{CELEBRATION_LIMITS.maxTicks}</td>
                <td className="py-2">{CELEBRATION_LIMITS.maxDurationMs} ms</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Specimen
          name="Motion/confetti palette"
          note="Brand colours, no red — red reads as an alert."
        >
          {CELEBRATION_COLORS.map((color) => (
            <span
              key={color}
              title={color}
              className="size-10 rounded-full border border-line-subtle"
              style={{ background: color }}
            />
          ))}
        </Specimen>
      </Section>
    </div>
  ),
};
