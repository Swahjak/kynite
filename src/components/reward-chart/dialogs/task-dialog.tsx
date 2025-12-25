"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TASK_ICONS, ICON_COLORS } from "../constants";
import type { IRewardChartTask } from "../interfaces";
import { useTranslations } from "next-intl";

const iconColorValues = [
  "blue",
  "emerald",
  "purple",
  "orange",
  "pink",
  "amber",
  "teal",
  "rose",
] as const;

const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  icon: z.string().min(1),
  iconColor: z.enum(iconColorValues),
  starValue: z.number().int().min(1).max(10),
  daysOfWeek: z.array(z.number()).min(1, "Select at least one day"),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: IRewardChartTask;
  onSubmit: (values: TaskFormValues) => Promise<void>;
}

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export function TaskDialog({
  open,
  onOpenChange,
  task,
  onSubmit,
}: TaskDialogProps) {
  const t = useTranslations("rewardChart");
  const isEditing = !!task;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      icon: "smile",
      iconColor: "blue",
      starValue: 1,
      daysOfWeek: [1, 2, 3, 4, 5],
    },
  });

  useEffect(() => {
    if (open) {
      if (task) {
        form.reset({
          title: task.title,
          icon: task.icon,
          iconColor: task.iconColor as TaskFormValues["iconColor"],
          starValue: task.starValue,
          daysOfWeek: task.daysOfWeek,
        });
      } else {
        form.reset({
          title: "",
          icon: "smile",
          iconColor: "blue",
          starValue: 1,
          daysOfWeek: [1, 2, 3, 4, 5],
        });
      }
    }
  }, [open, task, form]);

  async function handleFormSubmit(values: TaskFormValues) {
    await onSubmit(values);
    form.reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("editTask") : t("addTask")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("taskTitle")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("taskTitlePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("icon")}</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-6 gap-2">
                      {TASK_ICONS.map((iconItem) => {
                        const IconComponent = iconItem.icon;
                        return (
                          <button
                            key={iconItem.key}
                            type="button"
                            onClick={() => field.onChange(iconItem.key)}
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-colors",
                              field.value === iconItem.key
                                ? "border-primary bg-primary/10"
                                : "border-muted hover:border-muted-foreground/50"
                            )}
                            title={iconItem.label}
                          >
                            <IconComponent className="size-5" />
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="iconColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("color")}</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {iconColorValues.map((key) => {
                        const colors = ICON_COLORS[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => field.onChange(key)}
                            className={cn(
                              "h-8 w-8 rounded-full transition-transform",
                              colors.bg,
                              field.value === key &&
                                "ring-primary scale-110 ring-2 ring-offset-2"
                            )}
                          />
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="starValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("starValue")}</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        className="w-20"
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                      <span className="text-muted-foreground">⭐</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="daysOfWeek"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("daysOfWeek")}</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((day) => {
                        const isSelected = field.value.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                field.onChange(
                                  field.value.filter((d) => d !== day.value)
                                );
                              } else {
                                field.onChange(
                                  [...field.value, day.value].sort()
                                );
                              }
                            }}
                            className={cn(
                              "flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border-2 text-sm font-medium transition-colors",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted hover:border-muted-foreground/50"
                            )}
                          >
                            {day.label.charAt(0)}
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? t("saving")
                  : isEditing
                    ? t("save")
                    : t("add")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export type { TaskFormValues };
