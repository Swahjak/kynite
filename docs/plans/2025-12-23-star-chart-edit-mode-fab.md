# Star Chart Edit Mode FAB

## Problem

The star chart grid has alignment issues caused by:

1. Task label column width varies due to drag handle and edit/delete buttons
2. Day columns take more space than needed
3. Global interaction mode affects the entire app, not just the chart

## Solution

Replace global interaction mode with a local FAB toggle for the star chart.

### Normal Mode (default)

- No drag handle in task rows
- Task labels have maximum width available
- Day columns have reduced padding (~6px less per side)
- FAB shows pencil/edit icon (managers only)

### Edit Mode (manager-triggered)

- Drag handles appear for reordering tasks
- Edit/delete buttons float over task labels on hover
- "Add Task" row visible at bottom
- FAB shows checkmark/done icon

## Component Changes

### 1. FAB Component

- Position: bottom-right corner of WeeklyGrid card
- Visibility: only renders when user has manager role
- States:
  - Default: Pencil icon, neutral background
  - Edit mode: Checkmark icon, primary/accent background
- Controls local `isEditMode` state within the chart

### 2. TaskRow

- Conditionally render drag handle based on `isEditMode`
- Keep floating edit/delete buttons (only appear in edit mode)

### 3. Day Headers/Cells

- Reduce horizontal padding to gain width for task labels

### 4. WeeklyGrid

- Manage local `isEditMode` state (not global interaction mode)
- Pass `isEditMode` to child components as prop

## Implementation Notes

- Uses CSS subgrid for consistent column alignment (already implemented)
- FAB uses existing shadcn Button with icon swap
- Manager role check via existing auth context
