'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
} from '@kynite/ui';
import { Link } from '@/i18n/navigation';
import { idleState } from '../action-state';
import { signInAction } from '../actions';
import { AuthDivider, GoogleSignInButton } from './google-sign-in-button';

/**
 * `callbackUrl` is already sanitized by the page that renders this
 * (`(auth)/sign-in/page.tsx`) and sanitized *again* by `signInAction` before it
 * is redirected to. Two checks, because this value crosses a trust boundary
 * twice: once from the URL into the DOM, once from the DOM back into a
 * `Location` header.
 *
 * M19 phase 2 restyles this to the stitch card idiom (24px radius, level-2
 * elevation, the brand type scale rather than a generic `text-xl`/`text-sm`) —
 * docs/rebuild-design-gaps.md §8 called auth "literal M01 scaffold on stock
 * shadcn". The primitives are unchanged: it is the same `Card`/`Field`/`Input`
 * composition, wearing the design system it always should have had.
 *
 * Google comes **first**, above the rule. It is the one-tap path, and burying it
 * under a form the user does not need to fill in inverts the effort.
 */
export function SignInForm({
  callbackUrl,
  socialEnabled = false,
  oauthError = null,
}: {
  callbackUrl?: string | null;
  socialEnabled?: boolean;
  /** A translation key under `auth.errors`, set when the OAuth callback bounced. */
  oauthError?: string | null;
}) {
  const t = useTranslations('auth');
  const [state, formAction, pending] = useActionState(signInAction, idleState);

  return (
    <Card className="w-full max-w-md gap-6 rounded-2xl p-2 shadow-lg">
      <CardHeader>
        <CardTitle>
          <h1 className="font-display text-h1">{t('signIn.title')}</h1>
        </CardTitle>
        <CardDescription className="text-body">{t('signIn.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {oauthError ? (
          <p
            role="alert"
            data-testid="oauth-error"
            className="bg-destructive/10 text-body-sm text-destructive rounded-lg px-3 py-2"
          >
            {t(`errors.${oauthError}`)}
          </p>
        ) : null}

        {socialEnabled ? (
          <>
            <GoogleSignInButton callbackUrl={callbackUrl} />
            <AuthDivider label={t('or')} />
          </>
        ) : null}

        <form action={formAction} className="flex flex-col gap-5">
          {callbackUrl ? (
            <input
              type="hidden"
              name="callbackUrl"
              value={callbackUrl}
              data-testid="callback-url"
            />
          ) : null}

          <Field>
            <FieldLabel className="font-display font-semibold">{t('fields.email')}</FieldLabel>
            <Input name="email" type="email" size="hub" required autoComplete="email" />
          </Field>

          <Field>
            <FieldLabel className="font-display font-semibold">{t('fields.password')}</FieldLabel>
            <Input
              name="password"
              type="password"
              size="hub"
              required
              autoComplete="current-password"
            />
          </Field>

          {state.status === 'error' ? (
            <p role="alert" className="text-body-sm text-destructive">
              {t(`errors.${state.error}`)}
            </p>
          ) : null}

          <Button type="submit" size="hub" disabled={pending} className="w-full">
            {t('signIn.submit')}
          </Button>

          <p className="text-body-sm text-ink-secondary text-center">
            {t('signIn.noAccount')}{' '}
            <Link
              href="/sign-up"
              className="text-brand-ink font-semibold underline-offset-4 hover:underline"
            >
              {t('signUp.title')}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
