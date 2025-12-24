"use client";

import { useEffect, useRef } from "react";
import { getPusher } from "@/lib/pusher-client";
import type { Channel } from "pusher-js";

type EventHandler = (data: unknown) => void;

export function useFamilyChannel(
  familyId: string | undefined,
  handlers: Record<string, EventHandler>
): void {
  const channelRef = useRef<Channel | null>(null);
  const handlersRef = useRef(handlers);

  // Keep handlers ref updated
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!familyId) return;

    const pusher = getPusher();
    const channelName = `private-family-${familyId}`;
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;

    // Bind all handlers
    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      channel.bind(event, handler);
    });

    return () => {
      // Unbind all handlers
      Object.keys(handlersRef.current).forEach((event) => {
        channel.unbind(event);
      });
      pusher.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [familyId]);
}
