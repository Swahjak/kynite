import { SignInForm, getPrincipal } from '@/modules/family';
import { CALLBACK_URL_PARAM, sanitizeCallbackUrl, withoutLocalePrefix } from '@/lib/callback-url';
import { redirect } from '@/i18n/navigation';

/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/** Anyone who already has a scoped session has no business on this form. */
export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;

  // M18: `src/proxy.ts` puts the intended destination here when it turns a
  // cookie-less request away. Sanitized on the way in as well as on the way
  // out — a page that renders an unvalidated value into a hidden input has
  // already handed the attacker the redirect, whatever the action does later.
  const raw = query[CALLBACK_URL_PARAM];
  const callbackUrl = sanitizeCallbackUrl(Array.isArray(raw) ? raw[0] : raw);

  // A session that is already scoped goes straight where it was headed — the
  // form has nothing to ask it.
  if (await getPrincipal()) {
    redirect({ href: callbackUrl ? withoutLocalePrefix(callbackUrl) : '/family', locale });
  }

  return <SignInForm callbackUrl={callbackUrl} />;
}
