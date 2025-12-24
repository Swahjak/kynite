"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Zap, Star, Play } from "lucide-react";
import type { TimerTemplate } from "@/server/schema";

interface TimerTemplateCardProps {
  template: TimerTemplate;
  isEditMode: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStart: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}u ${remainingMins}m` : `${hours}u`;
}

const categoryEmoji: Record<string, string> = {
  screen: "📺",
  chore: "🧹",
  activity: "📚",
};

export function TimerTemplateCard({
  template,
  isEditMode,
  onEdit,
  onDelete,
  onStart,
}: TimerTemplateCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">
          {categoryEmoji[template.category] || "⏱"} {template.title}
        </CardTitle>
        <div className="flex gap-1">
          {isEditMode ? (
            <>
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" onClick={onStart}>
              <Play className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
          <span>{formatDuration(template.durationSeconds)}</span>
          {template.starReward > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {template.starReward}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{template.alertMode} alert</Badge>
          <Badge variant="secondary">
            {template.controlMode.replace("_", " ")}
          </Badge>
          {template.showAsQuickAction && (
            <Badge variant="default" className="flex items-center gap-1">
              <Zap className="h-3 w-3" /> Quick
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
