# Reward Chart Management Interface Design

## Overview

Management interface for parents to configure reward charts, tasks, goals, and messages for their children. Extends the existing `/reward-chart` page with inline edit controls when in manage mode.

## Key Decisions

- **Inline management** - Edit controls appear on the existing chart view (no separate page)
- **Avatar pill selector** - Visually appealing horizontal pills with child avatars for switching between charts
- **Modal dialogs** - Add/edit forms appear in shadcn Dialog modals
- **Drag and drop** - Native HTML5 DnD for task reordering (same pattern as calendar)
- **Single active goal** - One goal at a time per child

## Architecture

```
/reward-chart (page)
├── ChartSelector (new - avatar pills for multi-child)
├── ChartHeader (existing - add edit goal button)
├── WeeklyGrid (existing - add task management in manage mode)
│   ├── TaskRow (existing - add drag handle, edit/delete)
│   └── AddTaskRow (new - appears in manage mode)
├── BottomCards (existing)
│   ├── NextRewardCard (add edit goal button)
│   └── MessageCard (add compose button)
└── Dialogs (new)
    ├── TaskDialog (add/edit task)
    ├── GoalDialog (add/edit goal)
    └── MessageDialog (compose message)
```

## Chart Selector Component

Horizontal scrollable row of styled pills for switching between children's charts:

**Visual design:**

- Each pill: rounded-2xl, white bg, subtle shadow
- Contains: FamilyAvatar (40x40), name (Lexend bold), star count subtitle
- Selected state: primary ring (#13ec92), soft glow shadow
- Hover: slight scale (1.02) with 200ms ease transition
- "Create Chart" pill: dashed border, plus icon

**Behavior:**

- Managers see all children in family
- Non-managers only see their own chart (no selector)
- URL param `?child={memberId}` tracks selection

**Empty state:**

- Message: "Set up Star Charts for your children"
- Create button for each child without a chart

## Task Management UI

**Task rows (in manage mode):**

- Drag handle (grip icon) on left
- Edit button (pencil) on hover
- Delete button (trash) on hover
- Native HTML5 drag and drop

**Add Task Row:**

- Dashed border row at bottom with "+ Add Task"
- Opens TaskDialog modal

**TaskDialog fields:**

- Title (required, max 100 chars)
- Icon picker (grid from TASK_ICONS)
- Color picker (chips from ICON_COLORS)
- Star value (1-10, default 1)
- Days of week (checkbox group, min 1)

## Goal Management UI

**On NextRewardCard (manage mode):**

- No goal: "Set Goal" button
- Has goal: edit button, mark achieved/cancelled option

**GoalDialog fields:**

- Title (required, max 100 chars)
- Emoji picker (common reward emojis)
- Star target (slider 5-100)
- Description (optional, max 500 chars)

## Message Management UI

**On MessageCard (manage mode):**

- "Send Message" button

**MessageDialog fields:**

- Textarea (required, max 500 chars)
- Character counter

## State Management

Extend `RewardChartContext` with mutations:

- `createChart(memberId)`
- `createTask(input)`, `updateTask(id, input)`, `deleteTask(id)`
- `createGoal(input)`, `updateGoal(id, input)`
- `sendMessage(content)`
- `reorderTasks(taskIds[])`

All mutations call existing API routes, then refetch.

## Error Handling

- API errors: toast notification (sonner)
- Validation errors: inline in form fields
- Loading: spinner on submit buttons, disabled inputs

## Permissions

- Only managers see edit controls (via InteractionModeContext)
- API validates manager role for all mutations
