"use client";

import { useSession } from "@/lib/auth-client";

interface SessionData {
  isDevice?: boolean;
}

/**
 * Returns true if the current session is a device (wall display).
 */
export function useIsDevice(): boolean {
  const { data: session } = useSession();
  if (!session) return false;

  return (session.session as SessionData).isDevice === true;
}
