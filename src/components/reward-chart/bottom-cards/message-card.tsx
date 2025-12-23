"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MessageCircle, MessageSquarePlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { useRewardChart } from "../contexts/reward-chart-context";
import { MessageDialog } from "../dialogs/message-dialog";
import { Button } from "@/components/ui/button";
import type { IRewardChartMessage } from "../interfaces";

interface MessageCardProps {
  message: IRewardChartMessage | null;
  className?: string;
}

export function MessageCard({ message, className }: MessageCardProps) {
  const t = useTranslations("rewardChart");
  const { mode } = useInteractionMode();
  const isManageMode = mode === "manage";
  const { sendMessage } = useRewardChart();

  const [messageDialogOpen, setMessageDialogOpen] = useState(false);

  const handleSendMessage = async (content: string) => {
    try {
      await sendMessage(content);
      toast.success(t("messageSent"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messageError"));
      throw error;
    }
  };

  if (!message) {
    return (
      <div
        className={cn(
          "rounded-2xl bg-indigo-600 p-6 text-white shadow-lg",
          className
        )}
      >
        <div className="flex items-center justify-between opacity-80">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <span className="font-display font-bold">{t("parentMessage")}</span>
          </div>
          {isManageMode && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => setMessageDialogOpen(true)}
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-4 text-indigo-100 italic">{t("noMessage")}</p>

        <MessageDialog
          open={messageDialogOpen}
          onOpenChange={setMessageDialogOpen}
          onSubmit={handleSendMessage}
        />
      </div>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(message.createdAt), {
    addSuffix: true,
  });

  return (
    <div
      className={cn(
        "rounded-2xl bg-indigo-600 p-6 text-white shadow-lg",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <MessageCircle className="h-4 w-4" />
          </div>
          <span className="font-display font-bold">{t("parentMessage")}</span>
        </div>
        {isManageMode && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-white/20"
            onClick={() => setMessageDialogOpen(true)}
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Message Box */}
      <div className="mt-4 rounded-xl bg-white/10 p-4 backdrop-blur-md">
        <p className="text-lg text-indigo-50 italic">
          &ldquo;{message.content}&rdquo;
        </p>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2">
          {/* Placeholder avatars */}
          <div className="h-8 w-8 rounded-full bg-indigo-400 ring-2 ring-indigo-600" />
          <div className="h-8 w-8 rounded-full bg-indigo-300 ring-2 ring-indigo-600" />
        </div>
        <span className="text-xs text-indigo-200">Sent {timeAgo}</span>
      </div>

      <MessageDialog
        open={messageDialogOpen}
        onOpenChange={setMessageDialogOpen}
        onSubmit={handleSendMessage}
      />
    </div>
  );
}
