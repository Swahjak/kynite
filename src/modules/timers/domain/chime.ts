/**
 * The sound a finished timer makes — pure description, no Web Audio here.
 *
 * Two constraints from the psychology law (research §"Ambient display",
 * §Decisions 1) are encoded as data so a test can hold them:
 *
 * - **Never startling.** The chime is a two-note rise at a bounded gain, plays
 *   once, and can be turned off entirely. There is no alarm, no repeat, no
 *   escalation.
 * - **Never strobing.** The only motion an expired timer makes is a slow
 *   opacity breath. `OVERRUN_PULSE_MS` is its full cycle, and
 *   `isNonStrobing()` is what keeps it far below the 3Hz photosensitivity
 *   threshold (WCAG 2.3.1) rather than "far below" being a comment nobody
 *   rechecks.
 */

export const CHIME_INTENSITIES = ['off', 'soft', 'full'] as const;

export type ChimeIntensity = (typeof CHIME_INTENSITIES)[number];

export type ChimeSetting = {
  intensity: ChimeIntensity;
  /** 0..1, the family's own volume on top of the intensity. */
  volume: number;
};

/** Soft by default: a hub that shouts on first use gets muted forever. */
export const DEFAULT_CHIME: ChimeSetting = { intensity: 'soft', volume: 0.6 };

/** Hard ceilings on output gain, per intensity. `off` is silence, exactly. */
const INTENSITY_GAIN: Record<ChimeIntensity, number> = {
  off: 0,
  soft: 0.18,
  full: 0.45,
};

/** The final Web Audio gain. Clamped at both ends — a stored 11 is still 0.45. */
export function chimeGain(setting: ChimeSetting): number {
  const volume = Math.min(1, Math.max(0, Number.isFinite(setting.volume) ? setting.volume : 0));
  return INTENSITY_GAIN[setting.intensity] * volume;
}

export function isChimeAudible(setting: ChimeSetting): boolean {
  return chimeGain(setting) > 0;
}

/** Anything at all — localStorage, a query string — narrowed to a real setting. */
export function parseChimeSetting(raw: unknown): ChimeSetting {
  if (!raw || typeof raw !== 'object') return DEFAULT_CHIME;

  const value = raw as { intensity?: unknown; volume?: unknown };
  const intensity = CHIME_INTENSITIES.includes(value.intensity as ChimeIntensity)
    ? (value.intensity as ChimeIntensity)
    : DEFAULT_CHIME.intensity;

  const volume =
    typeof value.volume === 'number' && Number.isFinite(value.volume)
      ? Math.min(1, Math.max(0, value.volume))
      : DEFAULT_CHIME.volume;

  return { intensity, volume };
}

/** Where the hub remembers its sound setting (see the note in `use-chime.ts`). */
export const CHIME_STORAGE_KEY = 'kynite.timer-chime';

/** A two-note rise, played once. Not a loop, not an alarm. */
export const CHIME_TONE = {
  notes: [
    { frequencyHz: 660, durationMs: 180 },
    { frequencyHz: 880, durationMs: 300 },
  ],
  gapMs: 60,
  /** Fade in/out on every note so nothing clicks. */
  edgeMs: 25,
} as const;

/** Full cycle of the expired-timer opacity breath, in milliseconds. */
export const OVERRUN_PULSE_MS = 2400;

/**
 * Below 3Hz — the WCAG 2.3.1 general flash threshold — with the margin stated
 * as a number: a cycle of at least a second is 1Hz or slower.
 */
export function isNonStrobing(cycleMs: number): boolean {
  return cycleMs >= 1000;
}
