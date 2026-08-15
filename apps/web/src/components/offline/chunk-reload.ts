/**
 * Recovering from a chunk that no longer exists (docs/architecture.md §6,
 * "Long-run hygiene").
 *
 * A wall tablet keeps one document open for weeks. When a deploy lands, the
 * container it is talking to stops serving the build that document came from:
 * every `/_next/static/chunks/<hash>.js` it has not fetched yet is gone from
 * the origin, and the service worker's precache drops the same files the
 * moment the new worker activates. The next lazy import on that page — a
 * route the board navigates to at 07:30 — therefore fails.
 *
 * That failure is the one class of error the kiosk boundary cannot repair.
 * `reset()` re-renders the same segment from the same broken module graph, so
 * it fails again, five seconds later, and again, for as long as the board
 * stays on that build. The only repair is a full document load, which fetches
 * the new HTML and with it the new chunk names.
 *
 * So: classify, then reload **once**. The classifier is deliberately narrow —
 * an ordinary render bug must keep the calm retry screen rather than putting a
 * tablet into a reload loop — and the once-per-window guard is what makes a
 * genuinely unbootable build degrade to the retry screen instead of to a
 * flashing wall.
 *
 * Pure over an injected `Storage` and an injected reload so the rule can be
 * tested without a browser; the React side is `(hub)/error.tsx`.
 */

/**
 * What a missing chunk looks like across the engines this ships to.
 *
 * Turbopack and webpack both surface a failed chunk fetch as `ChunkLoadError`
 * / "Loading chunk … failed"; a native `import()` of a URL that 404s surfaces
 * as one of the "dynamically imported module" phrasings (Chrome, Safari and
 * Firefox each word it differently, hence the alternation).
 */
const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk [^ ]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

/** Where the last self-reload is remembered. Session-scoped: a fresh tab starts clean. */
export const CHUNK_RELOAD_KEY = 'kynite:hub-chunk-reload-at';

/**
 * How long one recovery reload suppresses the next.
 *
 * Long enough that a build which is broken for a reason *other* than a stale
 * chunk cannot loop (the second failure falls through to the retry screen),
 * short enough that two deploys in one afternoon both reach the wall.
 */
export const CHUNK_RELOAD_COOLDOWN_MS = 10 * 60_000;

/** `true` when this error is a module that failed to load, not a render bug. */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const candidate = error as { name?: unknown; message?: unknown };
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return CHUNK_ERROR_PATTERN.test(name) || CHUNK_ERROR_PATTERN.test(message);
}

export type ChunkRecoveryInput = {
  error: unknown;
  now?: Date;
  /** `sessionStorage` in the browser; omitted (or unavailable) means "no memory, allow one". */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
};

/**
 * Whether this error should be answered with a full page load.
 *
 * Records the decision in `storage` as a side effect, so a caller that reloads
 * on `true` cannot loop: the reloaded page's next chunk error inside the
 * cooldown answers `false` and gets the ordinary retry screen.
 */
export function shouldReloadForChunkError(input: ChunkRecoveryInput): boolean {
  if (!isChunkLoadError(input.error)) return false;

  const now = input.now ?? new Date();
  const storage = input.storage;
  if (!storage) return true;

  try {
    const previous = Number(storage.getItem(CHUNK_RELOAD_KEY) ?? '');
    if (Number.isFinite(previous) && previous > 0) {
      if (now.getTime() - previous < CHUNK_RELOAD_COOLDOWN_MS) return false;
    }
    storage.setItem(CHUNK_RELOAD_KEY, String(now.getTime()));
  } catch {
    // A tablet with storage disabled still deserves its one reload.
    return true;
  }

  return true;
}
