# Modal Button-Only Dismiss Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Dialogs, AlertDialogs, and Sheets dismissable only via explicit button press, improving mobile/touch UX.

**Architecture:** Modify the base shadcn/ui components to add `onInteractOutside` and `onEscapeKeyDown` handlers that prevent default behavior. This centralizes the change in 3 files while affecting all 23 usages automatically.

**Tech Stack:** React, Radix UI primitives, shadcn/ui components

---

## Task 1: Update Dialog Component

**Files:**

- Modify: `src/components/ui/dialog.tsx:60-66`

**Step 1: Add dismiss prevention handlers to DialogContent**

In `src/components/ui/dialog.tsx`, modify the `DialogPrimitive.Content` element inside `DialogContent` function to add the two handlers before `{...props}`:

```tsx
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl border p-6 shadow-lg duration-200 outline-none sm:max-w-lg",
          className
        )}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
```

**Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/dialog.tsx
git commit -m "feat(ui): prevent Dialog dismiss on outside click and escape key"
```

---

## Task 2: Update AlertDialog Component

**Files:**

- Modify: `src/components/ui/alert-dialog.tsx:54-61`

**Step 1: Add dismiss prevention handlers to AlertDialogContent**

In `src/components/ui/alert-dialog.tsx`, modify the `AlertDialogPrimitive.Content` element inside `AlertDialogContent` function:

```tsx
function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        {...props}
      />
    </AlertDialogPortal>
  );
}
```

**Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/alert-dialog.tsx
git commit -m "feat(ui): prevent AlertDialog dismiss on outside click and escape key"
```

---

## Task 3: Update Sheet Component

**Files:**

- Modify: `src/components/ui/sheet.tsx:58-79`

**Step 1: Add dismiss prevention handlers to SheetContent**

In `src/components/ui/sheet.tsx`, modify the `SheetPrimitive.Content` element inside `SheetContent` function:

```tsx
function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className
        )}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}
```

**Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/sheet.tsx
git commit -m "feat(ui): prevent Sheet dismiss on outside click and escape key"
```

---

## Task 4: Manual Testing

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test Dialog behavior**

1. Navigate to any page with a Dialog (e.g., Settings → Devices → Add Device)
2. Click outside the dialog → Should NOT close
3. Press Escape key → Should NOT close
4. Click the X button or Cancel → Should close

**Step 3: Test AlertDialog behavior**

1. Navigate to any page with an AlertDialog (e.g., Family → Member → Remove)
2. Click outside the dialog → Should NOT close
3. Press Escape key → Should NOT close
4. Click Cancel or action button → Should close

**Step 4: Test Sheet behavior**

1. Open mobile navigation menu (hamburger icon on mobile viewport)
2. Click outside the sheet → Should NOT close
3. Press Escape key → Should NOT close
4. Click the X button or a navigation link → Should close

---

## Components Affected

**Dialog (13 usages):**

- `src/components/reward-chart/dialogs/message-dialog.tsx`
- `src/components/reward-chart/dialogs/task-dialog.tsx`
- `src/components/reward-chart/dialogs/goal-dialog.tsx`
- `src/components/settings/devices-section.tsx`
- `src/components/reward-store/dialogs/reward-dialog.tsx`
- `src/components/family/upgrade-token-dialog.tsx`
- `src/components/family/member-edit-dialog.tsx`
- `src/components/family/add-child-dialog.tsx`
- `src/components/timers/timers-page.tsx`
- `src/components/dashboard/quick-actions/quick-actions-fab.tsx`
- `src/components/calendar/dialogs/event-details-dialog.tsx`
- `src/components/ui/command.tsx`
- `src/components/ui/date-time-picker.tsx`

**AlertDialog (9 usages):**

- `src/components/reward-chart/bottom-cards/next-reward-card.tsx`
- `src/components/settings/devices-section.tsx`
- `src/components/settings/linked-google-account-card.tsx`
- `src/components/reward-store/dialogs/redemption-confirm-dialog.tsx`
- `src/components/family/family-member-card.tsx`
- `src/components/family/family-settings-client.tsx`
- `src/components/calendar/dialogs/event-drop-confirmation-dialog.tsx`
- `src/components/calendar/dialogs/delete-event-dialog.tsx`
- `src/components/chores/dialogs/delete-chore-dialog.tsx`

**Sheet (1 usage):**

- `src/components/layout/navigation-menu.tsx`

**NOT modified (per user request):**

- `src/components/ui/popover.tsx` - Keeps click-outside behavior for dropdowns/menus
