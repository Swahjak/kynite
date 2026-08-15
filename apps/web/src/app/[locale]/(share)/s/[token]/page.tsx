import { ShareBoard, ShareGone, loadShareView } from '@/modules/sharing/view';

/**
 * `(share)/s/[token]` — the babysitter link (PRD FR24, docs/architecture.md §7
 * "Caregiver share links").
 *
 * No account, no session cookie, no session row. The URL segment *is* the
 * credential: `loadShareView` hashes it, matches the hash, and returns either a
 * scoped read or a denial. Nothing on this page reads or writes a cookie, and
 * `src/proxy.ts` refuses any non-GET request to this tree, so a Server Action
 * could not be invoked here even if one were somehow imported — which a lint
 * rule and `tests/unit/share-tree-no-server-actions.test.ts` separately prevent.
 *
 * The one import is `@/modules/sharing/view`, the slice's action-free entry
 * point. That is not stylistic: `@/modules/sharing` (the full barrel) re-exports
 * `createShareLinkAction`, and importing it here would put a mutation one hop
 * from a page that must not have one.
 */
export const dynamic = 'force-dynamic';

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadShareView(token);

  // Expired, revoked and never-existed all land here, and all render the same
  // thing. `notFound()` would be the reflex, but a 404 page carries the app's
  // chrome and a link back to a product this visitor has no account for; this
  // is the state they should see, so it is rendered rather than thrown.
  if (view.status !== 'ok') return <ShareGone />;

  return <ShareBoard token={token} view={view} />;
}
