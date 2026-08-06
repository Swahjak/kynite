'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import { idleState } from '../action-state';
import { signUpAction } from '../actions';

/** First run: one form creates the account, the family and the owner member. */
export function SignUpForm() {
  const t = useTranslations('auth');
  const [state, formAction, pending] = useActionState(signUpAction, idleState);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t('signUp.title')}</h1>
        </CardTitle>
        <CardDescription>{t('signUp.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <Field>
            <FieldLabel>{t('fields.name')}</FieldLabel>
            <Input name="name" size="hub" required maxLength={80} autoComplete="name" />
          </Field>

          <Field>
            <FieldLabel>{t('fields.familyName')}</FieldLabel>
            <Input name="familyName" size="hub" required maxLength={80} autoComplete="off" />
            <FieldDescription>{t('fields.familyNameHint')}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>{t('fields.email')}</FieldLabel>
            <Input name="email" type="email" size="hub" required autoComplete="email" />
          </Field>

          <Field>
            <FieldLabel>{t('fields.password')}</FieldLabel>
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
            <p role="alert" className="text-sm text-destructive">
              {t(`errors.${state.error}`)}
            </p>
          ) : null}

          <Button type="submit" size="hub" disabled={pending}>
            {t('signUp.submit')}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t('signUp.haveAccount')}{' '}
            <Link href="/sign-in" className="text-brand-ink underline-offset-4 hover:underline">
              {t('signIn.title')}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
