"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getDeviceId } from "@/hooks/use-timer-countdown";
import { useIsManager } from "@/hooks/use-is-manager";
import { cn } from "@/lib/utils";
import { TimerTemplateCard } from "./timer-template-card";
import { TimerTemplateForm } from "./timer-template-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TimerTemplate } from "@/server/schema";

async function fetchTemplates(): Promise<TimerTemplate[]> {
  const res = await fetch("/api/v1/timers/templates");
  const data = await res.json();
  if (!data.success) throw new Error(data.error.message);
  return data.data.templates;
}

export function TimersPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TimerTemplate | null>(
    null
  );
  const [deviceId, setDeviceId] = useState("");
  const queryClient = useQueryClient();
  const isManager = useIsManager();

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  const { data: templates = [], refetch } = useQuery({
    queryKey: ["timerTemplates"],
    queryFn: fetchTemplates,
  });

  const handleStartTimer = async (templateId: string) => {
    await fetch("/api/v1/timers/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId,
        assignedToId: "",
        deviceId,
      }),
    });
    queryClient.invalidateQueries({ queryKey: ["activeTimers"] });
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    refetch();
  };

  const handleEditSuccess = () => {
    setEditingTemplate(null);
    refetch();
  };

  const handleDelete = async (templateId: string) => {
    await fetch(`/api/v1/timers/templates/${templateId}`, { method: "DELETE" });
    refetch();
  };

  return (
    <div className="container mx-auto px-4 py-6 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Timers</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <TimerTemplateCard
            key={template.id}
            template={template}
            isManager={isManager}
            onEdit={() => setEditingTemplate(template)}
            onDelete={() => handleDelete(template.id)}
            onStart={() => handleStartTimer(template.id)}
          />
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-muted-foreground py-12 text-center">
          Nog geen timer templates. Maak er een om te beginnen!
        </div>
      )}

      {/* FAB - only show for managers */}
      {isManager && (
        <div className="fixed right-6 bottom-6 z-50">
          <Button
            size="icon"
            onClick={() => setIsCreateOpen(true)}
            className={cn(
              "h-14 w-14 rounded-full shadow-lg",
              "transition-transform hover:scale-105 active:scale-95"
            )}
            aria-label="Nieuwe timer"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Timer template maken</DialogTitle>
          </DialogHeader>
          <TimerTemplateForm onSuccess={handleCreateSuccess} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingTemplate}
        onOpenChange={() => setEditingTemplate(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Timer template bewerken</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <TimerTemplateForm
              template={editingTemplate}
              onSuccess={handleEditSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
