import Pusher from "pusher";

// Validate Pusher credentials at module load
const PUSHER_APP_ID = process.env.PUSHER_APP_ID;
const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_SECRET = process.env.PUSHER_SECRET;
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
  const missing = [
    !PUSHER_APP_ID && "PUSHER_APP_ID",
    !PUSHER_KEY && "NEXT_PUBLIC_PUSHER_KEY",
    !PUSHER_SECRET && "PUSHER_SECRET",
    !PUSHER_CLUSTER && "NEXT_PUBLIC_PUSHER_CLUSTER",
  ].filter(Boolean);

  throw new Error(
    `Missing Pusher credentials: ${missing.join(", ")}. Check your environment variables.`
  );
}

const pusherServer = new Pusher({
  appId: PUSHER_APP_ID,
  key: PUSHER_KEY,
  secret: PUSHER_SECRET,
  cluster: PUSHER_CLUSTER,
  useTLS: true,
});

/**
 * Fire-and-forget broadcast - never blocks the calling function
 */
export function broadcast(channel: string, event: string, data: unknown): void {
  pusherServer.trigger(channel, event, data).catch((error) => {
    console.error(
      `[Pusher] Failed to broadcast ${event} to ${channel}:`,
      error
    );
  });
}

/**
 * Broadcast an event to a family's private channel
 */
export function broadcastToFamily(
  familyId: string,
  event: string,
  data: unknown
): void {
  broadcast(`private-family-${familyId}`, event, data);
}

export { pusherServer };
