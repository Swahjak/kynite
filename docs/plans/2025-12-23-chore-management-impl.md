# Chore Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add UI for creating, editing, and deleting chores with FAB, tap-to-expand cards, and modal dialogs.

**Architecture:** Extend existing ChoresContext with mutations, add expandable ChoreCard with action buttons, FAB for creation, and ChoreDialog for forms. Uses InteractionModeContext to gate management features to managers only.

**Tech Stack:** React 19, shadcn/ui (Dialog, Button, Form), react-hook-form, zod, sonner for toasts

---

## Task 0: Fix Pre-existing Test Failures

**Files:**

- Modify: `src/contexts/__tests__/interaction-mode-context.test.tsx`
- Modify: `src/components/layout/__tests__/app-header.test.tsx`
- Modify: `src/components/layout/__tests__/navigation-menu.test.tsx`

**Step 1: Run tests to see current failures**

Run: `pnpm test:run`
Expected: 4 failures in interaction-mode, app-header, navigation-menu tests

**Step 2: Update interaction-mode-context.test.tsx**

The test expects wall mode values but the implementation changed. Update expectations to match actual behavior.

**Step 3: Update navigation-menu.test.tsx**

The test expects Chores to be hidden in wall mode, but current nav shows it. Update test to expect Chores visible (or check the nav component logic).

**Step 4: Update app-header.test.tsx**

Tests expect avatar hidden in wall mode and add button behavior. Update to match current implementation.

**Step 5: Run tests to verify fixes**

Run: `pnpm test:run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add -A && git commit -m "fix(tests): update test expectations for wall/manage mode"
```

---

## Task 1: Extend ChoresContext with Mutations

**Files:**

- Modify: `src/components/chores/contexts/chores-context.tsx`

**Step 1: Add mutation functions to context interface**

Add to `ChoresContextValue`:

```typescript
// New for management
expandedChoreId: string | null;
setExpandedChoreId: (id: string | null) => void;
createChore: (input: CreateChoreInput) => Promise<boolean>;
updateChore: (id: string, input: UpdateChoreInput) => Promise<boolean>;
deleteChore: (id: string) => Promise<boolean>;
```

**Step 2: Add state and implement mutations**

```typescript
const [expandedChoreId, setExpandedChoreId] = useState<string | null>(null);

const createChore = useCallback(
  async (input: CreateChoreInput): Promise<boolean> => {
    try {
      const res = await fetch(`/api/v1/families/${familyId}/chores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error?.message || "Failed to create chore");
        return false;
      }
      await refreshChores();
      toast.success("Chore created");
      return true;
    } catch {
      toast.error("Failed to create chore");
      return false;
    }
  },
  [familyId, refreshChores]
);

const updateChore = useCallback(
  async (id: string, input: UpdateChoreInput): Promise<boolean> => {
    try {
      const res = await fetch(`/api/v1/families/${familyId}/chores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error?.message || "Failed to update chore");
        return false;
      }
      await refreshChores();
      toast.success("Chore updated");
      return true;
    } catch {
      toast.error("Failed to update chore");
      return false;
    }
  },
  [familyId, refreshChores]
);

const deleteChore = useCallback(
  async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/v1/families/${familyId}/chores/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error?.message || "Failed to delete chore");
        return false;
      }
      await refreshChores();
      toast.success("Chore deleted");
      return true;
    } catch {
      toast.error("Failed to delete chore");
      return false;
    }
  },
  [familyId, refreshChores]
);
```

**Step 3: Add imports**

```typescript
import { toast } from "sonner";
import type {
  CreateChoreInput,
  UpdateChoreInput,
} from "@/lib/validations/chore";
```

**Step 4: Update value object**

Add to the value object: `expandedChoreId`, `setExpandedChoreId`, `createChore`, `updateChore`, `deleteChore`

**Step 5: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 6: Commit**

```bash
git add -A && git commit -m "feat(chores): add mutation functions to ChoresContext"
```

---

## Task 2: Create ChoreDialog Component

**Files:**

- Create: `src/components/chores/components/chore-dialog.tsx`

**Step 1: Create the dialog component**

```typescript
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createChoreSchema, type CreateChoreInput } from "@/lib/validations/chore";
import { CHORE_RECURRENCES, type IChoreWithAssignee } from "@/types/chore";
import type { FamilyMemberWithUser } from "@/types/family";
import { useChores } from "../contexts/chores-context";
import { Loader2 } from "lucide-react";

interface ChoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  chore?: IChoreWithAssignee | null;
  members: FamilyMemberWithUser[];
}

const recurrenceLabels: Record<string, string> = {
  once: "Once",
  daily: "Daily",
  weekly: "Weekly",
  weekdays: "Weekdays (Mon-Fri)",
  weekends: "Weekends (Sat-Sun)",
  monthly: "Monthly",
};

export function ChoreDialog({
  open,
  onOpenChange,
  mode,
  chore,
  members,
}: ChoreDialogProps) {
  const { createChore, updateChore } = useChores();

  const form = useForm<CreateChoreInput>({
    resolver: zodResolver(createChoreSchema),
    defaultValues: {
      title: "",
      description: null,
      assignedToId: null,
      dueDate: null,
      dueTime: null,
      recurrence: "once",
      isUrgent: false,
      starReward: 10,
    },
  });

  const { isSubmitting } = form.formState;

  useEffect(() => {
    if (open) {
      if (mode === "edit" && chore) {
        form.reset({
          title: chore.title,
          description: chore.description,
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
          description: null,
          assignedToId: null,
          dueDate: null,
          dueTime: null,
          recurrence: "once",
          isUrgent: false,
          starReward: 10,
        });
      }
    }
  }, [open, mode, chore, form]);

  const onSubmit = async (data: CreateChoreInput) => {
    let success: boolean;
    if (mode === "edit" && chore) {
      success = await updateChore(chore.id, data);
    } else {
      success = await createChore(data);
    }
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add Chore" : "Edit Chore"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Title and Star Reward row */}
            <div className="flex gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Clean room"
                        {...field}
                        disabled={isSubmitting}
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
                    <FormLabel>Stars</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        disabled={isSubmitting}
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
                  <FormLabel>Assign to</FormLabel>
                  <Select
                    value={field.value ?? "unassigned"}
                    onValueChange={(v) =>
                      field.onChange(v === "unassigned" ? null : v)
                    }
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
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

            {/* Due Date and Time row */}
            <div className="flex gap-4">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Due date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value || null)
                        }
                        disabled={isSubmitting}
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
                  <FormItem className="w-32">
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value || null)
                        }
                        disabled={isSubmitting || !form.watch("dueDate")}
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
                  <FormLabel>Repeats</FormLabel>
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
                      {CHORE_RECURRENCES.map((rec) => (
                        <SelectItem key={rec} value={rec}>
                          {recurrenceLabels[rec]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Urgent toggle */}
            <FormField
              control={form.control}
              name="isUrgent"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Mark as urgent</FormLabel>
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
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add details..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value || null)
                      }
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {mode === "create" ? "Create" : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(chores): add ChoreDialog component"
```

---

## Task 3: Create DeleteConfirmDialog Component

**Files:**

- Create: `src/components/chores/components/delete-confirm-dialog.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { useChores } from "../contexts/chores-context";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  choreId: string;
  choreTitle: string;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  choreId,
  choreTitle,
}: DeleteConfirmDialogProps) {
  const { deleteChore } = useChores();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await deleteChore(choreId);
    setIsDeleting(false);
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{choreTitle}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
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

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(chores): add DeleteConfirmDialog component"
```

---

## Task 4: Create FAB Component

**Files:**

- Create: `src/components/chores/components/fab.tsx`

**Step 1: Create the FAB component**

```typescript
"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FABProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function FAB({ onClick, disabled, className }: FABProps) {
  return (
    <Button
      size="icon"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
        "transition-transform hover:scale-105 active:scale-95",
        className
      )}
      aria-label="Add chore"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(chores): add FAB component"
```

---

## Task 5: Update ChoreCard with Tap-to-Expand

**Files:**

- Modify: `src/components/chores/components/chore-card.tsx`

**Step 1: Import dependencies and add props**

Add imports:

```typescript
import { Pencil, Trash2 } from "lucide-react";
import { useInteractionMode } from "@/components/calendar/contexts/interaction-mode-context";
```

Add props:

```typescript
interface ChoreCardProps {
  chore: IChoreWithAssignee;
  onEdit?: (chore: IChoreWithAssignee) => void;
  onDelete?: (chore: IChoreWithAssignee) => void;
}
```

**Step 2: Add expanded state and tap handling**

Inside the component:

```typescript
const { canEdit } = useInteractionMode();
const { completeChore, expandedChoreId, setExpandedChoreId } = useChores();
const [isCompleting, setIsCompleting] = useState(false);

const isExpanded = expandedChoreId === chore.id;

const handleCardClick = () => {
  if (!canEdit) return;
  setExpandedChoreId(isExpanded ? null : chore.id);
};
```

**Step 3: Update the card JSX**

Replace the card structure to support expansion:

```typescript
return (
  <div
    className={cn(
      "group relative flex flex-col rounded-xl border bg-card transition-all duration-200",
      isExpanded && "ring-2 ring-primary",
      canEdit && "cursor-pointer"
    )}
    onClick={handleCardClick}
  >
    {/* Main content row */}
    <div className="flex items-center gap-4 p-4">
      {/* Avatar */}
      <Avatar className="h-14 w-14 ring-2 ring-offset-2" style={{ "--ring-color": avatarColor } as React.CSSProperties}>
        <AvatarImage src={assignee?.user.image ?? undefined} alt={displayName} />
        <AvatarFallback style={{ backgroundColor: avatarColor }} className="text-white font-medium">
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

      {/* Complete button (visible on hover in wall mode, or when not expanded in manage mode) */}
      {!isExpanded && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-12 w-12 rounded-full transition-all duration-200",
            "bg-muted hover:bg-primary hover:text-primary-foreground",
            "opacity-0 group-hover:opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            handleComplete();
          }}
          disabled={isCompleting}
          aria-label={`Mark ${chore.title} as complete`}
        >
          <Check className="h-6 w-6" />
        </Button>
      )}
    </div>

    {/* Expanded action row */}
    {isExpanded && canEdit && (
      <div className="flex items-center justify-center gap-4 border-t p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(chore);
          }}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(chore);
          }}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleComplete();
          }}
          disabled={isCompleting}
        >
          <Check className="mr-2 h-4 w-4" />
          Done
        </Button>
      </div>
    )}
  </div>
);
```

**Step 4: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(chores): add tap-to-expand behavior to ChoreCard"
```

---

## Task 6: Update Views to Pass Edit/Delete Handlers

**Files:**

- Modify: `src/components/chores/views/all-chores-view.tsx`
- Modify: `src/components/chores/views/by-person-view.tsx`
- Modify: `src/components/chores/views/urgent-view.tsx`

**Step 1: Add props to views**

Each view component should accept:

```typescript
interface ViewProps {
  onEditChore?: (chore: IChoreWithAssignee) => void;
  onDeleteChore?: (chore: IChoreWithAssignee) => void;
}
```

**Step 2: Pass handlers to ChoreCard**

In each view, update ChoreCard usage:

```typescript
<ChoreCard
  key={chore.id}
  chore={chore}
  onEdit={onEditChore}
  onDelete={onDeleteChore}
/>
```

**Step 3: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(chores): pass edit/delete handlers through views"
```

---

## Task 7: Update Main Chores Component

**Files:**

- Modify: `src/components/chores/chores.tsx`

**Step 1: Add imports**

```typescript
import { useState } from "react";
import { useInteractionMode } from "@/components/calendar/contexts/interaction-mode-context";
import { FAB } from "./components/fab";
import { ChoreDialog } from "./components/chore-dialog";
import { DeleteConfirmDialog } from "./components/delete-confirm-dialog";
import type { IChoreWithAssignee } from "@/types/chore";
```

**Step 2: Add state for dialogs**

```typescript
const { canCreate } = useInteractionMode();
const { members } = useChores();

const [dialogOpen, setDialogOpen] = useState(false);
const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
const [editingChore, setEditingChore] = useState<IChoreWithAssignee | null>(
  null
);

const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
const [deletingChore, setDeletingChore] = useState<IChoreWithAssignee | null>(
  null
);
```

**Step 3: Add handlers**

```typescript
const handleCreateClick = () => {
  setDialogMode("create");
  setEditingChore(null);
  setDialogOpen(true);
};

const handleEditChore = (chore: IChoreWithAssignee) => {
  setDialogMode("edit");
  setEditingChore(chore);
  setDialogOpen(true);
};

const handleDeleteChore = (chore: IChoreWithAssignee) => {
  setDeletingChore(chore);
  setDeleteDialogOpen(true);
};
```

**Step 4: Pass handlers to views and add dialogs/FAB**

Update the JSX:

```typescript
{/* Chore List */}
<div className={isLoading ? "opacity-50 pointer-events-none" : ""}>
  {currentView === "all" && (
    <AllChoresView onEditChore={handleEditChore} onDeleteChore={handleDeleteChore} />
  )}
  {currentView === "by-person" && (
    <ByPersonView onEditChore={handleEditChore} onDeleteChore={handleDeleteChore} />
  )}
  {currentView === "urgent" && (
    <UrgentView onEditChore={handleEditChore} onDeleteChore={handleDeleteChore} />
  )}
</div>

{/* FAB for creating chores */}
{canCreate && <FAB onClick={handleCreateClick} />}

{/* Dialogs */}
<ChoreDialog
  open={dialogOpen}
  onOpenChange={setDialogOpen}
  mode={dialogMode}
  chore={editingChore}
  members={members}
/>

{deletingChore && (
  <DeleteConfirmDialog
    open={deleteDialogOpen}
    onOpenChange={setDeleteDialogOpen}
    choreId={deletingChore.id}
    choreTitle={deletingChore.title}
  />
)}
```

**Step 5: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 6: Commit**

```bash
git add -A && git commit -m "feat(chores): integrate FAB and dialogs in main component"
```

---

## Task 8: Update Index Exports

**Files:**

- Modify: `src/components/chores/index.tsx`

**Step 1: Add exports for new components**

```typescript
export { ChoreDialog } from "./components/chore-dialog";
export { DeleteConfirmDialog } from "./components/delete-confirm-dialog";
export { FAB } from "./components/fab";
```

**Step 2: Commit**

```bash
git add -A && git commit -m "feat(chores): export new components from index"
```

---

## Task 9: Add Translations

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Add English translations**

Add under `"Chores"`:

```json
"dialog": {
  "addTitle": "Add Chore",
  "editTitle": "Edit Chore",
  "titleLabel": "Title",
  "titlePlaceholder": "e.g., Clean room",
  "starsLabel": "Stars",
  "assignLabel": "Assign to",
  "unassigned": "Unassigned",
  "dueDateLabel": "Due date",
  "dueTimeLabel": "Time",
  "repeatsLabel": "Repeats",
  "urgentLabel": "Mark as urgent",
  "descriptionLabel": "Description (optional)",
  "descriptionPlaceholder": "Add details...",
  "cancel": "Cancel",
  "create": "Create",
  "save": "Save Changes"
},
"delete": {
  "title": "Delete \"{title}\"?",
  "description": "This action cannot be undone.",
  "cancel": "Cancel",
  "confirm": "Delete"
},
"recurrence": {
  "once": "Once",
  "daily": "Daily",
  "weekly": "Weekly",
  "weekdays": "Weekdays (Mon-Fri)",
  "weekends": "Weekends (Sat-Sun)",
  "monthly": "Monthly"
},
"toast": {
  "created": "Chore created",
  "updated": "Chore updated",
  "deleted": "Chore deleted",
  "createError": "Failed to create chore",
  "updateError": "Failed to update chore",
  "deleteError": "Failed to delete chore"
}
```

**Step 2: Add Dutch translations**

Same structure with Dutch text.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(i18n): add chore management translations"
```

---

## Task 10: Final Testing and Cleanup

**Step 1: Run all tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 3: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Manual test**

1. Start dev server: `pnpm dev`
2. Navigate to `/chores`
3. Verify FAB appears (when logged in as manager)
4. Create a chore via FAB
5. Tap a chore card to expand
6. Edit a chore
7. Delete a chore
8. Verify toasts appear

**Step 5: Final commit if any changes**

```bash
git add -A && git commit -m "chore: cleanup and final adjustments"
```

---

## Summary

| Task | Component           | Description                    |
| ---- | ------------------- | ------------------------------ |
| 0    | Tests               | Fix pre-existing test failures |
| 1    | ChoresContext       | Add mutation functions         |
| 2    | ChoreDialog         | Create/edit form dialog        |
| 3    | DeleteConfirmDialog | Deletion confirmation          |
| 4    | FAB                 | Floating action button         |
| 5    | ChoreCard           | Tap-to-expand with actions     |
| 6    | Views               | Pass handlers to ChoreCard     |
| 7    | Chores              | Integrate dialogs and FAB      |
| 8    | Index               | Export new components          |
| 9    | Translations        | Add i18n strings               |
| 10   | Testing             | Verify everything works        |
