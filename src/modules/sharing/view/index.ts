/**
 * The **action-free** public surface of the sharing slice — the only module
 * the `(share)` route tree imports.
 *
 * Why this exists next to `../index.ts` rather than inside it: a slice barrel
 * re-exports that slice's Server Actions and the client components that call
 * them, and `(share)` may import **zero** Server Actions, transitively
 * (docs/architecture.md §2, M13's binding criterion, enforced by a lint rule in
 * `eslint.config.mjs` and by
 * `tests/unit/share-tree-no-server-actions.test.ts`). One barrel cannot be both
 * the parent's management surface and a tree whose defining property is that it
 * cannot mutate anything. So the slice has two entry points and the narrower
 * one is the public one: `../index.ts` re-exports everything here, never the
 * reverse.
 *
 * Nothing in this file's import closure carries a `'use server'` directive, and
 * that is a *tested* property, not a convention.
 */

export { loadShareView, SHARE_WINDOW_DAYS } from './load';
export type {
  ShareDay,
  ShareEvent,
  ShareMember,
  ShareRoutine,
  ShareStep,
  ShareView,
  ShareViewResult,
} from './load';

export { resolveShareLink, type ShareDenial, type ShareResolution } from '../resolve';

export {
  SHARE_SURFACES,
  SHARE_SURFACE_CHOICES,
  coversCalendar,
  coversMember,
  isShareSurface,
  normalizeScope,
  opensSurface,
  shareLinkStateOf,
  shouldCountShareUse,
  type ShareLinkScope,
  type ShareLinkState,
  type ShareSurface,
} from '../domain/scope';

export { ShareBoard } from './share-board';
export { ShareGone } from './share-gone';
export { ShareStepButton } from './share-step-button';
