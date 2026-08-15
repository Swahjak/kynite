import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CHIME_INTENSITIES,
  CHIME_TONE,
  DEFAULT_CHIME,
  OVERRUN_PULSE_MS,
  chimeGain,
  isChimeAudible,
  isNonStrobing,
  parseChimeSetting,
} from '@/modules/timers/domain/chime';

/**
 * The timer's sound and the timer's motion — both bounded by the psychology
 * law (research §Decisions 1, §"Ambient display"): a hub may signal, never
 * startle, and nothing on a child-facing surface flashes.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('chime volume and intensity', () => {
  it('is silent at `off`, whatever the volume says', () => {
    expect(chimeGain({ intensity: 'off', volume: 1 })).toBe(0);
    expect(isChimeAudible({ intensity: 'off', volume: 1 })).toBe(false);
  });

  it('scales with the volume and stays under a hard ceiling', () => {
    const soft = chimeGain({ intensity: 'soft', volume: 1 });
    const full = chimeGain({ intensity: 'full', volume: 1 });

    expect(soft).toBeGreaterThan(0);
    expect(full).toBeGreaterThan(soft);
    // Well under unity: a wall tablet at full volume is a chime, not an alarm.
    expect(full).toBeLessThanOrEqual(0.5);
    expect(chimeGain({ intensity: 'full', volume: 0.5 })).toBeCloseTo(full / 2, 6);
  });

  it('clamps a nonsense volume rather than trusting it', () => {
    expect(chimeGain({ intensity: 'full', volume: 11 })).toBe(
      chimeGain({ intensity: 'full', volume: 1 })
    );
    expect(chimeGain({ intensity: 'full', volume: -3 })).toBe(0);
    expect(chimeGain({ intensity: 'full', volume: Number.NaN })).toBe(0);
  });

  it('defaults to soft — a hub that shouts on first use gets muted forever', () => {
    expect(DEFAULT_CHIME.intensity).toBe('soft');
    expect(isChimeAudible(DEFAULT_CHIME)).toBe(true);
  });

  it('narrows anything stored on a device back to a real setting', () => {
    expect(parseChimeSetting(null)).toEqual(DEFAULT_CHIME);
    expect(parseChimeSetting('not a setting')).toEqual(DEFAULT_CHIME);
    expect(parseChimeSetting({ intensity: 'loud', volume: 0.5 })).toEqual({
      intensity: DEFAULT_CHIME.intensity,
      volume: 0.5,
    });
    expect(parseChimeSetting({ intensity: 'off', volume: 5 })).toEqual({
      intensity: 'off',
      volume: 1,
    });
    expect(parseChimeSetting({ intensity: 'full' })).toEqual({
      intensity: 'full',
      volume: DEFAULT_CHIME.volume,
    });
  });

  it('offers "off" as a first-class choice, not just a volume of zero', () => {
    expect(CHIME_INTENSITIES).toContain('off');
  });
});

describe('the chime plays once', () => {
  it('is a short two-note rise with no repeat', () => {
    expect(CHIME_TONE.notes).toHaveLength(2);
    expect(CHIME_TONE.notes[1].frequencyHz).toBeGreaterThan(CHIME_TONE.notes[0].frequencyHz);

    const total =
      CHIME_TONE.notes.reduce((sum, note) => sum + note.durationMs, 0) + CHIME_TONE.gapMs;
    expect(total).toBeLessThan(1000);
  });

  it('ramps both edges so nothing clicks', () => {
    expect(CHIME_TONE.edgeMs).toBeGreaterThan(0);
    for (const note of CHIME_TONE.notes) {
      expect(note.durationMs).toBeGreaterThan(CHIME_TONE.edgeMs * 2);
    }
  });
});

describe('nothing strobes', () => {
  it('holds the expired-timer pulse far below the 3Hz flash threshold', () => {
    expect(isNonStrobing(OVERRUN_PULSE_MS)).toBe(true);
    // Not vacuous: a genuine strobe fails the same check.
    expect(isNonStrobing(120)).toBe(false);
  });

  it('keeps the pulse an opacity breath — no colour change, small amplitude', () => {
    // The keyframes are the actual artefact; asserting on the stylesheet is
    // what makes this test about the rendered thing rather than a constant.
    const css = readFileSync(join(root, 'src/app/globals.css'), 'utf8');
    const block = /@keyframes timer-breath\s*\{([\s\S]*?)\n\}/.exec(css);

    expect(block, 'the timer-breath keyframes must exist').not.toBeNull();

    const body = block![1];
    const opacities = [...body.matchAll(/opacity:\s*([\d.]+)/g)].map((match) => Number(match[1]));

    expect(opacities.length).toBeGreaterThanOrEqual(2);
    // A dip, not a blink: never near-transparent at any point in the cycle.
    expect(Math.min(...opacities)).toBeGreaterThanOrEqual(0.6);
    // Only opacity animates — no background, colour or transform flicker.
    expect(body).not.toMatch(/background|color|transform/);
  });

  it('applies the pulse only through the shared token, at the shared duration', () => {
    const tokens = readFileSync(join(root, 'src/modules/timers/ui/tokens.ts'), 'utf8');

    expect(tokens).toMatch(/animationName: 'timer-breath'/);
    expect(tokens).toMatch(/OVERRUN_PULSE_MS/);
    // No second, faster animation smuggled into the timer UI.
    const ui = ['timer-tile.tsx', 'timer-board.tsx', 'ambient-timers.tsx'].map((file) =>
      readFileSync(join(root, 'src/modules/timers/ui', file), 'utf8')
    );
    for (const source of ui) {
      expect(source).not.toMatch(/animate-(?:ping|bounce|pulse)/);
    }
  });
});
