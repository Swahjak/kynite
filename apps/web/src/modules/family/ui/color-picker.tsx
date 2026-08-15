'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, cn, FieldGroupLabel } from '@kynite/ui';
import { MEMBER_COLORS, type MemberColor } from '../schema';
import { MEMBER_COLOR_CLASSES } from './tokens';

/** Eight-color picker — a member owns their color across every surface. */
export function ColorPicker({
  name = 'color',
  defaultValue = 'blue',
}: {
  name?: string;
  defaultValue?: MemberColor;
}) {
  const t = useTranslations('family.form');
  const [value, setValue] = useState<MemberColor>(defaultValue);
  const labelId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <FieldGroupLabel id={labelId}>{t('color')}</FieldGroupLabel>
      <input type="hidden" name={name} value={value} />
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {MEMBER_COLORS.map((color) => (
          <Button
            key={color}
            type="button"
            variant="outline"
            size="icon-hub"
            aria-pressed={value === color}
            aria-label={t(`colors.${color}`)}
            onClick={() => setValue(color)}
            className={cn(value === color && 'border-ring ring-3 ring-ring/50')}
          >
            <span
              aria-hidden
              className={cn('size-6 rounded-full', MEMBER_COLOR_CLASSES[color].dot)}
            />
          </Button>
        ))}
      </div>
    </div>
  );
}
