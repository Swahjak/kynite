/**
 * Public surface of the sharing slice (docs/architecture.md §2).
 * Cross-module imports go through this file only — with one exception, and it
 * is the exception the whole milestone turns on.
 *
 * This barrel re-exports the slice's Server Actions and the client components
 * that call them, which is what every other slice's barrel does and what
 * `(app)/settings/sharing` needs. The `(share)` route tree may import **zero**
 * Server Actions, transitively, so it does *not* import this file: it imports
 * `@/modules/sharing/view`, the action-free entry point, which this barrel
 * re-exports from. The dependency runs one way only — `./view` never imports
 * anything from here — which is what makes the transitive scan in
 * `tests/unit/share-tree-no-server-actions.test.ts` provable rather than
 * hopeful.
 */

export { SHARE_ROLES, shareLink, shareRole, type ShareLink, type ShareLinkRole } from './schema';

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
} from './domain/scope';

export { qrPathFor, qrSymbolFor, qrViewBoxSize, QR_QUIET_ZONE, type QrSymbol } from './domain/qr';

export {
  createShareLink,
  listShareLinks,
  recordShareUse,
  revokeShareLink,
  type CreateShareLinkResult,
  type ShareLinkListEntry,
} from './queries';

export { resolveShareLink, type ShareDenial, type ShareResolution } from './resolve';

export {
  actionFailure,
  createShareLinkFailure,
  createShareLinkIdle,
  idleState,
  type ActionState,
  type CreateShareLinkState,
} from './action-state';

export {
  createShareLinkAction,
  revokeShareLinkAction,
  type CreateShareLinkInput,
  type RevokeShareLinkInput,
} from './actions';

export { loadSharingPage, type SharingPageData, type ShareLinkView } from './page-data';

export { CreateShareLinkPanel } from './ui/create-share-link-panel';
export { ShareLinkList } from './ui/share-link-list';
export { ShareQr } from './ui/share-qr';

export {
  ShareBoard,
  ShareGone,
  ShareStepButton,
  SHARE_WINDOW_DAYS,
  loadShareView,
  type ShareDay,
  type ShareEvent,
  type ShareMember,
  type ShareRoutine,
  type ShareStep,
  type ShareView,
  type ShareViewResult,
} from './view';
