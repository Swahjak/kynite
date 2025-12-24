import { useState, useEffect, useCallback } from "react";

interface UseTimerCountdownOptions {
  initialSeconds: number;
  isOwner: boolean;
  isRunning: boolean;
  timerId: string;
  onComplete?: () => void;
  onSync?: (remainingSeconds: number) => void;
}

export function useTimerCountdown({
  initialSeconds,
  isOwner,
  isRunning,
  timerId,
  onComplete,
  onSync,
}: UseTimerCountdownOptions) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const [lastSync, setLastSync] = useState(Date.now());

  // Update remaining when initialSeconds changes (from server)
  useEffect(() => {
    setRemaining(initialSeconds);
  }, [initialSeconds]);

  // Countdown logic (owner only)
  useEffect(() => {
    if (!isOwner || !isRunning) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });

      // Sync every 60 seconds
      if (Date.now() - lastSync >= 60000) {
        setLastSync(Date.now());
        onSync?.(remaining - 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOwner, isRunning, onComplete, onSync, remaining, lastSync]);

  const reset = useCallback((seconds: number) => {
    setRemaining(seconds);
    setLastSync(Date.now());
  }, []);

  return { remaining, reset };
}

/**
 * Get or create a persistent device ID
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}
