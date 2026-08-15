'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { idleState } from '../action-state';
import { createFamilyForSocialUserAction } from '../actions';

/**
 * The second half of a social sign-up: name the household (M19 phase 2).
 *
 * One field, because everything else a first-run account needs has already been
 * answered — the name and the email came from Google, and the credential is the
 * Google account itself. The email/password path asks for all four on one form
 * (`SignUpForm`); this path asks for the one that Google cannot supply.
 *
 * There is no "skip": a member with no family resolves to no principal at all
 * (`modules/family/principal.ts`), so an account that leaves this screen without
 * a household has nowhere in the app it can go.
 */
export function CreateFamilyForm({ displayName }: { displayName: string }) {
  const t = useTranslations('auth');
  const [state, formAction, pending] = useActionState(createFamilyForSocialUserAction, idleState);

  return (
    <Card className="w-full max-w-md gap-6 rounded-2xl p-2 shadow-lg">
      <CardHeader>
        <CardTitle>
          <h1 className="font-display text-h1">{t('onboarding.title')}</h1>
        </CardTitle>
        <CardDescription className="text-body">
          {t('onboarding.description', { name: displayName })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          <Field>
            <FieldLabel className="font-display font-semibold">{t('fields.familyName')}</FieldLabel>
            <Input
              name="familyName"
              size="hub"
              required
              maxLength={80}
              autoComplete="off"
              autoFocus
            />
            <FieldDescription>{t('fields.familyNameHint')}</FieldDescription>
          </Field>

          {state.status === 'error' ? (
            <p role="alert" className="text-body-sm text-destructive">
              {t(`errors.${state.error}`)}
            </p>
          ) : null}

          <Button type="submit" size="hub" disabled={pending} className="w-full">
            {t('onboarding.submit')}
          </Button>

          <p className="text-body-sm text-ink-secondary text-center">{t('onboarding.hint')}</p>
        </form>
      </CardContent>
    </Card>
  );
}
