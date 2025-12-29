# Loading States UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add consistent optimistic + rollback loading patterns to all async UI actions, removing misleading animations.

**Architecture:** Each component gets local `isPending` state, optimistic UI updates on click, rollback + toast on error. No new abstractions - just consistent patterns across 10 components.

**Tech Stack:** React useState, sonner toast, Loader2 from lucide-react (all already installed)

---

## Task 1: TaskCell (Star Claiming)

**Files:**

- Modify: `src/components/reward-chart/weekly-grid/task-cell.tsx`

**Step 1: Add isPending state and modify handlers**

```tsx
// At top of TaskCell component, add:
const [isPending, setIsPending] = useState(false);
const [optimisticStatus, setOptimisticStatus] = useState<
  "pending" | "completed" | null
>(null);

// Replace handleClick with async version:
const handleClick = async () => {
  if (disabled || isPending) return;

  if (cell.status === "completed" && isToday) {
    setIsPending(true);
    setOptimisticStatus("pending");
    try {
      await onUndo();
    } catch {
      setOptimisticStatus(null);
      toast.error("Failed to undo");
    } finally {
      setIsPending(false);
      setOptimisticStatus(null);
    }
  } else if (cell.status === "pending") {
    setIsPending(true);
    setOptimisticStatus("completed");
    fire(starValue ?? 1);
    try {
      await onComplete();
    } catch {
      setOptimisticStatus(null);
      toast.error("Failed to complete");
    } finally {
      setIsPending(false);
      setOptimisticStatus(null);
    }
  }
};
```

**Step 2: Add imports**

```tsx
// Add to imports:
import { useState } from "react";
import { toast } from "sonner";
```

**Step 3: Use optimistic status for rendering**

```tsx
// Replace cell.status references with:
const displayStatus = optimisticStatus ?? cell.status;

// Update render conditions to use displayStatus instead of cell.status
// Add pulse animation during pending:
{
  displayStatus === "completed" && (
    <button
      onClick={handleClick}
      disabled={!isToday || disabled || isPending}
      className={cn(
        "text-[28px] drop-shadow-sm transition-transform",
        isToday && !disabled && !isPending && "cursor-pointer hover:scale-110",
        isPending && "animate-pulse"
      )}
      aria-label="Completed - click to undo"
    >
      ⭐
    </button>
  );
}

{
  displayStatus === "pending" && (
    <button
      onClick={handleClick}
      disabled={disabled || isPending}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full",
        "border-2 border-dashed border-slate-300 dark:border-slate-600",
        "text-slate-300 dark:text-slate-600",
        "transition-all",
        !disabled &&
          !isPending &&
          "hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-500",
        !disabled &&
          !isPending &&
          "dark:hover:border-emerald-400 dark:hover:bg-emerald-950 dark:hover:text-emerald-400",
        isPending &&
          "animate-pulse border-emerald-400 bg-emerald-50 text-emerald-500"
      )}
      aria-label="Pending - click to complete"
    >
      <Check className="h-4 w-4" />
    </button>
  );
}
```

**Step 4: Update interface to use Promise callbacks**

```tsx
interface TaskCellProps {
  cell: TaskCellType;
  isToday: boolean;
  onComplete: () => Promise<void>; // Changed from () => void
  onUndo: () => Promise<void>; // Changed from () => void
  disabled?: boolean;
  starValue?: number;
}
```

**Step 5: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors in task-cell.tsx

**Step 6: Commit**

```bash
git add src/components/reward-chart/weekly-grid/task-cell.tsx
git commit -m "feat(reward-chart): add optimistic loading state to TaskCell"
```

---

## Task 2: TimerCard (5 Button Actions)

**Files:**

- Modify: `src/components/dashboard/active-timers/timer-card.tsx`

**Step 1: Add pendingAction state**

```tsx
// Add import:
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// Add state after existing useState calls:
const [pendingAction, setPendingAction] = useState<string | null>(null);
```

**Step 2: Create wrapper for async actions**

```tsx
// Add helper function inside component:
const withPending =
  (actionName: string, action: () => Promise<void>) => async () => {
    if (pendingAction) return;
    setPendingAction(actionName);
    try {
      await action();
    } catch {
      toast.error("Action failed");
    } finally {
      setPendingAction(null);
    }
  };
```

**Step 3: Update button handlers**

```tsx
// Replace handleConfirm:
const handleConfirm = withPending("claim", async () => {
  if (timer.assignedToId) {
    await confirmTimer(timer.id, timer.assignedToId);
    fire(timer.starReward);
  }
});

// Replace handleDismiss:
const handleDismiss = withPending("dismiss", async () => {
  await dismissTimer(timer.id);
});

// Replace handleAcknowledge:
const handleAcknowledge = withPending("acknowledge", async () => {
  await acknowledgeTimer(timer.id);
  if (timer.starReward > 0 && remaining > 0) {
    fire(timer.starReward);
  }
});
```

**Step 4: Update renderActions buttons with loading states**

```tsx
// In renderActions, update the buttons:

// Extend button:
<Button
  variant="outline"
  size="sm"
  className="h-8 flex-1 text-xs"
  onClick={withPending("extend", async () => {
    await extendTimer(timer.id, extendTime.seconds);
  })}
  disabled={!!pendingAction}
>
  {pendingAction === "extend" ? (
    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
  ) : (
    <Plus className="mr-1 h-3 w-3" />
  )}
  {extendTime.label}
</Button>

// Pause button:
<Button
  variant="outline"
  size="sm"
  className="h-8 flex-1 text-xs"
  onClick={withPending("pause", async () => {
    await pauseTimer(timer.id);
  })}
  disabled={!!pendingAction}
>
  {pendingAction === "pause" ? (
    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
  ) : (
    <Pause className="mr-1 h-3 w-3" />
  )}
  {t("pause")}
</Button>

// Done button (running state):
<Button
  variant="default"
  size="sm"
  className="h-8 flex-1 text-xs"
  onClick={handleAcknowledge}
  disabled={!!pendingAction}
>
  {pendingAction === "acknowledge" ? (
    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
  ) : (
    <Check className="mr-1 h-3 w-3" />
  )}
  {t("done")}
</Button>

// Claim button (in_cooldown state):
<Button
  variant="default"
  size="sm"
  className="h-10 w-full"
  onClick={handleConfirm}
  disabled={!!pendingAction}
>
  {pendingAction === "claim" ? (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  ) : (
    <Star className="mr-2 h-4 w-4" />
  )}
  {t("claim")} (+{timer.starReward})
</Button>

// Dismiss button (cooldown_expired state):
<Button
  variant="outline"
  size="sm"
  className="h-10 w-full"
  onClick={handleDismiss}
  disabled={!!pendingAction}
>
  {pendingAction === "dismiss" ? (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  ) : (
    <X className="mr-2 h-4 w-4" />
  )}
  {t("dismiss")}
</Button>

// Done button (needs_acknowledge state):
<Button
  variant="default"
  size="sm"
  className="h-10 w-full"
  onClick={handleAcknowledge}
  disabled={!!pendingAction}
>
  {pendingAction === "acknowledge" ? (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  ) : (
    <Check className="mr-2 h-4 w-4" />
  )}
  {t("done")}
</Button>
```

**Step 5: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors in timer-card.tsx

**Step 6: Commit**

```bash
git add src/components/dashboard/active-timers/timer-card.tsx
git commit -m "feat(dashboard): add loading states to TimerCard buttons"
```

---

## Task 3: ChoreCard (Remove Slide Animation + Add Feedback)

**Files:**

- Modify: `src/components/chores/components/chore-card.tsx`

**Step 1: Remove misleading slide-out animation**

```tsx
// Find and remove this line (around line 173):
// REMOVE: isCompleting && "animate-out slide-out-to-right fade-out duration-300"

// The className should become:
className={cn(
  "group bg-card relative rounded-xl border transition-all duration-200",
  canExpand && "cursor-pointer",
  isExpanded && "border-primary shadow-sm"
)}
```

**Step 2: Add success feedback to button during pending**

```tsx
// Update the complete button (around line 225-237):
<Button
  variant="ghost"
  size="icon"
  className={cn(
    "h-12 w-12 shrink-0 rounded-full transition-colors",
    isCompleting
      ? "bg-emerald-500 text-white"
      : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground active:bg-primary/90"
  )}
  onClick={handleComplete}
  disabled={isCompleting || !completeChore}
  aria-label={`Mark ${chore.title} as complete`}
>
  {isCompleting ? (
    <Loader2 className="h-5 w-5 animate-spin" />
  ) : (
    <Check className="h-5 w-5" />
  )}
</Button>
```

**Step 3: Add imports**

```tsx
// Add to imports:
import { Loader2 } from "lucide-react";
```

**Step 4: Add error handling to handleComplete**

```tsx
// Update handleComplete:
const handleComplete = async (e: React.MouseEvent) => {
  e.stopPropagation();
  if (!completeChore || isCompleting) return;
  setIsCompleting(true);
  try {
    await completeChore(chore.id);
    fire(chore.starReward);
  } catch {
    toast.error("Failed to complete chore");
    setIsCompleting(false);
  }
};
```

**Step 5: Add toast import**

```tsx
// Add to imports:
import { toast } from "sonner";
```

**Step 6: Update expanded view button similarly**

```tsx
// Update the expanded view complete button (around line 258-265):
<Button
  size="sm"
  onClick={handleComplete}
  disabled={isCompleting || !completeChore}
>
  {isCompleting ? (
    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
  ) : (
    <Check className="mr-1 h-4 w-4" />
  )}
  {t("done")}
</Button>
```

**Step 7: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors in chore-card.tsx

**Step 8: Commit**

```bash
git add src/components/chores/components/chore-card.tsx
git commit -m "fix(chores): remove misleading slide animation, add proper loading feedback"
```

---

## Task 4: RedemptionConfirmDialog (Replace "..." with Spinner)

**Files:**

- Modify: `src/components/reward-store/dialogs/redemption-confirm-dialog.tsx`

**Step 1: Add Loader2 import**

```tsx
// Add to imports:
import { Star, Loader2 } from "lucide-react";
```

**Step 2: Update button content**

```tsx
// Replace line 66-68:
<AlertDialogAction onClick={onConfirm} disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {t("redeeming")}
    </>
  ) : (
    t("redeemNow")
  )}
</AlertDialogAction>
```

**Step 3: Add translation key (optional - fallback works)**

The `t("redeeming")` key may not exist. If it doesn't, use a hardcoded string:

```tsx
{
  isLoading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Redeeming...
    </>
  ) : (
    t("redeemNow")
  );
}
```

**Step 4: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/reward-store/dialogs/redemption-confirm-dialog.tsx
git commit -m "feat(rewards): replace '...' with spinner in redemption dialog"
```

---

## Task 5: QuickActionsFab (Loading After Member Selection)

**Files:**

- Modify: `src/components/dashboard/quick-actions/quick-actions-fab.tsx`

**Step 1: Add loading state**

```tsx
// Add import:
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// Add state:
const [startingMemberId, setStartingMemberId] = useState<string | null>(null);
```

**Step 2: Update handleMemberSelect**

```tsx
const handleMemberSelect = async (memberId: string) => {
  if (!pendingAction || startingMemberId) return;
  setStartingMemberId(memberId);
  try {
    await startQuickAction(pendingAction.id, memberId);
    setPendingAction(null);
  } catch {
    toast.error("Failed to start timer");
  } finally {
    setStartingMemberId(null);
  }
};
```

**Step 3: Update member buttons in dialog**

```tsx
<div className="grid gap-2">
  {familyMembers.map((member) => (
    <Button
      key={member.id}
      variant="outline"
      className="justify-start gap-3"
      onClick={() => handleMemberSelect(member.id)}
      disabled={!!startingMemberId}
    >
      {startingMemberId === member.id ? (
        <Loader2 className="h-8 w-8 animate-spin" />
      ) : (
        <span
          className="h-8 w-8 rounded-full"
          style={{ backgroundColor: member.avatarColor }}
        />
      )}
      <span>{member.name}</span>
    </Button>
  ))}
</div>
```

**Step 4: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/dashboard/quick-actions/quick-actions-fab.tsx
git commit -m "feat(dashboard): add loading state to quick action member selection"
```

---

## Task 6: RewardCard + RewardStorePage (Goal & Delete Loading)

**Files:**

- Modify: `src/components/reward-store/reward-card.tsx`
- Modify: `src/components/reward-store/reward-store-page.tsx`

**Step 1: Update RewardCard props**

```tsx
// In reward-card.tsx, update interface:
interface RewardCardProps {
  reward: IRewardWithStatus;
  isPrimaryGoal?: boolean;
  onRedeem: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetGoal?: () => void;
  isSettingGoal?: boolean;  // NEW
  isDeleting?: boolean;     // NEW
  className?: string;
}

// Update destructuring:
export function RewardCard({
  reward,
  isPrimaryGoal,
  onRedeem,
  onEdit,
  onDelete,
  onSetGoal,
  isSettingGoal,  // NEW
  isDeleting,     // NEW
  className,
}: RewardCardProps) {
```

**Step 2: Add Loader2 import to RewardCard**

```tsx
import { Star, Clock, Target, Pencil, Trash2, Loader2 } from "lucide-react";
```

**Step 3: Update goal and delete buttons in RewardCard**

```tsx
// Update the buttons section:
{
  onSetGoal && !isPrimaryGoal && (
    <Button
      variant="ghost"
      size="sm"
      onClick={onSetGoal}
      disabled={isSettingGoal || isDeleting}
    >
      {isSettingGoal ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Target className="h-4 w-4" />
      )}
    </Button>
  );
}
{
  onEdit && (
    <Button
      variant="ghost"
      size="sm"
      onClick={onEdit}
      disabled={isSettingGoal || isDeleting}
    >
      <Pencil className="h-4 w-4" />
    </Button>
  );
}
{
  onDelete && (
    <Button
      variant="ghost"
      size="sm"
      onClick={onDelete}
      disabled={isSettingGoal || isDeleting}
    >
      {isDeleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </Button>
  );
}
```

**Step 4: Add state to RewardStorePage**

```tsx
// In reward-store-page.tsx, add states:
const [pendingGoalId, setPendingGoalId] = useState<string | null>(null);
const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
```

**Step 5: Update handlers in RewardStorePage**

```tsx
// Update handleSetPrimaryGoal:
const handleSetPrimaryGoal = async (reward: IReward) => {
  if (pendingGoalId || pendingDeleteId) return;
  setPendingGoalId(reward.id);
  try {
    await setPrimaryGoal(reward.id);
    toast.success("Primary goal set!");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to set goal");
  } finally {
    setPendingGoalId(null);
  }
};

// Update handleDeleteReward:
const handleDeleteReward = async (reward: IReward) => {
  if (pendingGoalId || pendingDeleteId) return;
  setPendingDeleteId(reward.id);
  try {
    await deleteReward(reward.id);
    toast.success("Reward deleted");
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Failed to delete reward"
    );
  } finally {
    setPendingDeleteId(null);
  }
};
```

**Step 6: Pass props to RewardCard**

```tsx
// Update RewardCard usage:
<RewardCard
  key={reward.id}
  reward={reward}
  isPrimaryGoal={data.primaryGoal?.id === reward.id}
  onRedeem={() => openRedeemDialog(reward)}
  onEdit={isManager ? () => openEditDialog(reward) : undefined}
  onDelete={isManager ? () => handleDeleteReward(reward) : undefined}
  onSetGoal={
    isManager && data.primaryGoal?.id !== reward.id
      ? () => handleSetPrimaryGoal(reward)
      : undefined
  }
  isSettingGoal={pendingGoalId === reward.id}
  isDeleting={pendingDeleteId === reward.id}
/>
```

**Step 7: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 8: Commit**

```bash
git add src/components/reward-store/reward-card.tsx src/components/reward-store/reward-store-page.tsx
git commit -m "feat(rewards): add loading states to goal setting and reward deletion"
```

---

## Task 7: FamilySettingsClient (Member Actions)

**Files:**

- Modify: `src/components/family/family-settings-client.tsx`

**Step 1: Add loading states**

```tsx
// Add states after existing useState:
const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
const [isLeaving, setIsLeaving] = useState(false);
const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null);
```

**Step 2: Update handleRemoveMember**

```tsx
async function handleRemoveMember(memberId: string) {
  if (pendingRemoveId || isLeaving) return;
  setPendingRemoveId(memberId);
  try {
    const response = await fetch(
      `/api/v1/families/${family.id}/members/${memberId}`,
      { method: "DELETE" }
    );

    const result = await response.json();

    if (!result.success) {
      toast.error(result.error?.message || "Failed to remove member");
      return;
    }

    setMembers(members.filter((m) => m.id !== memberId));
    toast.success("Member removed");
  } catch (error) {
    toast.error("Something went wrong");
  } finally {
    setPendingRemoveId(null);
  }
}
```

**Step 3: Update handleLeaveFamily**

```tsx
async function handleLeaveFamily() {
  const currentMember = members.find((m) => m.userId === currentUserId);
  if (!currentMember || isLeaving) return;

  setIsLeaving(true);
  try {
    const response = await fetch(
      `/api/v1/families/${family.id}/members/${currentMember.id}`,
      { method: "DELETE" }
    );

    const result = await response.json();

    if (!result.success) {
      toast.error(result.error?.message || "Failed to leave family");
      return;
    }

    toast.success("You have left the family");
    router.push(`/${locale}/onboarding`);
  } catch (error) {
    toast.error("Something went wrong");
  } finally {
    setIsLeaving(false);
  }
}
```

**Step 4: Update handleMemberUpdate**

```tsx
async function handleMemberUpdate(
  memberId: string,
  data: Partial<FamilyMember>
) {
  if (pendingUpdateId) return;
  setPendingUpdateId(memberId);
  try {
    const response = await fetch(
      `/api/v1/families/${family.id}/members/${memberId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );

    const result = await response.json();

    if (!result.success) {
      toast.error(result.error?.message || "Failed to update member");
      return;
    }

    setMembers(
      members.map((m) =>
        m.id === memberId ? { ...m, ...result.data.member } : m
      )
    );
    toast.success("Member updated");
  } catch (error) {
    toast.error("Something went wrong");
  } finally {
    setPendingUpdateId(null);
  }
}
```

**Step 5: Pass loading state to FamilyMemberCard**

```tsx
<FamilyMemberCard
  key={member.id}
  member={member}
  familyId={family.id}
  isCurrentUser={member.userId === currentUserId}
  canEdit={isManager || member.userId === currentUserId}
  canRemove={isManager && member.userId !== currentUserId}
  canChangeRole={isManager}
  onUpdate={(data) => handleMemberUpdate(member.id, data)}
  onRemove={() => handleRemoveMember(member.id)}
  isRemoving={pendingRemoveId === member.id}
  isUpdating={pendingUpdateId === member.id}
/>
```

**Step 6: Update Leave Family AlertDialog**

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" disabled={isLeaving}>
      {isLeaving ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Leaving...
        </>
      ) : (
        "Leave Family"
      )}
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Leave Family?</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to leave &ldquo;{family.name}&rdquo;? You will
        need a new invite to rejoin.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={isLeaving}>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleLeaveFamily} disabled={isLeaving}>
        {isLeaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Leave
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Step 7: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: Errors about FamilyMemberCard props (expected - fix in next task)

**Step 8: Commit (partial)**

```bash
git add src/components/family/family-settings-client.tsx
git commit -m "feat(family): add loading states to member actions (WIP)"
```

---

## Task 8: FamilyMemberCard (Accept Loading Props)

**Files:**

- Modify: `src/components/family/family-member-card.tsx`

**Step 1: Update interface**

```tsx
interface FamilyMemberCardProps {
  member: FamilyMemberWithUser;
  familyId: string;
  isCurrentUser: boolean;
  canEdit: boolean;
  canRemove: boolean;
  canChangeRole: boolean;
  onUpdate: (data: {
    displayName?: string | null;
    avatarColor?: AvatarColor | null;
    avatarSvg?: string | null;
    role?: FamilyMemberRole;
  }) => void;
  onRemove: () => void;
  isRemoving?: boolean; // NEW
  isUpdating?: boolean; // NEW
}
```

**Step 2: Update component destructuring**

```tsx
export function FamilyMemberCard({
  member,
  familyId,
  isCurrentUser,
  canEdit,
  canRemove,
  canChangeRole,
  onUpdate,
  onRemove,
  isRemoving,
  isUpdating,
}: FamilyMemberCardProps) {
```

**Step 3: Add Loader2 import**

```tsx
import { Pencil, Trash2, Link, Loader2 } from "lucide-react";
```

**Step 4: Update remove button and dialog**

```tsx
{
  canRemove && (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" disabled={isRemoving}>
          {isRemoving ? (
            <Loader2 className="text-destructive h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="text-destructive h-4 w-4" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Member?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {displayName} from the family?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onRemove} disabled={isRemoving}>
            {isRemoving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 5: Disable edit button during updates**

```tsx
{
  canEdit && (
    <Button
      size="icon"
      variant="ghost"
      onClick={() => setIsEditDialogOpen(true)}
      disabled={isUpdating}
    >
      {isUpdating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Pencil className="h-4 w-4" />
      )}
    </Button>
  );
}
```

**Step 6: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 7: Commit**

```bash
git add src/components/family/family-member-card.tsx
git commit -m "feat(family): add loading state props to FamilyMemberCard"
```

---

## Task 9: DeleteEventDialog (Add Loading State)

**Files:**

- Modify: `src/components/calendar/dialogs/delete-event-dialog.tsx`

**Step 1: Add state and imports**

```tsx
// Update imports:
import { TrashIcon, Loader2 } from "lucide-react";
import { useState } from "react";
```

**Step 2: Add loading state**

```tsx
export default function DeleteEventDialog({ eventId }: DeleteEventDialogProps) {
  const { removeEvent } = useCalendar();
  const [isDeleting, setIsDeleting] = useState(false);
```

**Step 3: Update deleteEvent function**

```tsx
const deleteEvent = async () => {
  if (isDeleting) return;
  setIsDeleting(true);
  try {
    await removeEvent(eventId);
    toast.success("Event deleted successfully.");
  } catch {
    toast.error("Error deleting event.");
    setIsDeleting(false);
  }
};
```

**Step 4: Update dialog buttons**

```tsx
<AlertDialogFooter>
  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
  <AlertDialogAction onClick={deleteEvent} disabled={isDeleting}>
    {isDeleting ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Deleting...
      </>
    ) : (
      "Continue"
    )}
  </AlertDialogAction>
</AlertDialogFooter>
```

**Step 5: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 6: Commit**

```bash
git add src/components/calendar/dialogs/delete-event-dialog.tsx
git commit -m "feat(calendar): add loading state to delete event dialog"
```

---

## Task 10: Final Verification

**Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No errors (or only pre-existing ones)

**Step 3: Run tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 4: Manual verification checklist**

- [ ] TaskCell: Click star circle → shows pulse animation → reverts on error
- [ ] TimerCard: Click any button → shows spinner → all buttons disabled
- [ ] ChoreCard: Click complete → no slide animation → shows spinner in button
- [ ] RedemptionDialog: Click redeem → shows spinner instead of "..."
- [ ] QuickActions: Select member → shows spinner in member button
- [ ] RewardCard: Click goal/delete → shows spinner → buttons disabled
- [ ] FamilySettings: Remove/Leave → shows spinner in dialog
- [ ] DeleteEvent: Click delete → shows spinner

**Step 5: Create final commit if needed**

```bash
git add -A
git commit -m "chore: fix any remaining issues from loading states implementation"
```

---

## Summary

| #   | Component               | Action           | Pattern                   |
| --- | ----------------------- | ---------------- | ------------------------- |
| 1   | TaskCell                | Star claiming    | Optimistic + rollback     |
| 2   | TimerCard               | 5 button actions | pendingAction state       |
| 3   | ChoreCard               | Complete chore   | Remove slide, add spinner |
| 4   | RedemptionConfirmDialog | Redeem           | Spinner instead of "..."  |
| 5   | QuickActionsFab         | Start timer      | Member button spinner     |
| 6   | RewardCard/Page         | Goal + Delete    | Props from parent         |
| 7   | FamilySettingsClient    | Member actions   | Multiple pending states   |
| 8   | FamilyMemberCard        | Remove member    | Accept loading props      |
| 9   | DeleteEventDialog       | Delete event     | Local isDeleting state    |
| 10  | Final verification      | All              | Typecheck + lint + test   |
