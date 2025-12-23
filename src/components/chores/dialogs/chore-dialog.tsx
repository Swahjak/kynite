"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/responsive-modal";
import { choreFormSchema, type ChoreFormInput } from "@/lib/validations/chore";
import { CHORE_RECURRENCES } from "@/types/chore";
import type { IChoreWithAssignee } from "@/types/chore";
import type { FamilyMemberWithUser } from "@/types/family";
import { useChores } from "../contexts/chores-context";

interface ChoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chore?: IChoreWithAssignee | null;
}

const RECURRENCE_LABELS: Record<string, string> = {
  once: "Once",
  daily: "Daily",
  weekly: "Weekly",
  weekdays: "Weekdays (Mon-Fri)",
  weekends: "Weekends (Sat-Sun)",
  monthly: "Monthly",
};

export function ChoreDialog({ open, onOpenChange, chore }: ChoreDialogProps) {
  const { members, createChore, updateChore } = useChores();
  const isEditing = !!chore;

  const form = useForm<ChoreFormInput>({
    resolver: zodResolver(choreFormSchema),
    defaultValues: {
      title: "",
      description: "",
      assignedToId: null,
      dueDate: null,
      dueTime: null,
      recurrence: "once",
      isUrgent: false,
      starReward: 10,
    },
  });

  const { isSubmitting } = form.formState;

  // Reset form when dialog opens/closes or chore changes
  useEffect(() => {
    if (open) {
      if (chore) {
        form.reset({
          title: chore.title,
          description: chore.description ?? "",
          assignedToId: chore.assignedToId,
          dueDate: chore.dueDate,
          dueTime: chore.dueTime,
          recurrence: chore.recurrence,
          isUrgent: chore.isUrgent,
          starReward: chore.starReward,
        });
      } else {
        form.reset({
          title: "",
          description: "",
          assignedToId: null,
          dueDate: null,
          dueTime: null,
          recurrence: "once",
          isUrgent: false,
          starReward: 10,
        });
      }
    }
  }, [open, chore, form]);

  const onSubmit = async (data: ChoreFormInput) => {
    try {
      if (isEditing) {
        await updateChore(chore.id, data);
        toast.success("Chore updated successfully");
      } else {
        await createChore(data);
        toast.success("Chore created successfully");
      }
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      toast.error(message);
    }
  };

  const dueDate = form.watch("dueDate");

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-h-[90dvh]">
        <ModalHeader>
          <ModalTitle>{isEditing ? "Edit Chore" : "Add Chore"}</ModalTitle>
          <ModalDescription>
            {isEditing
              ? "Update the chore details below."
              : "Fill in the details to create a new chore."}
          </ModalDescription>
        </ModalHeader>

        <Form {...form}>
          <form
            id="chore-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 py-4"
          >
            {/* Title + Star Reward Row */}
            <div className="grid grid-cols-[1fr_auto] gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Clean your room"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="starReward"
                render={({ field }) => (
                  <FormItem className="w-24">
                    <FormLabel>Stars *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        disabled={isSubmitting}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Assigned To */}
            <FormField
              control={form.control}
              name="assignedToId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned To</FormLabel>
                  <Select
                    value={field.value ?? "unassigned"}
                    onValueChange={(v) =>
                      field.onChange(v === "unassigned" ? null : v)
                    }
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.displayName ?? member.user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Due Date + Time Row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        disabled={isSubmitting}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        disabled={isSubmitting || !dueDate}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Recurrence */}
            <FormField
              control={form.control}
              name="recurrence"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recurrence *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CHORE_RECURRENCES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {RECURRENCE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Urgent Toggle */}
            <FormField
              control={form.control}
              name="isUrgent"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-base">Urgent</FormLabel>
                    <p className="text-muted-foreground text-sm">
                      Mark this chore as high priority
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details..."
                      className="resize-none"
                      rows={3}
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <ModalFooter>
          <ModalClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </ModalClose>
          <Button form="chore-form" type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Save Changes" : "Create"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
