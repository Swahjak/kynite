"use client";

import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TimerTemplate } from "@/server/schema";

interface FormValues {
  title: string;
  description?: string;
  category: "screen" | "chore" | "activity";
  durationSeconds: number;
  starReward: number;
  controlMode: "parents_only" | "anyone";
  alertMode: "none" | "completion" | "escalating";
  cooldownSeconds?: number;
  showAsQuickAction: boolean;
}

interface TimerTemplateFormProps {
  template?: TimerTemplate;
  onSuccess: () => void;
}

export function TimerTemplateForm({
  template,
  onSuccess,
}: TimerTemplateFormProps) {
  const isEditing = !!template;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: template
      ? {
          title: template.title,
          description: template.description ?? undefined,
          category: template.category as "screen" | "chore" | "activity",
          durationSeconds: template.durationSeconds,
          starReward: template.starReward,
          controlMode: template.controlMode as "parents_only" | "anyone",
          alertMode: template.alertMode as "none" | "completion" | "escalating",
          cooldownSeconds: template.cooldownSeconds ?? undefined,
          showAsQuickAction: template.showAsQuickAction,
        }
      : {
          title: "",
          category: "chore",
          durationSeconds: 900, // 15 min
          starReward: 0,
          controlMode: "anyone",
          alertMode: "completion",
          showAsQuickAction: false,
        },
  });

  const onSubmit = async (data: FormValues) => {
    const url = isEditing
      ? `/api/v1/timers/templates/${template.id}`
      : "/api/v1/timers/templates";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      onSuccess();
    }
  };

  const category = watch("category");
  const showAsQuickAction = watch("showAsQuickAction");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Titel</Label>
        <Input id="title" {...register("title")} placeholder="Schermtijd" />
        {errors.title && (
          <p className="text-destructive text-sm">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Categorie</Label>
        <Select
          value={category}
          onValueChange={(v) =>
            setValue("category", v as "screen" | "chore" | "activity")
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="screen">📺 Scherm</SelectItem>
            <SelectItem value="chore">🧹 Taak</SelectItem>
            <SelectItem value="activity">📚 Activiteit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="durationMinutes">Duur (minuten)</Label>
          <Input
            id="durationMinutes"
            type="number"
            min={1}
            {...register("durationSeconds", {
              setValueAs: (v) => parseInt(v) * 60,
            })}
            defaultValue={template ? template.durationSeconds / 60 : 15}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="starReward">Sterren</Label>
          <Input
            id="starReward"
            type="number"
            min={0}
            {...register("starReward", { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="alertMode">Alarm modus</Label>
        <Select
          value={watch("alertMode")}
          onValueChange={(v) =>
            setValue("alertMode", v as "none" | "completion" | "escalating")
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Geen</SelectItem>
            <SelectItem value="completion">Bij voltooiing</SelectItem>
            <SelectItem value="escalating">Escalerend</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="showAsQuickAction"
          checked={showAsQuickAction}
          onCheckedChange={(v) => setValue("showAsQuickAction", v)}
        />
        <Label htmlFor="showAsQuickAction">
          Tonen als snelle actie op dashboard
        </Label>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Opslaan..." : isEditing ? "Bijwerken" : "Aanmaken"}
      </Button>
    </form>
  );
}
