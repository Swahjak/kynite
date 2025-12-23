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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

const messageFormSchema = z.object({
  content: z.string().min(1, "Message is required").max(500),
});

type MessageFormValues = z.infer<typeof messageFormSchema>;

interface MessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (content: string) => Promise<void>;
}

export function MessageDialog({
  open,
  onOpenChange,
  onSubmit,
}: MessageDialogProps) {
  const t = useTranslations("rewardChart");

  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: {
      content: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        content: "",
      });
    }
  }, [open, form]);

  async function handleFormSubmit(values: MessageFormValues) {
    await onSubmit(values.content);
    form.reset();
    onOpenChange(false);
  }

  const currentLength = form.watch("content")?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("sendMessage")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("parentMessage")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("messagePlaceholder")}
                      className="min-h-32 resize-none"
                      maxLength={500}
                      {...field}
                    />
                  </FormControl>
                  <div className="flex items-center justify-between">
                    <FormMessage />
                    <span className="text-muted-foreground text-xs">
                      {currentLength}/500
                    </span>
                  </div>
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
                {form.formState.isSubmitting ? t("sending") : t("send")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export type { MessageFormValues };
