'use client';

import { useActionState, useId, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { locales } from '@/i18n/routing';
import { idleState } from '../action-state';
import { updateFamilyAction } from '../actions';
import type { Family } from '../schema';

/** ISO-8601 weekday numbers. Two options, because those are the two answers. */
const WEEK_STARTS = [1, 7] as const;

/**
 * The household's own settings (M16): name, language, clock, week start.
 *
 * Rendered only for an owner — `loadFamilySettings` resolves `family:manage`
 * and the settings page omits the whole section otherwise, rather than showing
 * a form whose submit would be refused.
 *
 * The timezone control is a text input backed by a `<datalist>` of the
 * platform's own zone list rather than a 600-item `Select`. Two reasons: a
 * combobox that filters as you type is the only usable shape at that length,
 * and `Intl.supportedValuesOf` is exactly the list the server validates
 * against (`isKnownTimeZone`), so the two cannot drift. A browser without
 * `supportedValuesOf` degrades to a plain text field, which still submits a
 * valid zone — the server, not this list, is what decides.
 */
export function FamilySettingsForm({ family }: { family: Family }) {
  const t = useTranslations('settings.family');
  const [state, formAction, pending] = useActionState(updateFamilyAction, idleState);
  const zoneListId = useId();

  const zones = useMemo(() => {
    const supported = Intl.supportedValuesOf?.('timeZone') ?? [];
    // The family's current zone first and always present: a runtime whose ICU
    // build has dropped a zone must not make the field look invalid.
    return [...new Set([family.timezone, ...supported])];
  }, [family.timezone]);

  return (
    <form action={formAction} className="flex flex-col gap-4" data-testid="family-settings-form">
      <Field>
        <FieldLabel>{t('name')}</FieldLabel>
        <Input
          name="name"
          size="hub"
          required
          maxLength={80}
          defaultValue={family.name}
          autoComplete="off"
          data-testid="family-name"
        />
      </Field>

      <Field>
        <FieldLabel>{t('locale')}</FieldLabel>
        <Select name="locale" defaultValue={family.locale}>
          <SelectTrigger size="hub" data-testid="family-locale">
            {/* Base UI shows the raw value unless the label is formatted here,
                and the raw value is a locale code. */}
            <SelectValue>
              {(value: string) => t(`locales.${value === 'en' ? 'en' : 'nl'}`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {locales.map((locale) => (
              <SelectItem key={locale} value={locale}>
                {t(`locales.${locale}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>{t('localeHint')}</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>{t('timezone')}</FieldLabel>
        <Input
          name="timezone"
          size="hub"
          required
          list={zoneListId}
          defaultValue={family.timezone}
          autoComplete="off"
          data-testid="family-timezone"
        />
        <datalist id={zoneListId}>
          {zones.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
        <FieldDescription>{t('timezoneHint')}</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>{t('weekStartsOn')}</FieldLabel>
        <Select name="weekStartsOn" defaultValue={String(family.weekStartsOn)}>
          <SelectTrigger size="hub" data-testid="family-week-start">
            <SelectValue>
              {(value: string) => t(`weekdays.${value === '7' ? '7' : '1'}`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {WEEK_STARTS.map((day) => (
              <SelectItem key={day} value={String(day)}>
                {t(`weekdays.${day}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" size="hub" disabled={pending} data-testid="save-family-settings">
          {t('save')}
        </Button>
        {state.status === 'error' ? (
          <span role="alert" className="text-sm text-destructive">
            {t(`errors.${state.error}`)}
          </span>
        ) : null}
      </div>
    </form>
  );
}
