import { fileURLToPath } from 'node:url';

/**
 * Where the per-surface storage states live.
 *
 * Resolved from this file rather than `process.cwd()` so the paths are the
 * same whether Playwright was started from the repo root or from an editor.
 * `.auth/` is gitignored: these files carry real session cookies for the
 * throwaway e2e database and are rewritten on every run by the `setup`
 * project.
 */
const authDir = fileURLToPath(new URL('../.auth/', import.meta.url));

export const APP_STORAGE_STATE = `${authDir}app.json`;
export const HUB_STORAGE_STATE = `${authDir}hub.json`;
export const SHARE_STORAGE_STATE = `${authDir}share.json`;
