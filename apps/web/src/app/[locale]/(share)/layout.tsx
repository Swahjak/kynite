import type { Metadata } from 'next';

/**
 * The caregiver surface's shell (docs/architecture.md §2: "`(share)` separate
 * from both — no session at all; must be impossible to reach a mutation from
 * this tree").
 *
 * Three things it deliberately does **not** do, each of which every other route
 * group does:
 *
 *  1. **No `getPrincipal()`.** No cookie is read here, so none can be written
 *     back. The principal for this tree comes from the URL token and nowhere
 *     else (`modules/sharing/resolve.ts`).
 *  2. **No `RealtimeProvider`.** The SSE stream is family-scoped and
 *     session-authenticated; opening one for an anonymous link holder would
 *     hand them a live feed of every family event, scope or no scope.
 *  3. **No navigation.** There is nowhere else in the app this visitor may go.
 *     A nav bar on a share page is an invitation to a sign-in wall.
 *
 * `robots: noindex, nofollow` is now set app-wide in `[locale]/layout.tsx`
 * (personal-use deployment); this layout still needs `referrer: no-referrer`
 * of its own — the token is in the path, so a leaked `Referer` is a leaked
 * bearer credential specifically for this tree. The HTTP half of both
 * (`X-Robots-Tag` and `Referrer-Policy: no-referrer`) is set in
 * `src/proxy.ts`, because a `<meta>` tag does not reach a crawler that only
 * looks at headers and does nothing at all about a leaked `Referer`.
 */
export const metadata: Metadata = {
  referrer: 'no-referrer',
};

/** A URL-scoped principal is per-request by definition; never prerender it. */
export const dynamic = 'force-dynamic';

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
}
