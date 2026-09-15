import { cookies, headers } from 'next/headers';
import { getPrincipal } from '@/modules/family';
import { resolveSurface, SURFACE_COOKIE, type Surface } from './resolve';

export async function getSurface(): Promise<Surface> {
  const principal = await getPrincipal();
  const cookieStore = await cookies();
  const headerStore = await headers();
  return resolveSurface({
    isDevicePrincipal: principal?.kind === 'device',
    cookieValue: cookieStore.get(SURFACE_COOKIE)?.value,
    secChUaMobile: headerStore.get('sec-ch-ua-mobile'),
    userAgent: headerStore.get('user-agent'),
  });
}
