'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import { idleState } from '../action-state';
import { signInAction } from '../actions';

/**
 * `callbackUrl` is already sanitized by the page that renders this
 * (`(auth)/sign-in/page.tsx`) and sanitized *again* by `signInAction` before it
 * is redirected to. Two checks, because this value crosses a trust boundary
 * twice: once from the URL into the DOM, once from the DOM back into a
 * `Location` header.
 */
export function SignInForm({ callbackUrl }: { callbackUrl?: string | null }) {
  const t = useTranslations('auth');
  const [state, formAction, pending] = useActionState(signInAction, idleState);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t('signIn.title')}</h1>
        </CardTitle>
        <CardDescription>{t('signIn.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {callbackUrl ? (
            <input
              type="hidden"
              name="callbackUrl"
              value={callbackUrl}
              data-testid="callback-url"
            />
          ) : null}

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
              autoComplete="current-password"
            />
          </Field>

          {state.status === 'error' ? (
            <p role="alert" className="text-sm text-destructive">
              {t(`errors.${state.error}`)}
            </p>
          ) : null}

          <Button type="submit" size="hub" disabled={pending}>
            {t('signIn.submit')}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t('signIn.noAccount')}{' '}
            <Link href="/sign-up" className="text-brand-ink underline-offset-4 hover:underline">
              {t('signUp.title')}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
