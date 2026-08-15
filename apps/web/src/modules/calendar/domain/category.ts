/**
 * Google's hex → one of the eight palette colors.
 *
 * This file used to answer "which colour does an event render in", through a
 * three-rung inheritance chain (per-event override → per-calendar choice →
 * Google's hex). M23 replaced that entirely: an event's hue is a function of
 * its **type** (`domain/event-type.ts`), everywhere, with no inheritance and
 * no override.
 *
 * What survives is the one thing that chain was genuinely good at. A Google
 * calendar's colour is an arbitrary hex, and the *provenance dot* beside a
 * calendar's name in settings still wants to show it — in a token the design
 * system has contrast ratios for, rather than raw.
 */

import type { EventCategory } from '../schema';

export const EVENT_CATEGORIES = [
  'blue',
  'purple',
  'orange',
  'green',
  'red',
  'yellow',
  'pink',
  'teal',
] as const;

/** Reference RGB for each palette entry — the `--cat-*-solid` tokens. */
const PALETTE_RGB: Record<EventCategory, [number, number, number]> = {
  blue: [0x3b, 0x82, 0xf6],
  purple: [0xa8, 0x55, 0xf7],
  orange: [0xf9, 0x73, 0x16],
  green: [0x22, 0xc5, 0x5e],
  red: [0xef, 0x44, 0x44],
  yellow: [0xea, 0xb3, 0x08],
  pink: [0xec, 0x48, 0x99],
  teal: [0x14, 0xb8, 0xa6],
};

/**
 * The reference hex of a palette entry — the inverse of `nearestCategory`.
 *
 * It exists because a calendar row stores a *colour*, not a category (the
 * column predates the palette and holds Google's arbitrary hex), so a surface
 * that lets a parent *pick* one — the feed subscription form (M25) — has to
 * write a hex the round trip through `nearestCategory` maps back to the same
 * entry. Derived from the same table rather than a second list of literals, so
 * the two can never drift.
 */
export function hexForCategory(category: EventCategory): string {
  const [red, green, blue] = PALETTE_RGB[category];
  const hex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${hex(red)}${hex(green)}${hex(blue)}`;
}

function parseHex(color: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * Nearest palette entry to an arbitrary hex, by squared distance in RGB.
 *
 * Plain RGB rather than a perceptual space: the eight references are far apart
 * and well spread, so the extra machinery of Lab/ΔE would change no answer
 * that matters here while adding a conversion nobody can check by eye.
 */
export function nearestCategory(color: string | null | undefined): EventCategory | null {
  if (!color) return null;
  const rgb = parseHex(color);
  if (!rgb) return null;

  let best: EventCategory = 'blue';
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const category of EVENT_CATEGORIES) {
    const reference = PALETTE_RGB[category];
    const distance =
      (rgb[0] - reference[0]) ** 2 + (rgb[1] - reference[1]) ** 2 + (rgb[2] - reference[2]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = category;
    }
  }

  return best;
}
