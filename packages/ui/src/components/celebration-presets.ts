/**
 * Celebration presets — shared, non-strobing, intensity-configurable.
 *
 * Two constraints shape every number in this file, and neither is decoration.
 *
 * **Non-strobing.** A wall display in a kitchen is at eye level for a child who
 * may be photosensitive. WCAG 2.3.1 puts the general/red flash threshold at
 * three flashes per second; the presets here fire a *single* burst with a slow
 * gravity fall and no repeat, so the flash rate is zero by construction rather
 * than by tuning. `ticks` is what bounds the animation's life — a particle that
 * never dies is a particle that keeps flickering at the bottom of the screen.
 *
 * **Intensity-configurable.** A morning routine step is not a savings goal
 * being reached. `gentle` is the everyday tap; `standard` is a whole routine
 * finished; `big` is reserved for the rare moment (M08's redemption approval).
 * A household that finds any of it too much turns the whole thing down to
 * `gentle` — the setting is a dial, never an on/off that leaves a child with
 * nothing.
 *
 * The palette is the brand's, deliberately excluding red: red particles read as
 * an alert, and nothing in this product marks anything (research §Decisions 1).
 */

export const CELEBRATION_INTENSITIES = ['gentle', 'standard', 'big'] as const;

export type CelebrationIntensity = (typeof CELEBRATION_INTENSITIES)[number];

/**
 * The confetti palette, quoted from `docs/design/motion.md`: the regular burst
 * mixes `#ef8d5d`, `#71f8e4`, `#b8c3ff` and `#006056`, and the big-celebration
 * burst adds `#fecf6e`. No red, no white flash.
 */
export const CELEBRATION_COLORS = ['#ef8d5d', '#71f8e4', '#b8c3ff', '#006056', '#fecf6e'] as const;

export type CelebrationPreset = {
  particleCount: number;
  spread: number;
  startVelocity: number;
  /** Frames a particle lives for. Bounded, so nothing lingers or flickers. */
  ticks: number;
  gravity: number;
  scalar: number;
  decay: number;
  colors: string[];
  /** Approximate wall-clock life of the burst, in ms. */
  durationMs: number;
};

export const CELEBRATION_PRESETS: Record<CelebrationIntensity, CelebrationPreset> = {
  gentle: {
    particleCount: 24,
    spread: 55,
    startVelocity: 22,
    ticks: 90,
    gravity: 0.9,
    scalar: 0.8,
    decay: 0.92,
    colors: [...CELEBRATION_COLORS],
    durationMs: 900,
  },
  standard: {
    particleCount: 56,
    spread: 70,
    startVelocity: 28,
    ticks: 120,
    gravity: 0.9,
    scalar: 0.95,
    decay: 0.92,
    colors: [...CELEBRATION_COLORS],
    durationMs: 1200,
  },
  big: {
    particleCount: 96,
    spread: 90,
    startVelocity: 34,
    ticks: 150,
    gravity: 0.85,
    scalar: 1.1,
    decay: 0.93,
    colors: [...CELEBRATION_COLORS],
    durationMs: 1600,
  },
};

/**
 * Hard ceiling every preset is checked against.
 *
 * `ticks` at 60fps must stay under ~3s so a burst cannot overlap the next tap,
 * and `particleCount` stays low enough that a Raspberry-Pi-class kiosk renders
 * the burst without dropping the frame the tap itself needs.
 */
export const CELEBRATION_LIMITS = {
  maxTicks: 180,
  maxParticleCount: 120,
  maxDurationMs: 2000,
} as const;

/**
 * One CSS confetti particle, as the design system's motion sheet draws it.
 *
 * The canvas burst above and this one are the same event told twice, and both
 * tellings have to exist. `canvas-confetti` draws on a *viewport* canvas: it is
 * how the burst appears over a whole screen when a child taps a step, and it is
 * dynamically imported by the app so a kiosk does not pay for it at boot. It
 * cannot, however, be drawn inside a 220px specimen tile, inside a static
 * Storybook build, or inside anything that has to keep looping while somebody
 * looks at it — which is exactly what a design system's motion page is.
 *
 * So the pieces below are the design sheet's own markup as data: five for the
 * everyday burst, eight for the big one, each with the offset, rotation and
 * stagger it has in `Kynite Design System.dc.html` § "Motion & celebration".
 * Rendering them is `<ConfettiBurst>`, which needs no dependency at all — the
 * cheapest way to have the package and the app agree on what a burst looks
 * like without the package taking on a canvas library it would only ever use
 * in a specimen.
 */
export type ConfettiPieceSpec = {
  /** Diameter in px. */
  size: number;
  /** Round pieces and 2px-radius squares alternate, as in the sheet. */
  shape: 'round' | 'square';
  color: string;
  /** Where the piece ends up, relative to the burst origin. */
  tx: number;
  ty: number;
  /** Rotation at the end of its life, in degrees. */
  tr: number;
  /** Stagger, in seconds — what turns five pieces into a burst. */
  delay: number;
};

/** The everyday burst: five pieces, ~60px of travel. */
export const CONFETTI_BURST_PIECES: readonly ConfettiPieceSpec[] = [
  { size: 8, shape: 'round', color: '#ef8d5d', tx: -46, ty: -38, tr: 80, delay: 0 },
  { size: 6, shape: 'square', color: '#71f8e4', tx: 44, ty: -42, tr: -60, delay: 0.15 },
  { size: 7, shape: 'round', color: '#b8c3ff', tx: -52, ty: 20, tr: 40, delay: 0.3 },
  { size: 6, shape: 'square', color: '#ef8d5d', tx: 50, ty: 24, tr: -30, delay: 0.45 },
  { size: 6, shape: 'round', color: '#006056', tx: 0, ty: -58, tr: 0, delay: 0.6 },
];

/** The rare moment: eight pieces, twice the travel, tighter stagger — and gold. */
export const CONFETTI_BURST_PIECES_BIG: readonly ConfettiPieceSpec[] = [
  { size: 10, shape: 'round', color: '#ef8d5d', tx: -80, ty: -60, tr: 120, delay: 0 },
  { size: 8, shape: 'square', color: '#71f8e4', tx: 80, ty: -64, tr: -90, delay: 0.08 },
  { size: 9, shape: 'round', color: '#b8c3ff', tx: -92, ty: 24, tr: 60, delay: 0.16 },
  { size: 8, shape: 'square', color: '#ef8d5d', tx: 92, ty: 30, tr: -45, delay: 0.24 },
  { size: 9, shape: 'round', color: '#fecf6e', tx: 0, ty: -96, tr: 0, delay: 0.32 },
  { size: 7, shape: 'square', color: '#b8c3ff', tx: -40, ty: 76, tr: 75, delay: 0.4 },
  { size: 7, shape: 'round', color: '#71f8e4', tx: 44, ty: 80, tr: -70, delay: 0.48 },
  { size: 8, shape: 'square', color: '#fecf6e', tx: -20, ty: -102, tr: 20, delay: 0.56 },
];

/**
 * Does the current environment want motion at all?
 *
 * Defaults to *allowing* motion when the query cannot be evaluated (SSR, an
 * old browser): the celebration is the feedback, and silently removing it for
 * everyone would be the worse failure. Every animation module gates on this.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
