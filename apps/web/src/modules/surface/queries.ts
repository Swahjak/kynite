import { cookies } from 'next/headers';
import { SURFACE_COOKIE, type SurfaceCookieValue } from './resolve';

export type SurfacePreference = SurfaceCookieValue | 'auto';

/**
 * The raw `kynite.surface` cookie, normalised to `'auto'` when absent or
 * holding a value the resolver would ignore (e.g. a stale `'hub'`) — this is
 * the settings form's own idea of "no explicit preference", not the resolver's
 * default-from-headers logic in `resolve.ts`.
 */
export async function getSurfacePreference(): Promise<SurfacePreference> {
  const raw = (await cookies()).get(SURFACE_COOKIE)?.value;
  return raw === 'app' || raw === 'desktop' ? raw : 'auto';
}
