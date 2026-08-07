import 'server-only';
import { can, getPrincipal } from '@/modules/family';
import { listDevices, listPendingPairingCodes, type DeviceListEntry } from './queries';

/**
 * The server-side read `(app)/settings/devices` composes (architecture §2 rule
 * 4: route files hold no logic).
 */

export type DevicesPageData = {
  familyId: string;
  devices: (Omit<DeviceListEntry, 'pairedAt' | 'lastSeenAt' | 'revokedAt'> & {
    /** Epoch milliseconds — a Date arrives at a client component as a string. */
    pairedAt: number;
    lastSeenAt: number | null;
    revokedAt: number | null;
  })[];
  pending: { id: string; deviceName: string; expiresAt: number }[];
  /** The server's clock: "last seen 3 days ago" must not be the tablet's guess. */
  serverNow: number;
  canManage: boolean;
};

export async function loadDevicesPage(): Promise<DevicesPageData | null> {
  const principal = await getPrincipal();
  // Member-only surface. A paired kiosk resolving to a principal here would
  // still fail `device:manage` below, but it has no business rendering the
  // device list at all — the wall display is where a stranger stands.
  if (!principal || principal.kind !== 'member') return null;

  const [devices, pending] = await Promise.all([
    listDevices(principal.familyId),
    listPendingPairingCodes(principal.familyId),
  ]);

  return {
    familyId: principal.familyId,
    devices: devices.map((entry) => ({
      id: entry.id,
      name: entry.name,
      kind: entry.kind,
      pairedAt: entry.pairedAt.getTime(),
      lastSeenAt: entry.lastSeenAt ? entry.lastSeenAt.getTime() : null,
      revokedAt: entry.revokedAt ? entry.revokedAt.getTime() : null,
    })),
    pending: pending.map((entry) => ({
      id: entry.id,
      deviceName: entry.deviceName,
      expiresAt: entry.expiresAt.getTime(),
    })),
    serverNow: Date.now(),
    canManage: can(principal, 'device:manage', { familyId: principal.familyId }),
  };
}
