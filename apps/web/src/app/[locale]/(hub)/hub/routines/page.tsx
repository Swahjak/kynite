import { redirect } from '@/i18n/navigation';

/**
 * Temporary redirect (2026-09-14 taken-board-routines-page plan, M1+M2).
 *
 * The family-wide board moved from here to `/hub/taken`; this route is where
 * the family-wide "Actieve routines" page lands in M3. Until that milestone
 * ships, `/hub/routines` sends a visitor straight to the board rather than
 * 404ing or rendering something that no longer exists at this path.
 * `/hub/routines/[memberId]` (a single member's own routine page) is
 * untouched by this move and keeps working exactly as it does today.
 */
export default async function HubRoutinesRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: '/hub/taken', locale });
}
