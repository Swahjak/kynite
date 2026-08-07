import 'server-only';
import { redirect } from '@/i18n/navigation';
import { getPrincipal, type Principal } from '@/modules/family';

/**
 * The `(hub)` tree's authorization gate (M12).
 *
 * Called at the top of every hub page rather than once in the layout, and that
 * is deliberate: Next.js layouts are not re-rendered on client-side
 * navigations, so a check placed there runs on the first full page load and
 * then never again for the rest of the session. On a wall tablet that never
 * reloads for months, "never again" is the whole lifetime of the device. An
 * auth boundary has to sit on the segment that actually re-renders.
 *
 * Two ways to fail, two different answers:
 *
 *  - **no principal at all** — an unpaired tablet, or one whose device was
 *    revoked (`getPrincipal()` joins `revoked_at is null`, so revocation lands
 *    on the very next request). It goes to the pair screen, which is the only
 *    thing it can usefully do.
 *  - **a member principal** — a signed-in parent who typed `/hub`. They are
 *    sent to their own surface instead. Showing them the board would mean an
 *    owner-level session rendering the kiosk, which is exactly the state M12
 *    exists to end (§7: "a wall tablet is physically unauthenticated").
 */
export async function requireHubDevice(locale: string): Promise<Principal> {
  const principal = await getPrincipal();

  if (principal?.kind === 'device') return principal;

  if (principal?.kind === 'member') redirect({ href: '/today', locale });
  redirect({ href: '/hub/pair', locale });

  // `redirect()` throws; next-intl's wrapper is not typed `never`.
  throw new Error('unreachable');
}
