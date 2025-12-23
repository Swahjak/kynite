# Chore Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add management interface for creating, editing, and deleting chores with tap-to-expand cards and a FAB button.

**Architecture:** Extend existing ChoresContext with CRUD mutations. Add expandable ChoreCard states and ChoreDialog modal using react-hook-form + zod. Use InteractionModeContext for permission checks.

**Tech Stack:** React 19, Next.js 16, react-hook-form, zod, shadcn/ui (Modal, AlertDialog, Form components), Tailwind CSS

---

## Task 1: Extend ChoresContext with Expanded Card State

**Files:**

- Modify: `src/components/chores/contexts/chores-context.tsx:7-16`

**Step 1: Add expanded card state to interface**

In `ChoresContextValue` interface (line 7), add:

```typescript
interface ChoresContextValue {
  chores: IChoreWithAssignee[];
  members: FamilyMemberWithUser[];
  progress: IChoreProgress;
  currentView: ChoreViewFilter;
  setCurrentView: (view: ChoreViewFilter) => void;
  completeChore: (choreId: string) => Promise<void>;
  refreshChores: () => Promise<void>;
  isLoading: boolean;
  // New: expanded card management
  expandedChoreId: string | null;
  setExpandedChoreId: (id: string | null) => void;
}
```

**Step 2: Add state and expose in provider**

In `ChoresProvider` function, add:

```typescript
const [expandedChoreId, setExpandedChoreId] = useState<string | null>(null);
```

Then add to the `value` object:

```typescript
const value: ChoresContextValue = {
  chores,
  members,
  progress,
  currentView,
  setCurrentView,
  completeChore,
  refreshChores,
  isLoading,
  expandedChoreId,
  setExpandedChoreId,
};
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/chores/contexts/chores-context.tsx
git commit -m "feat(chores): add expanded card state to context"
```

---

## Task 2: Add CRUD Mutations to ChoresContext

**Files:**

- Modify: `src/components/chores/contexts/chores-context.tsx`

**Step 1: Import mutation types**

Add import at top:

```typescript
import type {
  CreateChoreInput,
  UpdateChoreInput,
} from "@/lib/validations/chore";
```

**Step 2: Add mutation signatures to interface**

Extend `ChoresContextValue`:

```typescript
interface ChoresContextValue {
  // ... existing fields ...
  expandedChoreId: string | null;
  setExpandedChoreId: (id: string | null) => void;
  // New: CRUD mutations
  createChore: (input: CreateChoreInput) => Promise<void>;
  updateChore: (id: string, input: UpdateChoreInput) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
}
```

**Step 3: Implement createChore mutation**

Add after `completeChore`:

```typescript
const createChore = useCallback(
  async (input: CreateChoreInput) => {
    const res = await fetch(`/api/v1/families/${familyId}/chores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message ?? "Failed to create chore");
    }

    await refreshChores();
  },
  [familyId, refreshChores]
);
```

**Step 4: Implement updateChore mutation**

Add after `createChore`:

```typescript
const updateChore = useCallback(
  async (id: string, input: UpdateChoreInput) => {
    const res = await fetch(`/api/v1/families/${familyId}/chores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message ?? "Failed to update chore");
    }

    await refreshChores();
  },
  [familyId, refreshChores]
);
```

**Step 5: Implement deleteChore mutation**

Add after `updateChore`:

```typescript
const deleteChore = useCallback(
  async (id: string) => {
    const res = await fetch(`/api/v1/families/${familyId}/chores/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error?.message ?? "Failed to delete chore");
    }

    setExpandedChoreId(null);
    await refreshChores();
  },
  [familyId, refreshChores]
);
```

**Step 6: Add mutations to value object**

```typescript
const value: ChoresContextValue = {
  chores,
  members,
  progress,
  currentView,
  setCurrentView,
  completeChore,
  refreshChores,
  isLoading,
  expandedChoreId,
  setExpandedChoreId,
  createChore,
  updateChore,
  deleteChore,
};
```

**Step 7: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add src/components/chores/contexts/chores-context.tsx
git commit -m "feat(chores): add CRUD mutations to context"
```

---

## Task 3: Create Chore Form Validation Schema

**Files:**

- Modify: `src/lib/validations/chore.ts`

**Step 1: Add form-specific schema**

Add at the end of the file (after existing exports):

```typescript
// =============================================================================
// Form Schema (for react-hook-form)
// =============================================================================

export const choreFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z.string().max(500, "Description too long").optional(),
  assignedToId: z.string().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .nullable()
    .optional(),
  dueTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Invalid time")
    .nullable()
    .optional(),
  recurrence: choreRecurrenceSchema.default("once"),
  isUrgent: z.boolean().default(false),
  starReward: z.coerce
    .number()
    .int()
    .min(1, "Min 1 star")
    .max(50, "Max 50 stars")
    .default(10),
});

export type ChoreFormInput = z.infer<typeof choreFormSchema>;
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/validations/chore.ts
git commit -m "feat(chores): add form validation schema"
```

---

## Task 4: Create ChoreDialog Component

**Files:**

- Create: `src/components/chores/dialogs/chore-dialog.tsx`

**Step 1: Create the dialog file**

```typescript
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
      const message = error instanceof Error ? error.message : "Something went wrong";
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
                        {...field}
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
                    onValueChange={(v) => field.onChange(v === "unassigned" ? null : v)}
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
                    <p className="text-sm text-muted-foreground">
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
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/chores/dialogs/chore-dialog.tsx
git commit -m "feat(chores): add ChoreDialog component"
```

---

## Task 5: Create DeleteChoreDialog Component

**Files:**

- Create: `src/components/chores/dialogs/delete-chore-dialog.tsx`

**Step 1: Create the dialog file**

```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { IChoreWithAssignee } from "@/types/chore";
import { useChores } from "../contexts/chores-context";

interface DeleteChoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chore: IChoreWithAssignee | null;
}

export function DeleteChoreDialog({
  open,
  onOpenChange,
  chore,
}: DeleteChoreDialogProps) {
  const { deleteChore } = useChores();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!chore) return;

    setIsDeleting(true);
    try {
      await deleteChore(chore.id);
      toast.success("Chore deleted successfully");
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete chore";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{chore?.title}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the chore.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/chores/dialogs/delete-chore-dialog.tsx
git commit -m "feat(chores): add DeleteChoreDialog component"
```

---

## Task 6: Create Dialogs Index Export

**Files:**

- Create: `src/components/chores/dialogs/index.ts`

**Step 1: Create index file**

```typescript
export { ChoreDialog } from "./chore-dialog";
export { DeleteChoreDialog } from "./delete-chore-dialog";
```

**Step 2: Commit**

```bash
git add src/components/chores/dialogs/index.ts
git commit -m "feat(chores): add dialogs index export"
```

---

## Task 7: Create FAB Component

**Files:**

- Create: `src/components/chores/components/fab.tsx`

**Step 1: Create the FAB component**

```typescript
"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FabProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function Fab({ onClick, disabled, className }: FabProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size="icon"
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
        "transition-transform hover:scale-105 active:scale-95",
        className
      )}
      aria-label="Add new chore"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/chores/components/fab.tsx
git commit -m "feat(chores): add FAB component"
```

---

## Task 8: Update ChoreCard with Expand/Collapse Behavior

**Files:**

- Modify: `src/components/chores/components/chore-card.tsx`

**Step 1: Update imports**

Replace imports at top:

```typescript
"use client";

import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IChoreWithAssignee } from "@/types/chore";
import {
  getUrgencyStatus,
  formatDueLabel,
  getUrgencyVariant,
} from "../helpers";
import { useChores } from "../contexts/chores-context";
import { useInteractionMode } from "@/components/calendar/contexts/interaction-mode-context";
```

**Step 2: Update ChoreCardProps interface**

```typescript
interface ChoreCardProps {
  chore: IChoreWithAssignee;
  onEdit?: (chore: IChoreWithAssignee) => void;
  onDelete?: (chore: IChoreWithAssignee) => void;
}
```

**Step 3: Replace the component implementation**

Replace entire `ChoreCard` function:

```typescript
export function ChoreCard({ chore, onEdit, onDelete }: ChoreCardProps) {
  const { completeChore, expandedChoreId, setExpandedChoreId } = useChores();
  const { canEdit } = useInteractionMode();
  const [isCompleting, setIsCompleting] = useState(false);

  const urgency = getUrgencyStatus(chore);
  const dueLabel = formatDueLabel(chore);
  const badgeVariant = getUrgencyVariant(urgency);

  const assignee = chore.assignedTo;
  const displayName = assignee?.displayName ?? assignee?.user.name ?? "Unassigned";
  const avatarColor = assignee?.avatarColor ?? "gray";

  const isExpanded = expandedChoreId === chore.id;

  const handleCardClick = () => {
    if (!canEdit) return;
    setExpandedChoreId(isExpanded ? null : chore.id);
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCompleting(true);
    await completeChore(chore.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(chore);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(chore);
  };

  return (
    <div
      role={canEdit ? "button" : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (canEdit && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className={cn(
        "group relative rounded-xl border bg-card transition-all duration-200",
        canEdit && "cursor-pointer",
        isExpanded && "border-primary shadow-sm",
        isCompleting && "animate-out slide-out-to-right fade-out duration-300"
      )}
    >
      {/* Main Content */}
      <div className="flex items-center gap-4 p-4">
        {/* Avatar */}
        <Avatar
          className="h-14 w-14 ring-2 ring-offset-2"
          style={{ "--ring-color": avatarColor } as React.CSSProperties}
        >
          <AvatarImage src={assignee?.user.image ?? undefined} alt={displayName} />
          <AvatarFallback
            style={{ backgroundColor: avatarColor }}
            className="text-white font-medium"
          >
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{chore.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            {dueLabel && (
              <Badge variant={badgeVariant} className="text-xs font-bold uppercase">
                {dueLabel}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">{displayName}</span>
          </div>
        </div>

        {/* Complete Button (hover reveal when not expanded) */}
        {!isExpanded && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-12 w-12 rounded-full transition-all duration-200",
              "bg-muted hover:bg-primary hover:text-primary-foreground",
              "opacity-0 group-hover:opacity-100"
            )}
            onClick={handleComplete}
            disabled={isCompleting}
            aria-label={`Mark ${chore.title} as complete`}
          >
            <Check className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Expanded Actions */}
      {isExpanded && canEdit && (
        <div className="border-t px-4 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
          <Button size="sm" onClick={handleComplete} disabled={isCompleting}>
            <Check className="h-4 w-4 mr-1" />
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/chores/components/chore-card.tsx
git commit -m "feat(chores): add expand/collapse behavior to ChoreCard"
```

---

## Task 9: Update Views to Pass Edit/Delete Handlers

**Files:**

- Modify: `src/components/chores/views/all-chores-view.tsx`
- Modify: `src/components/chores/views/by-person-view.tsx`
- Modify: `src/components/chores/views/urgent-view.tsx`

**Step 1: Read current all-chores-view.tsx**

First, read the file to understand current structure.

**Step 2: Update all-chores-view.tsx**

Add props interface and pass handlers:

```typescript
"use client";

import { useChores } from "../contexts/chores-context";
import { ChoreCard } from "../components/chore-card";
import { sortChores } from "../helpers";
import type { IChoreWithAssignee } from "@/types/chore";

interface AllChoresViewProps {
  onEdit?: (chore: IChoreWithAssignee) => void;
  onDelete?: (chore: IChoreWithAssignee) => void;
}

export function AllChoresView({ onEdit, onDelete }: AllChoresViewProps) {
  const { chores } = useChores();
  const sorted = sortChores(chores);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No pending chores. Great job!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((chore) => (
        <ChoreCard
          key={chore.id}
          chore={chore}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
```

**Step 3: Update by-person-view.tsx similarly**

```typescript
"use client";

import { useChores } from "../contexts/chores-context";
import { ChoreCard } from "../components/chore-card";
import { sortChores, groupChoresByAssignee } from "../helpers";
import type { IChoreWithAssignee } from "@/types/chore";

interface ByPersonViewProps {
  onEdit?: (chore: IChoreWithAssignee) => void;
  onDelete?: (chore: IChoreWithAssignee) => void;
}

export function ByPersonView({ onEdit, onDelete }: ByPersonViewProps) {
  const { chores, members } = useChores();
  const grouped = groupChoresByAssignee(chores);

  if (chores.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No pending chores. Great job!
      </div>
    );
  }

  // Build sections: one per member with chores, plus unassigned
  const sections: { key: string; name: string; chores: IChoreWithAssignee[] }[] = [];

  // Unassigned first
  const unassigned = grouped.get("unassigned");
  if (unassigned && unassigned.length > 0) {
    sections.push({ key: "unassigned", name: "Unassigned", chores: sortChores(unassigned) });
  }

  // Then by member
  for (const member of members) {
    const memberChores = grouped.get(member.id);
    if (memberChores && memberChores.length > 0) {
      sections.push({
        key: member.id,
        name: member.displayName ?? member.user.name,
        chores: sortChores(memberChores),
      });
    }
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.key}>
          <h2 className="text-lg font-semibold mb-3">{section.name}</h2>
          <div className="space-y-3">
            {section.chores.map((chore) => (
              <ChoreCard
                key={chore.id}
                chore={chore}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 4: Update urgent-view.tsx similarly**

```typescript
"use client";

import { useChores } from "../contexts/chores-context";
import { ChoreCard } from "../components/chore-card";
import { sortChores, getUrgentChores } from "../helpers";
import type { IChoreWithAssignee } from "@/types/chore";

interface UrgentViewProps {
  onEdit?: (chore: IChoreWithAssignee) => void;
  onDelete?: (chore: IChoreWithAssignee) => void;
}

export function UrgentView({ onEdit, onDelete }: UrgentViewProps) {
  const { chores } = useChores();
  const urgent = sortChores(getUrgentChores(chores));

  if (urgent.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No urgent chores right now.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {urgent.map((chore) => (
        <ChoreCard
          key={chore.id}
          chore={chore}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
```

**Step 5: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/components/chores/views/
git commit -m "feat(chores): update views to pass edit/delete handlers"
```

---

## Task 10: Update Main Chores Component with Dialog State

**Files:**

- Modify: `src/components/chores/chores.tsx`

**Step 1: Replace the entire component**

```typescript
"use client";

import { useState, useCallback } from "react";
import { useChores } from "./contexts/chores-context";
import { useInteractionMode } from "@/components/calendar/contexts/interaction-mode-context";
import { ProgressCard } from "./components/progress-card";
import { FilterTabs } from "./components/filter-tabs";
import { Fab } from "./components/fab";
import { AllChoresView } from "./views/all-chores-view";
import { ByPersonView } from "./views/by-person-view";
import { UrgentView } from "./views/urgent-view";
import { ChoreDialog, DeleteChoreDialog } from "./dialogs";
import type { IChoreWithAssignee } from "@/types/chore";

interface ChoresProps {
  familyName: string;
}

export function Chores({ familyName }: ChoresProps) {
  const { currentView, isLoading } = useChores();
  const { canCreate, canEdit } = useInteractionMode();

  // Dialog state
  const [choreDialogOpen, setChoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingChore, setEditingChore] = useState<IChoreWithAssignee | null>(null);
  const [deletingChore, setDeletingChore] = useState<IChoreWithAssignee | null>(null);

  // Get greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  // Handlers
  const handleCreate = useCallback(() => {
    setEditingChore(null);
    setChoreDialogOpen(true);
  }, []);

  const handleEdit = useCallback((chore: IChoreWithAssignee) => {
    setEditingChore(chore);
    setChoreDialogOpen(true);
  }, []);

  const handleDelete = useCallback((chore: IChoreWithAssignee) => {
    setDeletingChore(chore);
    setDeleteDialogOpen(true);
  }, []);

  const handleChoreDialogClose = useCallback((open: boolean) => {
    setChoreDialogOpen(open);
    if (!open) {
      setEditingChore(null);
    }
  }, []);

  const handleDeleteDialogClose = useCallback((open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setDeletingChore(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold">
          {greeting}, {familyName}!
        </h1>
        <p className="text-muted-foreground">Let&apos;s crush today&apos;s goals.</p>
      </div>

      {/* Progress */}
      <ProgressCard />

      {/* Filters */}
      <FilterTabs />

      {/* Chore List */}
      <div className={isLoading ? "opacity-50 pointer-events-none" : ""}>
        {currentView === "all" && (
          <AllChoresView onEdit={canEdit ? handleEdit : undefined} onDelete={canEdit ? handleDelete : undefined} />
        )}
        {currentView === "by-person" && (
          <ByPersonView onEdit={canEdit ? handleEdit : undefined} onDelete={canEdit ? handleDelete : undefined} />
        )}
        {currentView === "urgent" && (
          <UrgentView onEdit={canEdit ? handleEdit : undefined} onDelete={canEdit ? handleDelete : undefined} />
        )}
      </div>

      {/* FAB - only visible in management mode */}
      {canCreate && <Fab onClick={handleCreate} />}

      {/* Dialogs */}
      <ChoreDialog
        open={choreDialogOpen}
        onOpenChange={handleChoreDialogClose}
        chore={editingChore}
      />

      <DeleteChoreDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogClose}
        chore={deletingChore}
      />
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/chores/chores.tsx
git commit -m "feat(chores): integrate dialogs and FAB in main component"
```

---

## Task 11: Update Chores Page to Wrap with InteractionModeProvider

**Files:**

- Modify: `src/app/[locale]/(app)/chores/page.tsx`

**Step 1: Add InteractionModeProvider import**

Add import:

```typescript
import { InteractionModeProvider } from "@/components/calendar/contexts/interaction-mode-context";
import { isUserFamilyManager } from "@/server/services/family-service";
```

**Step 2: Add manager check and wrap component**

Update the component:

```typescript
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { getUserFamily, getFamilyMembers, isUserFamilyManager } from "@/server/services/family-service";
import { getChoresForFamily, getChoreProgress } from "@/server/services/chore-service";
import { Chores, ChoresProvider } from "@/components/chores";
import { InteractionModeProvider } from "@/components/calendar/contexts/interaction-mode-context";

export default async function ChoresPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const family = await getUserFamily(session.user.id);
  if (!family) {
    redirect("/families/create");
  }

  const [chores, progress, members, isManager] = await Promise.all([
    getChoresForFamily(family.id, { status: "pending" }),
    getChoreProgress(family.id),
    getFamilyMembers(family.id),
    isUserFamilyManager(session.user.id, family.id),
  ]);

  return (
    <div className="container max-w-4xl py-8">
      <InteractionModeProvider mode={isManager ? "management" : "wall"}>
        <ChoresProvider
          familyId={family.id}
          initialChores={chores}
          initialProgress={progress}
          members={members}
        >
          <Chores familyName={family.name} />
        </ChoresProvider>
      </InteractionModeProvider>
    </div>
  );
}
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/[locale]/(app)/chores/page.tsx
git commit -m "feat(chores): add InteractionModeProvider to chores page"
```

---

## Task 12: Update Index Exports

**Files:**

- Modify: `src/components/chores/index.tsx`

**Step 1: Add new exports**

```typescript
export { Chores } from "./chores";
export { ChoresProvider } from "./contexts/chores-context";
export { ChoreDialog, DeleteChoreDialog } from "./dialogs";
export { Fab } from "./components/fab";
```

**Step 2: Commit**

```bash
git add src/components/chores/index.tsx
git commit -m "feat(chores): update index exports"
```

---

## Task 13: Run Build and Fix Any Issues

**Step 1: Run the build**

Run: `pnpm build`
Expected: Build succeeds

**Step 2: If errors occur, fix them**

Common issues to watch for:

- Missing imports
- Type mismatches
- Unused variables

**Step 3: Run lint**

Run: `pnpm lint`
Expected: No lint errors (or fix them)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(chores): resolve build issues"
```

---

## Task 14: Manual Testing Checklist

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test as manager user**

- [ ] Navigate to `/chores`
- [ ] FAB should be visible (bottom-right)
- [ ] Click FAB - ChoreDialog opens in create mode
- [ ] Fill form and create chore - toast appears, list updates
- [ ] Tap a chore card - it expands showing Edit/Delete/Done buttons
- [ ] Click Edit - ChoreDialog opens with chore data
- [ ] Make changes and save - toast appears, list updates
- [ ] Click Delete - DeleteChoreDialog opens
- [ ] Confirm deletion - toast appears, chore removed
- [ ] Click Done on expanded card - chore completes with animation
- [ ] Tap outside expanded card - it collapses
- [ ] Only one card can be expanded at a time

**Step 3: Test as non-manager user**

- [ ] FAB should NOT be visible
- [ ] Tapping cards should NOT expand them
- [ ] Hover reveals complete button only

**Step 4: Test form validation**

- [ ] Empty title shows error
- [ ] Title over 100 chars shows error
- [ ] Stars < 1 or > 50 shows error
- [ ] Due time disabled when no due date

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(chores): complete chore management interface"
```

---

## Summary

This plan implements:

1. **Context Extensions** - Expanded card state + CRUD mutations in ChoresContext
2. **Form Validation** - Zod schema for chore form
3. **ChoreDialog** - Modal for create/edit with react-hook-form
4. **DeleteChoreDialog** - Confirmation dialog for deletion
5. **FAB Component** - Floating action button for creation
6. **ChoreCard Updates** - Tap-to-expand with action buttons
7. **View Updates** - Pass edit/delete handlers through views
8. **Page Integration** - InteractionModeProvider for permissions

All mutations call existing API endpoints (POST, PATCH, DELETE) and refetch the list on success.
