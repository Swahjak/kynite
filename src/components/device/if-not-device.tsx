"use client";

import { useDeviceSession } from "@/hooks/use-device-session";

interface IfNotDeviceProps {
  children: React.ReactNode;
  /**
   * Optional: also require manager role
   */
  requireManager?: boolean;
  /**
   * Optional: content to show on devices (instead of nothing)
   */
  fallback?: React.ReactNode;
}

/**
 * Conditionally render children only for non-device sessions.
 * Use this to hide create/edit/delete buttons on device displays.
 *
 * @example
 * <IfNotDevice>
 *   <Button onClick={openCreateModal}>Add Chore</Button>
 * </IfNotDevice>
 *
 * @example
 * <IfNotDevice requireManager>
 *   <Button onClick={openSettings}>Settings</Button>
 * </IfNotDevice>
 */
export function IfNotDevice({
  children,
  requireManager = false,
  fallback = null,
}: IfNotDeviceProps) {
  const { data, isPending } = useDeviceSession();

  // Don't render anything while loading
  if (isPending) {
    return null;
  }

  // No session - don't render (will redirect to login anyway)
  if (!data) {
    return null;
  }

  // If device, show fallback
  if (data.isDevice) {
    return <>{fallback}</>;
  }

  // If requireManager but not manager, show fallback
  if (requireManager && !data.isManager) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
