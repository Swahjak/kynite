'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Field, FieldDescription, FieldLabel, Input } from '@kynite/ui';
import { useActionToast } from '@/components/ui/use-action-toast';
import { idleState } from '../action-state';
import { setWeatherLocationAction } from '../actions';

export type WeatherLocationFormProps = {
  latitude: number | null;
  longitude: number | null;
  label: string | null;
};

/**
 * Where the household's weather is for (settings hub).
 *
 * Same `useActionState` contract as `HubDisplayForm`: `setWeatherLocationAction`
 * reads `latitude`/`longitude`/`label` FormData, and an empty latitude switches
 * the weather off. "Gebruik mijn locatie" is a client-only convenience that
 * fills the two number inputs from `navigator.geolocation` — it never submits
 * on its own, the parent still presses save.
 */
export function WeatherLocationForm({ latitude, longitude, label }: WeatherLocationFormProps) {
  const t = useTranslations('settings.weather');
  const tCommon = useTranslations('common');
  const [state, formAction, pending] = useActionState(setWeatherLocationAction, idleState);
  useActionToast(state, pending, { success: tCommon('saved') });

  const [lat, setLat] = useState(latitude !== null ? String(latitude) : '');
  const [lng, setLng] = useState(longitude !== null ? String(longitude) : '');
  const hasGeolocation = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition((position) => {
      setLat(String(position.coords.latitude));
      setLng(String(position.coords.longitude));
    });
  };

  return (
    <form action={formAction} className="flex flex-col gap-4" data-testid="weather-location-form">
      <Field>
        <FieldLabel>{t('latitude')}</FieldLabel>
        <Input
          type="number"
          step="any"
          name="latitude"
          value={lat}
          onChange={(event) => setLat(event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel>{t('longitude')}</FieldLabel>
        <Input
          type="number"
          step="any"
          name="longitude"
          value={lng}
          onChange={(event) => setLng(event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel>{t('label')}</FieldLabel>
        <Input type="text" name="label" maxLength={40} defaultValue={label ?? ''} />
        <FieldDescription>{t('hint')}</FieldDescription>
      </Field>

      {hasGeolocation ? (
        <Button type="button" variant="outline" onClick={useMyLocation}>
          {t('useMyLocation')}
        </Button>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} data-testid="save-weather-location">
          {t('save')}
        </Button>
        {state.status === 'error' ? (
          <span role="alert" className="text-body-sm text-destructive">
            {t(`errors.${state.error}`)}
          </span>
        ) : null}
      </div>
    </form>
  );
}
