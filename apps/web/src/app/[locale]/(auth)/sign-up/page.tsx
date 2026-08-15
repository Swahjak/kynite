import { SignUpForm, getPrincipal } from '@/modules/family';
import { redirect } from '@/i18n/navigation';
import { isSocialSignInConfigured } from '@/server/auth';

/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/** Anyone who already has a scoped session has no business on this form. */
export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (await getPrincipal()) redirect({ href: '/family', locale });

  // M19 phase 2. Sign-up and sign-in offer Google through the *same* action:
  // better-auth's social endpoint signs an existing account in and registers a
  // new one from one round trip, so "sign up with Google" and "sign in with
  // Google" are the same button with the same label. What differs is where they
  // land afterwards, and that is decided by `newUserCallbackURL`, not here.
  return <SignUpForm socialEnabled={isSocialSignInConfigured()} />;
}
