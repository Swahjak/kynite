"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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

  const { data: templates = [], refetch } = useQuery({
    queryKey: ["timerTemplates"],
    queryFn: fetchTemplates,
  });

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
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Timers</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe timer
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <TimerTemplateCard
            key={template.id}
            template={template}
            onEdit={() => setEditingTemplate(template)}
            onDelete={() => handleDelete(template.id)}
          />
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-muted-foreground py-12 text-center">
          Nog geen timer templates. Maak er een om te beginnen!
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
