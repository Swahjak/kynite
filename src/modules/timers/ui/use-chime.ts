'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  CHIME_STORAGE_KEY,
  CHIME_TONE,
  DEFAULT_CHIME,
  chimeGain,
  isChimeAudible,
  parseChimeSetting,
  type ChimeSetting,
} from '../domain/chime';

/**
 * The sound a finished timer makes, and the setting that governs it.
 *
 * Three rules, all of them the browser's or the psychology law's:
 *
 * - **Gesture-gated.** Autoplay policy suspends an `AudioContext` created
 *   without user interaction, so the context is only built on the first
 *   pointer/key event the hub sees. Before that, `play()` returns silently —
 *   never a warning, never a "tap to enable sound" nag on a wall display.
 * - **Degrades silently.** No Web Audio, a suspended context, a thrown
 *   constructor: the countdown is the primary signal and it is visual. Sound is
 *   an enhancement that is allowed to be absent.
 * - **Bounded.** Gain comes from `domain/chime.chimeGain()`, which is capped
 *   per intensity, and `off` is exactly zero.
 *
 * The setting is persisted in `localStorage`, per device. There is no
 * server-side family settings surface in the codebase yet (M09 does not
 * introduce one); a wall tablet in the kitchen and a phone in a pocket
 * plausibly want different volumes anyway, so the device-local store is not
 * purely an expedient. Moving it to a `family_settings` row later is a
 * migration plus this file.
 */

/**
 * The stored setting, as an external store rather than component state.
 *
 * `localStorage` *is* external state: reading it during render would break
 * hydration, and reading it in an effect would mean rendering the default
 * first and correcting after. `useSyncExternalStore` is the primitive for
 * exactly this — React uses `getServerSnapshot()` while hydrating and switches
 * to the stored value immediately afterwards — and it gives every mounted
 * timer surface one shared setting for free.
 */
const store = {
  setting: DEFAULT_CHIME,
  loaded: false,
  listeners: new Set<() => void>(),
};

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function getSnapshot(): ChimeSetting {
  if (!store.loaded) {
    store.loaded = true;
    try {
      const raw = window.localStorage.getItem(CHIME_STORAGE_KEY);
      if (raw) store.setting = parseChimeSetting(JSON.parse(raw));
    } catch {
      // Unparseable or unavailable storage: the default is a fine answer.
    }
  }
  // A stable reference until something writes — `useSyncExternalStore`
  // compares snapshots by identity and would loop on a fresh object.
  return store.setting;
}

function getServerSnapshot(): ChimeSetting {
  return DEFAULT_CHIME;
}

function writeSetting(next: ChimeSetting): void {
  store.setting = next;
  store.loaded = true;
  try {
    window.localStorage.setItem(CHIME_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode, quota, a locked-down kiosk profile: keep the in-memory
    // setting and move on.
  }
  for (const listener of store.listeners) listener();
}

type AudioContextConstructor = new () => AudioContext;

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const candidate = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return candidate.AudioContext ?? candidate.webkitAudioContext ?? null;
}

export type Chime = {
  setting: ChimeSetting;
  setSetting: (next: ChimeSetting) => void;
  /** Plays once. A no-op — silently — when muted or not yet armed. */
  play: () => void;
  /** Has a user gesture unlocked audio on this device yet? */
  armed: boolean;
};

export function useChime(): Chime {
  const setting = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [armed, setArmed] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const unlock = () => {
      const Constructor = audioContextConstructor();
      if (!Constructor) return;
      try {
        contextRef.current ??= new Constructor();
        void contextRef.current.resume?.();
        setArmed(true);
      } catch {
        // No audio on this device. The countdown still counts.
      }
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const setSetting = useCallback((next: ChimeSetting) => writeSetting(next), []);

  const play = useCallback(() => {
    const context = contextRef.current;
    if (!context || !isChimeAudible(setting)) return;

    try {
      const peak = chimeGain(setting);
      let at = context.currentTime + 0.01;

      for (const note of CHIME_TONE.notes) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const seconds = note.durationMs / 1000;
        const edge = CHIME_TONE.edgeMs / 1000;

        oscillator.type = 'sine';
        oscillator.frequency.value = note.frequencyHz;

        // Ramped at both ends: a square-edged gate clicks, and a click on a
        // kitchen wall reads as an alarm.
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(peak, at + edge);
        gain.gain.setValueAtTime(peak, at + seconds - edge);
        gain.gain.linearRampToValueAtTime(0, at + seconds);

        oscillator.connect(gain).connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + seconds);

        at += seconds + CHIME_TONE.gapMs / 1000;
      }
    } catch {
      // Silence is an acceptable outcome for a chime.
    }
  }, [setting]);

  return { setting, setSetting, play, armed };
}
