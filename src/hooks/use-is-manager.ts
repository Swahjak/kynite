"use client";

import { useSession } from "@/lib/auth-client";

interface SessionData {
  isDevice?: boolean;
  memberRole?: string | null;
}

/**
 * Returns true if the current user is a manager (parent).
 * Devices always return false.
 */
export function useIsManager(): boolean {
  const { data: session } = useSession();
  if (!session) return false;

  const sessionData = session.session as SessionData;
  return !sessionData.isDevice && sessionData.memberRole === "manager";
}
