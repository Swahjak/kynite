"use client";

import { useSession } from "@/lib/auth-client";

interface DeviceSessionData {
  isDevice: boolean;
  deviceName: string | null;
  memberRole: string | null;
  familyId: string | null;
  canEdit: boolean;
  isManager: boolean;
}

/**
 * Hook to access device-aware session data
 * Returns loading state and session info including device status
 */
export function useDeviceSession(): {
  data: DeviceSessionData | null;
  isPending: boolean;
} {
  const { data: session, isPending } = useSession();

  if (isPending || !session) {
    return { data: null, isPending };
  }

  const sessionData = session.session as {
    isDevice?: boolean;
    deviceName?: string | null;
    memberRole?: string | null;
    familyId?: string | null;
  };

  const isDevice = sessionData.isDevice === true;
  const memberRole = sessionData.memberRole ?? null;

  return {
    data: {
      isDevice,
      deviceName: sessionData.deviceName ?? null,
      memberRole,
      familyId: sessionData.familyId ?? null,
      // Devices cannot edit, only view and interact
      canEdit: !isDevice,
      // Managers are human users with manager role
      isManager: !isDevice && memberRole === "manager",
    },
    isPending,
  };
}
