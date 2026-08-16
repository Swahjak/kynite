'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { assertCan } from '@/modules/family';
import { getDb } from '@/server/db';
// Tables from the schema assembly point, not a slice barrel: a barrel
// re-exports client components, which must not enter a server mutation module.
import { family } from '@/server/db/schema';
import { actionFailure as failure, idleState, type ActionState } from './action-state';
import { weatherPlaceOf } from './domain/snapshot';
import { enqueueWeatherRefresh } from './jobs';

/**
 * Where the household's weather is for.
 *
 * `display:manage`, not `family:manage` — the same capability as
 * `setHubDisplayAction`, and for the same reason: this configures what the wall
 * shows, which is the half of settings that changes nothing about who the
 * household *is*. PRD FR28 says parents configure the hub, plural.
 *
 * The form contract is deliberately the one the existing settings forms
 * already use — a `useActionState` action over `FormData`, `ActionState` out,
 * `revalidatePath` on the surfaces that read it — so a future settings field
 * is three inputs in an existing form rather than a new mechanism. Nothing
 * here renders anything; the UI is not built yet on purpose.
 *
 * **Latitude/longitude, no city name.** Open-Meteo takes coordinates, and a
 * name stored here would only be a geocode waiting to disagree with them. The
 * label is the family's own word for the spot and is never used to look
 * anything up.
 */

const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  /** "Thuis", "Oma". Optional — an unlabelled location is a normal one. */
  label: z
    .string()
    .trim()
    .max(40)
    .transform((value) => (value.length > 0 ? value : null))
    .nullable(),
});

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function setWeatherLocationAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('display:manage').catch(() => null);
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  // An empty latitude means "switch weather off" — the same field, cleared,
  // rather than a separate toggle that could disagree with the coordinates.
  const rawLatitude = read(formData, 'latitude').trim();
  const rawLongitude = read(formData, 'longitude').trim();

  if (rawLatitude === '' && rawLongitude === '') {
    await clearLocation(principal.familyId);
    await revalidateWeatherSurfaces();
    return idleState;
  }

  const parsed = locationSchema.safeParse({
    latitude: rawLatitude,
    longitude: rawLongitude,
    label: read(formData, 'label'),
  });
  if (!parsed.success) return failure('invalidInput');

  const place = weatherPlaceOf(parsed.data);
  if (!place) return failure('invalidInput');

  await getDb()
    .update(family)
    .set({
      weatherLatitude: place.latitude,
      weatherLongitude: place.longitude,
      weatherLocationLabel: place.label ?? null,
      updatedAt: new Date(),
    })
    .where(eq(family.id, principal.familyId));

  // Fetch now rather than at the next half-hourly sweep: a parent who has just
  // typed their coordinates should not watch an empty widget for 25 minutes.
  // `force` skips the cache-hit check, which the *old* location's still-fresh
  // row would otherwise win. Enqueued, not awaited — a provider that is slow
  // must not make saving a setting slow.
  await enqueueWeatherRefresh(principal.familyId, { force: true }).catch(() => null);

  await revalidateWeatherSurfaces();
  return idleState;
}

async function clearLocation(familyId: string): Promise<void> {
  await getDb()
    .update(family)
    .set({
      weatherLatitude: null,
      weatherLongitude: null,
      weatherLocationLabel: null,
      updatedAt: new Date(),
    })
    .where(eq(family.id, familyId));
}

async function revalidateWeatherSurfaces(): Promise<void> {
  const locale = await getLocale();
  revalidatePath(`/${locale}/settings`);
  revalidatePath(`/${locale}/hub`);
}
