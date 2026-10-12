import { redirect } from '@/i18n/navigation';
import { can, getPrincipal } from '@/modules/family';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The one gate in front of every `/manage/*` page (D10, H4 review).
 *
 * `(app)/layout.tsx` only requires *a member*; Beheer is for a member who may
 * manage, and `routine:write` is the least-privileged owner/adult capability
 * (the same stand-in the nav uses for "may manage"). Without this, a child who
 * typed `/manage/rewards` would read every sibling's star total. The index page
 * keeps its own copy of the check so it stays safe on its own.
 *
 * A device goes to its board, nobody to sign-in, a member without the right to
 * the board. A member's *own* settings live outside this tree at `/account`.
 */
export default async function ManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const principal = await getPrincipal();

  if (principal?.kind === 'device') redirect({ href: '/today', locale });
  if (principal?.kind !== 'member') redirect({ href: '/sign-in', locale });
  // `redirect()` is not typed `never` in next-intl's wrapper; restate the narrowing.
  if (principal?.kind !== 'member') return null;
  if (!can(principal, 'routine:write', { familyId: principal.familyId })) {
    redirect({ href: '/today', locale });
  }

  return children;
}
