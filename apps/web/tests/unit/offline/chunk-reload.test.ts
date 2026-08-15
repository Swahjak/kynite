import { describe, expect, it } from 'vitest';
import {
  CHUNK_RELOAD_COOLDOWN_MS,
  CHUNK_RELOAD_KEY,
  isChunkLoadError,
  shouldReloadForChunkError,
} from '@/components/offline/chunk-reload';

/**
 * The one error the kiosk boundary answers with a full page load
 * (`components/offline/chunk-reload.ts`).
 *
 * Two claims, and they pull against each other: a board holding a retired
 * build must get itself onto the new one, and a board holding a genuinely
 * broken build must *not* reload in a loop in a hallway. So the tests are
 * about the boundary between those — what counts as a missing chunk, and what
 * the second failure does.
 */

function memoryStorage(seed: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> & {
  read(): Record<string, string>;
} {
  const store: Record<string, string> = { ...seed };
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = value;
    },
    read: () => store,
  };
}

describe('isChunkLoadError', () => {
  it.each([
    ['webpack/turbopack', Object.assign(new Error('Loading chunk 4821 failed.'), {})],
    ['error name', Object.assign(new Error('boom'), { name: 'ChunkLoadError' })],
    ['chrome import()', new Error('Failed to fetch dynamically imported module: /_next/x.js')],
    ['firefox import()', new Error('error loading dynamically imported module')],
    ['safari import()', new Error('Importing a module script failed.')],
  ])('recognises %s', (_label, error) => {
    expect(isChunkLoadError(error)).toBe(true);
  });

  it.each([
    ['an ordinary render bug', new TypeError('srLabel is not a function')],
    ['a failed fetch', new TypeError('Failed to fetch')],
    ['nothing at all', undefined],
    ['a string', 'ChunkLoadError'.slice(0, 0)],
  ])('leaves %s to the retry screen', (_label, error) => {
    expect(isChunkLoadError(error)).toBe(false);
  });
});

describe('shouldReloadForChunkError', () => {
  const chunkError = Object.assign(new Error('boom'), { name: 'ChunkLoadError' });
  const now = new Date('2026-01-02T09:00:00Z');

  it('reloads a board whose build was retired mid-session', () => {
    const storage = memoryStorage();
    expect(shouldReloadForChunkError({ error: chunkError, now, storage })).toBe(true);
    expect(storage.read()[CHUNK_RELOAD_KEY]).toBe(String(now.getTime()));
  });

  it('never reloads for an ordinary error, and does not spend the guard on one', () => {
    const storage = memoryStorage();
    const error = new TypeError('srLabel is not a function');
    expect(shouldReloadForChunkError({ error, now, storage })).toBe(false);
    expect(storage.read()[CHUNK_RELOAD_KEY]).toBeUndefined();
  });

  it('refuses a second reload inside the cooldown — a broken build must not loop', () => {
    const storage = memoryStorage({ [CHUNK_RELOAD_KEY]: String(now.getTime()) });
    const soon = new Date(now.getTime() + CHUNK_RELOAD_COOLDOWN_MS - 1);
    expect(shouldReloadForChunkError({ error: chunkError, now: soon, storage })).toBe(false);
  });

  it('allows the next deploy its own reload once the cooldown has passed', () => {
    const storage = memoryStorage({ [CHUNK_RELOAD_KEY]: String(now.getTime()) });
    const later = new Date(now.getTime() + CHUNK_RELOAD_COOLDOWN_MS);
    expect(shouldReloadForChunkError({ error: chunkError, now: later, storage })).toBe(true);
    expect(storage.read()[CHUNK_RELOAD_KEY]).toBe(String(later.getTime()));
  });

  it('still grants the one reload when there is no storage to remember it', () => {
    expect(shouldReloadForChunkError({ error: chunkError, now, storage: null })).toBe(true);
  });
});
