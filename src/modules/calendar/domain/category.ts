/**
 * Which of the eight palette colors an event renders in.
 *
 * M04 deferred the category dimension to M06; the decision it landed on is
 * deliberately small. `event.category` is a **nullable override**, and null
 * means "inherit from the calendar". That keeps two properties at once:
 *
 * - A synced Google event needs no per-row decision before it can render —
 *   thousands of imported rows stay null and still come out color-coded.
 * - A parent who recolors one event is expressing something about *that*
 *   event, so the override survives the next sync of its calendar.
 *
 * A calendar's own color is Google's hex, which is not one of our eight. It is
 * mapped to the nearest palette entry once, here, rather than rendered raw:
 * eight tokens are what the design system has contrast ratios for.
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

export type CategorySource = {
  /** `event.category` — the per-event override. */
  category: EventCategory | null;
  /** `calendar.color` — Google's hex for the owning calendar, if any. */
  calendarColor?: string | null;
};

/**
 * The palette entry an event renders in: its own override, else its calendar's
 * color mapped onto the palette, else blue. Total by construction — every event
 * gets a color, so no view has to handle a colorless one.
 */
export function resolveCategory(source: CategorySource): EventCategory {
  return source.category ?? nearestCategory(source.calendarColor) ?? 'blue';
}
