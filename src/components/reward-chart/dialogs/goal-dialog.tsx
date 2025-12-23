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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { ICON_COLORS } from "../constants";
import type { IRewardChartGoal } from "../interfaces";
import { useTranslations } from "next-intl";

const GOAL_EMOJIS = [
  "🎁",
  "🎮",
  "🍦",
  "🎬",
  "🏊",
  "🎢",
  "🧸",
  "📱",
  "🎨",
  "⚽",
  "🎪",
  "🍕",
] as const;

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

const goalFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  emoji: z.string().min(1),
  starTarget: z.number().int().min(5).max(100),
  description: z.string().optional(),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: IRewardChartGoal;
  onSubmit: (values: GoalFormValues) => Promise<void>;
}

export function GoalDialog({
  open,
  onOpenChange,
  goal,
  onSubmit,
}: GoalDialogProps) {
  const t = useTranslations("rewardChart");
  const isEditing = !!goal;

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      title: "",
      emoji: "🎁",
      starTarget: 20,
      description: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (goal) {
        form.reset({
          title: goal.title,
          emoji: goal.emoji,
          starTarget: goal.starTarget,
          description: goal.description || "",
        });
      } else {
        form.reset({
          title: "",
          emoji: "🎁",
          starTarget: 20,
          description: "",
        });
      }
    }
  }, [open, goal, form]);

  async function handleFormSubmit(values: GoalFormValues) {
    await onSubmit(values);
    form.reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("editGoal") : t("setGoal")}
          </DialogTitle>
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
                  <FormLabel>{t("goalTitle")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("goalTitlePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rewardEmoji")}</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-6 gap-2">
                      {GOAL_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => field.onChange(emoji)}
                          className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-lg border-2 text-2xl transition-colors",
                            field.value === emoji
                              ? "border-primary bg-primary/10"
                              : "border-muted hover:border-muted-foreground/50"
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="starTarget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("starTarget")} ({field.value} ⭐)
                  </FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Slider
                        min={5}
                        max={100}
                        step={5}
                        value={[field.value]}
                        onValueChange={(values) => field.onChange(values[0])}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>5</span>
                        <span>100</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("description")}{" "}
                    <span className="text-muted-foreground">
                      ({t("optional")})
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("goalDescriptionPlaceholder")}
                      className="min-h-20"
                      {...field}
                    />
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

export type { GoalFormValues };
