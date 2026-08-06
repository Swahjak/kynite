'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { signOutAction } from '../actions';

export function SignOutButton() {
  const t = useTranslations('auth');

  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="hub">
        {t('signOut')}
      </Button>
    </form>
  );
}
