import { redirect } from '@/i18n/navigation';
import { getPrincipal } from '@/modules/family';

/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/**
 * Sign-in / sign-up shell. Anyone who already has a scoped session is bounced
 * into the app: an authenticated user has no business on these screens.
 */
export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const principal = await getPrincipal();

  if (principal) redirect({ href: '/family', locale });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      {children}
    </main>
  );
}
