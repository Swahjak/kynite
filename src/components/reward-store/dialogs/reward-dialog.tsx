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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  limitTypeSchema,
  type CreateRewardInput,
} from "@/lib/validations/reward";
import { REWARD_EMOJIS, LIMIT_OPTIONS } from "../constants";
import type { IReward } from "../interfaces";

// Local form schema with explicit types (no defaults for form values)
const rewardFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z.string().max(500).optional(),
  emoji: z.string().min(1, "Emoji is required"),
  starCost: z.number().int().min(1, "Cost must be at least 1").max(100000),
  limitType: limitTypeSchema,
});

type RewardFormValues = z.infer<typeof rewardFormSchema>;

interface RewardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reward?: IReward;
  onSubmit: (values: CreateRewardInput) => Promise<void>;
}

export function RewardDialog({
  open,
  onOpenChange,
  reward,
  onSubmit,
}: RewardDialogProps) {
  const t = useTranslations("rewardStore");
  const isEditing = !!reward;

  const form = useForm<RewardFormValues>({
    resolver: zodResolver(rewardFormSchema),
    defaultValues: {
      title: "",
      emoji: "🎮",
      starCost: 50,
      description: "",
      limitType: "none",
    },
  });

  useEffect(() => {
    if (open) {
      if (reward) {
        form.reset({
          title: reward.title,
          emoji: reward.emoji,
          starCost: reward.starCost,
          description: reward.description || "",
          limitType: reward.limitType,
        });
      } else {
        form.reset({
          title: "",
          emoji: "🎮",
          starCost: 50,
          description: "",
          limitType: "none",
        });
      }
    }
  }, [open, reward, form]);

  async function handleFormSubmit(values: RewardFormValues) {
    // Convert form values to CreateRewardInput
    const input: CreateRewardInput = {
      ...values,
      description: values.description || null,
    };
    await onSubmit(input);
    form.reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("editReward") : t("createReward")}
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
                  <FormLabel>{t("rewardTitle")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("rewardTitlePlaceholder")}
                      {...field}
                    />
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
                  <FormLabel>{t("emoji")}</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-8 gap-2">
                      {REWARD_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => field.onChange(emoji)}
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg border-2 text-xl transition-colors",
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
              name="starCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("starCost")} ({field.value} ⭐)
                  </FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Slider
                        min={1}
                        max={500}
                        step={5}
                        value={[field.value]}
                        onValueChange={(values) => field.onChange(values[0])}
                        className="w-full"
                      />
                      <div className="text-muted-foreground flex justify-between text-xs">
                        <span>1</span>
                        <span>500</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="limitType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("limitType")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LIMIT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("descriptionPlaceholder")}
                      className="min-h-20"
                      {...field}
                      value={field.value || ""}
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
                  ? "..."
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
