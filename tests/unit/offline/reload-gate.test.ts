import { describe, expect, it } from 'vitest';
import {
  IDLE_BEFORE_RELOAD_MS,
  MAX_DEFERRAL_MS,
  NIGHTLY_WINDOW,
  RELOAD_HUB_MESSAGE,
  idleMs,
  isNightly,
  reloadReason,
  shouldReloadHub,
} from '@/components/offline/reload-gate';

/**
 * The `RELOAD_HUB` gate (docs/architecture.md §6 "Long-run hygiene"; M11:
 * "Service worker skip-waiting posts `RELOAD_HUB`; the hub reloads only when
 * idle >5 min or nightly — unit test on the reload gate").
 *
 * The failure this guards against is concrete and unrecoverable: a deploy
 * lands at 07:20, the board blanks, and a six-year-old halfway through
 * "shoes on" watches their morning disappear. Every case below is a sentence
 * about that morning.
 */

/** 08:00 on a Tuesday — the middle of the one hour that must never be interrupted. */
const morning = (hour = 8, minute = 0) => new Date(2026, 2, 10, hour, minute, 0);

describe('reload gate', () => {
  it('never reloads when no update is pending', () => {
    const now = morning();

    expect(
      shouldReloadHub({
        now,
        updateReadyAt: null,
        // Untouched for a week. Still nothing to reload *for*.
        lastInteractionAt: new Date(now.getTime() - 7 * 86_400_000),
      })
    ).toBe(false);
  });

  it('does not reload mid-routine, however long the update has waited', () => {
    const now = morning(7, 20);

    expect(
      shouldReloadHub({
        now,
        // Ready an hour ago.
        updateReadyAt: new Date(now.getTime() - 3_600_000),
        // Someone tapped the board ten seconds ago.
        lastInteractionAt: new Date(now.getTime() - 10_000),
      })
    ).toBe(false);
  });

  it('reloads once the board has been idle past the threshold', () => {
    const now = morning(14, 0);
    const input = {
      now,
      updateReadyAt: new Date(now.getTime() - 600_000),
      lastInteractionAt: new Date(now.getTime() - IDLE_BEFORE_RELOAD_MS - 1000),
    };

    expect(shouldReloadHub(input)).toBe(true);
    expect(reloadReason(input)).toBe('idle');
  });

  it('holds at exactly the threshold and releases one millisecond later', () => {
    const now = morning(14, 0);
    const at = (idle: number) => ({
      now,
      updateReadyAt: new Date(now.getTime() - 600_000),
      lastInteractionAt: new Date(now.getTime() - idle),
    });

    // The boundary is inclusive on the "reload" side: five minutes of
    // stillness *is* five minutes of stillness.
    expect(shouldReloadHub(at(IDLE_BEFORE_RELOAD_MS - 1))).toBe(false);
    expect(shouldReloadHub(at(IDLE_BEFORE_RELOAD_MS))).toBe(true);
  });

  it('reloads inside the nightly window even if the board was just touched', () => {
    const night = new Date(2026, 2, 10, NIGHTLY_WINDOW.startHour, 30, 0);
    const input = {
      now: night,
      updateReadyAt: new Date(night.getTime() - 60_000),
      lastInteractionAt: new Date(night.getTime() - 5_000),
    };

    expect(shouldReloadHub(input)).toBe(true);
    expect(reloadReason(input)).toBe('nightly');
  });

  it('treats the nightly window as half-open on the hour', () => {
    expect(isNightly(new Date(2026, 2, 10, NIGHTLY_WINDOW.startHour - 1, 59))).toBe(false);
    expect(isNightly(new Date(2026, 2, 10, NIGHTLY_WINDOW.startHour, 0))).toBe(true);
    expect(isNightly(new Date(2026, 2, 10, NIGHTLY_WINDOW.endHour - 1, 59))).toBe(true);
    expect(isNightly(new Date(2026, 2, 10, NIGHTLY_WINDOW.endHour, 0))).toBe(false);
  });

  it('eventually takes an update on a board that is never idle and never nightly', () => {
    const now = morning(11, 0);
    const input = {
      now,
      updateReadyAt: new Date(now.getTime() - MAX_DEFERRAL_MS - 1),
      lastInteractionAt: new Date(now.getTime() - 1_000),
    };

    expect(shouldReloadHub(input)).toBe(true);
    expect(reloadReason(input)).toBe('deferred-too-long');
  });

  it('reports idle time, floored at zero for a clock that ran backwards', () => {
    const now = morning();

    expect(idleMs({ now, lastInteractionAt: new Date(now.getTime() - 90_000) })).toBe(90_000);
    // A tablet whose clock jumps (NTP, a DST change) must not be treated as
    // "idle for minus two hours" and reload immediately.
    expect(idleMs({ now, lastInteractionAt: new Date(now.getTime() + 7_200_000) })).toBe(0);
  });

  it('names the message the service worker posts', () => {
    // The literal is a wire contract between `src/app/sw.ts` and
    // `hub-reload-controller.tsx`; a rename in one is silence in the other.
    expect(RELOAD_HUB_MESSAGE).toBe('RELOAD_HUB');
  });

  it('pins the threshold to five minutes', () => {
    expect(IDLE_BEFORE_RELOAD_MS).toBe(5 * 60_000);
  });
});
