# Chore Management Interface Design

## Overview

Management interface for family managers to create, edit, and delete chores. Extends the existing `/chores` page with inline edit controls when in manage mode.

## Key Decisions

- **FAB for creation** - Floating action button (bottom-right) to add new chores
- **Tap-to-expand** - Tapping a chore card expands it to reveal edit/delete actions
- **Modal dialogs** - Add/edit forms appear in shadcn Dialog modals
- **Optional assignment** - Chores can be unassigned ("up for grabs")
- **Automatic sorting** - No manual reorder; sort by urgency → due date → created

## Architecture

```
/chores (page)
├── Chores (existing - add FAB in manage mode)
│   ├── ProgressCard (existing)
│   ├── FilterTabs (existing)
│   └── Views (existing)
│       └── ChoreCard (extend with tap-to-expand)
│           ├── Collapsed state (current design)
│           └── Expanded state (new - shows edit/delete)
└── Dialogs (new)
    ├── ChoreDialog (add/edit chore)
    └── DeleteConfirmDialog (confirm deletion)
```

## FAB Component

**Floating Action Button:**

- Position: fixed bottom-right (16px margin)
- Only visible when `canCreate` is true (manage mode)
- Primary color with plus icon
- Opens ChoreDialog in "create" mode
- Subtle shadow, scales on hover/tap

## ChoreCard Expansion

When `canEdit` is true and user taps a chore card:

- Card smoothly expands downward (~80px)
- Reveals action row with three buttons:
  - **Edit** (pencil icon) - Opens ChoreDialog in "edit" mode
  - **Delete** (trash icon) - Opens DeleteConfirmDialog
  - **Complete** (check icon) - Same as current behavior
- Tapping outside or tapping again collapses
- Only one card expanded at a time
- Complete button moves from hover-reveal to always visible in expanded state

**Visual states:**

```
Collapsed (current):
┌─────────────────────────────────────┐
│ [Avatar]  Title            [✓ hover]│
│           Due badge · Assignee      │
└─────────────────────────────────────┘

Expanded (manage mode, after tap):
┌─────────────────────────────────────┐
│ [Avatar]  Title                     │
│           Due badge · Assignee      │
├─────────────────────────────────────┤
│    [✏️ Edit]  [🗑️ Delete]  [✓ Done] │
└─────────────────────────────────────┘
```

## ChoreDialog Form

**ChoreDialog** handles both create and edit modes:

| Field       | Type           | Required | Notes                                |
| ----------- | -------------- | -------- | ------------------------------------ |
| Title       | Text input     | Yes      | Max 100 chars                        |
| Description | Textarea       | No       | Max 500 chars                        |
| Assigned to | Select         | No       | Family members + "Unassigned" option |
| Due date    | Date picker    | No       | Uses shadcn Calendar                 |
| Due time    | Time input     | No       | Only enabled if due date set         |
| Recurrence  | Select         | Yes      | Default: "once"                      |
| Urgent      | Switch toggle  | No       | Default: false                       |
| Star reward | Number stepper | Yes      | Range 1-50, default 10               |

**Recurrence options:**

- Once (default)
- Daily
- Weekly
- Weekdays (Mon-Fri)
- Weekends (Sat-Sun)
- Monthly

**Dialog behavior:**

- Title: "Add Chore" or "Edit Chore"
- Submit button: "Create" or "Save Changes"
- Loading spinner on submit, inputs disabled
- Closes on successful save
- Toast notification on success/error

**Form layout:**

- Single column, stacked fields
- Title and Star reward on same row (title wider)
- Due date and time on same row
- Description at bottom (expandable textarea)

## State Management

**Extend ChoresContext with mutations:**

```typescript
interface ChoresContextValue {
  // Existing
  chores: IChoreWithAssignee[];
  members: FamilyMemberWithUser[];
  progress: IChoreProgress;
  currentView: ChoreViewFilter;
  setCurrentView: (view: ChoreViewFilter) => void;
  completeChore: (choreId: string) => Promise<void>;
  refreshChores: () => Promise<void>;
  isLoading: boolean;

  // New for management
  expandedChoreId: string | null;
  setExpandedChoreId: (id: string | null) => void;
  createChore: (input: CreateChoreInput) => Promise<void>;
  updateChore: (id: string, input: UpdateChoreInput) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
}
```

**Mutation pattern:**

1. Call API endpoint
2. On success: refetch chores list (keeps sorting consistent)
3. On error: show toast, don't update state
4. No optimistic updates for create/edit/delete (simpler, avoids inconsistency)

**Dialog state** (local to Chores component):

- `dialogOpen: boolean`
- `dialogMode: 'create' | 'edit'`
- `editingChore: IChoreWithAssignee | null`

**Expanded card state** lives in context so views can share it.

## Permissions

Via InteractionModeContext:

| Element             | Wall Mode       | Management Mode    |
| ------------------- | --------------- | ------------------ |
| FAB                 | Hidden          | Visible            |
| Card tap-to-expand  | Disabled        | Enabled            |
| Edit/Delete buttons | Hidden          | Visible            |
| Complete button     | Visible (hover) | Visible (expanded) |

**API permission checks:**

- All mutation endpoints already verify user is family member
- Add manager role check for create/update/delete operations
- Return 403 Forbidden if non-manager attempts mutation

## Error Handling

| Scenario         | Behavior                                       |
| ---------------- | ---------------------------------------------- |
| API error        | Toast: "Failed to [action]. Please try again." |
| Validation error | Inline field errors (red border + message)     |
| Network error    | Toast: "Connection error. Check your network." |
| 403 Forbidden    | Toast: "You don't have permission to do this." |

**Loading states:**

- Submit button shows spinner, text changes to "Saving..."
- Form inputs disabled during submission
- FAB disabled while dialog is submitting

**Delete confirmation:**

- Simple dialog: "Delete [chore title]?"
- Body: "This action cannot be undone."
- Buttons: "Cancel" (secondary) / "Delete" (destructive)
