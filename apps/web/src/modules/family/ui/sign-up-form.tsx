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
  FieldDescription,
  FieldLabel,
  Input,
} from '@kynite/ui';
import { Link } from '@/i18n/navigation';
import { idleState } from '../action-state';
import { signUpAction } from '../actions';
import { AuthDivider, GoogleSignInButton } from './google-sign-in-button';

/**
 * First run: one form creates the account, the family and the owner member.
 *
 * The Google path above the rule reaches the same destination by a different
 * route — it cannot ask for a family name (there is nothing to ask on Google's
 * consent screen), so `(auth)/onboarding` asks for it on the way back. Two
 * shapes, one outcome: an account with exactly one household it owns.
 *
 * Restyled to the stitch card idiom in M19 phase 2 (docs/rebuild-design-gaps.md
 * §8); the primitives and the field set are unchanged.
 */
export function SignUpForm({ socialEnabled = false }: { socialEnabled?: boolean }) {
  const t = useTranslations('auth');
  const [state, formAction, pending] = useActionState(signUpAction, idleState);

  return (
    <Card className="w-full max-w-md gap-6 rounded-2xl p-2 shadow-lg">
      <CardHeader>
        <CardTitle>
          <h1 className="font-display text-h1">{t('signUp.title')}</h1>
        </CardTitle>
        <CardDescription className="text-body">{t('signUp.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {socialEnabled ? (
          <>
            <GoogleSignInButton />
            <AuthDivider label={t('or')} />
          </>
        ) : null}

        <form action={formAction} className="flex flex-col gap-5">
          <Field>
            <FieldLabel className="font-display font-semibold">{t('fields.name')}</FieldLabel>
            <Input name="name" size="hub" required maxLength={80} autoComplete="name" />
          </Field>

          <Field>
            <FieldLabel className="font-display font-semibold">{t('fields.familyName')}</FieldLabel>
            <Input name="familyName" size="hub" required maxLength={80} autoComplete="off" />
            <FieldDescription>{t('fields.familyNameHint')}</FieldDescription>
          </Field>

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
              minLength={8}
              autoComplete="new-password"
            />
            <FieldDescription>{t('fields.passwordHint')}</FieldDescription>
          </Field>

          {state.status === 'error' ? (
            <p role="alert" className="text-body-sm text-destructive">
              {t(`errors.${state.error}`)}
            </p>
          ) : null}

          <Button type="submit" size="hub" disabled={pending} className="w-full">
            {t('signUp.submit')}
          </Button>

          <p className="text-body-sm text-ink-secondary text-center">
            {t('signUp.haveAccount')}{' '}
            <Link
              href="/sign-in"
              className="text-brand-ink font-semibold underline-offset-4 hover:underline"
            >
              {t('signIn.title')}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
