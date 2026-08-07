import { SignInForm, getPrincipal } from '@/modules/family';
import { redirect } from '@/i18n/navigation';

/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/** Anyone who already has a scoped session has no business on this form. */
export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (await getPrincipal()) redirect({ href: '/family', locale });

  return <SignInForm />;
}
