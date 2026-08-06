'use client';

import Image from 'next/image';
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { FieldGroupLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { MEMBER_AVATARS, avatarUrlFor, type MemberAvatar } from './tokens';

/** Built-in avatar picker. Kiosk-sized targets; empty selection falls back to initials. */
export function AvatarPicker({
  name = 'avatarUrl',
  defaultValue = null,
}: {
  name?: string;
  defaultValue?: MemberAvatar | null;
}) {
  const t = useTranslations('family.form');
  const [value, setValue] = useState<MemberAvatar | null>(defaultValue);
  const labelId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <FieldGroupLabel id={labelId}>{t('avatar')}</FieldGroupLabel>
      <input type="hidden" name={name} value={value ? avatarUrlFor(value) : ''} />
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {MEMBER_AVATARS.map((avatar) => (
          <Button
            key={avatar}
            type="button"
            variant="outline"
            size="icon-hub"
            aria-pressed={value === avatar}
            aria-label={t(`avatars.${avatar}`)}
            onClick={() => setValue(value === avatar ? null : avatar)}
            className={cn('p-1', value === avatar && 'border-ring ring-3 ring-ring/50')}
          >
            <Image src={avatarUrlFor(avatar)} alt="" width={32} height={32} aria-hidden />
          </Button>
        ))}
      </div>
    </div>
  );
}
