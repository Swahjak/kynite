import Pusher from "pusher";

const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
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
