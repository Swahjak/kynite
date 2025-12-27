# Reward Chart UI Specification

## Interaction Modes

| Mode             | Device         | User    | Purpose                          |
| ---------------- | -------------- | ------- | -------------------------------- |
| **Wall Display** | Mounted tablet | Kids    | View chart, mark tasks complete  |
| **Management**   | Mobile/Desktop | Parents | Configure tasks, goals, messages |

### Wall Display Mode

**Allowed Actions:**

- View own star chart
- Mark tasks complete for today
- Undo today's completions
- View goal progress
- Read parent messages

**Hidden/Disabled:**

- Access to other children's charts
- Task configuration
- Goal management
- Message editing

**Touch Targets:** 48px minimum (cell tap areas)

### Management Mode

**Full Access:**

- All viewing capabilities
- Switch between children's charts
- Add/edit/delete tasks
- Create/manage goals
- Send encouragement messages
- View historical data

---

## Layout Structure

### Desktop (xl: 1280px+)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────────────────────────────────┐  │
│ │ Header: [Badge] Star Chart                     [Goal Progress] │  │
│ │         Greeting message                                       │  │
│ └────────────────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────────────────┐  │
│ │                     Weekly Grid                                 │  │
│ │ ┌──────────────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐    │  │
│ │ │ Task/Routine │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │    │  │
│ │ ├──────────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤    │  │
│ │ │ Brush Teeth  │  ⭐  │  ⭐  │     │     │     │     │     │    │  │
│ │ │ Make Bed     │  ⭐  │  ✓  │     │     │     │     │     │    │  │
│ │ │ Clear Table  │  ✗  │  ⭐  │     │     │     │     │     │    │  │
│ │ │ Read 15 Mins │  ⭐  │  ✓  │     │     │     │     │     │    │  │
│ │ │ PJs On       │  ⭐  │  •  │     │     │     │     │     │    │  │
│ │ └──────────────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘    │  │
│ │ [Info hint]                              Today's Stars: 1/5   │  │
│ └────────────────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────┐ ┌────────────────────────────┐  │
│ │ Next Reward                    │ │ Message from Mom & Dad     │  │
│ │ [emoji] Ice Cream Trip         │ │ "Great job on clearing..." │  │
│ │ [Progress bar]    30 STARS     │ │ [avatars]     Sent 2h ago  │  │
│ │ [View All Rewards →]           │ │                            │  │
│ └────────────────────────────────┘ └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Mobile (< lg: 1024px)

```
┌─────────────────────────────────┐
│ [Badge] Star Chart              │
│ Greeting + Goal Progress Ring   │
├─────────────────────────────────┤
│ Weekly Grid (scrollable)        │
│ ┌─────────────────────────────┐ │
│ │ Task  │Mon│Tue│Wed│...      │ │
│ │ ...   │...│...│...│...      │ │
│ └─────────────────────────────┘ │
│ Today's Stars: 1/5              │
├─────────────────────────────────┤
│ Next Reward Card                │
├─────────────────────────────────┤
│ Message Card                    │
└─────────────────────────────────┘
```

### Breakpoint Summary

| Breakpoint   | Grid Scroll       | Goal Position     | Bottom Cards |
| ------------ | ----------------- | ----------------- | ------------ |
| < sm (640px) | Horizontal scroll | Below greeting    | Stacked      |
| sm - lg      | Horizontal scroll | Below greeting    | Stacked      |
| lg - xl      | Full width        | Right of greeting | 2-column     |
| xl+          | Full width        | Right of greeting | 2-column     |

---

## Components

### 1. Page Header

#### Badge + Title

| Element        | Specification                                       |
| -------------- | --------------------------------------------------- |
| Badge          | Pill with emoji, amber-50 bg, amber-600 text        |
| Badge text     | "WEEKLY GOALS", xs uppercase tracking-wider         |
| Title          | "Star Chart", 4xl-5xl font-display font-bold        |
| Greeting       | "Let's collect stars and earn that reward, {name}!" |
| Greeting style | text-lg text-slate-500 font-medium                  |

#### Goal Progress Ring

| Element       | Specification                          |
| ------------- | -------------------------------------- |
| Container     | White card, rounded-2xl, shadow-card   |
| Ring          | SVG, 80px diameter, 8px stroke         |
| Ring track    | slate-100 (dark: slate-700)            |
| Ring progress | amber-400                              |
| Center number | 2xl font-bold (current stars)          |
| Goal label    | "CURRENT GOAL", xs uppercase slate-400 |
| Goal title    | text-lg font-bold                      |
| Goal emoji    | text-xl                                |
| Progress bar  | h-2 rounded-full, amber-400 fill       |
| Percentage    | amber-500 text, font-bold              |

```typescript
interface GoalProgressProps {
  goal: IRewardChartGoal;
  className?: string;
}

// Progress ring calculation
const circumference = 2 * Math.PI * 34; // r=34
const offset = circumference - (progressPercent / 100) * circumference;
```

### 2. Weekly Grid

The core component displaying tasks and completions.

#### Grid Structure

| Property     | Value                                  |
| ------------ | -------------------------------------- |
| Container    | White card, rounded-3xl, shadow-card   |
| Grid columns | `grid-cols-[1.8fr_repeat(7,1fr)]`      |
| Header row   | bg-slate-50/50, border-b               |
| Body rows    | divide-y divide-slate-100              |
| Row hover    | hover:bg-slate-50/50 transition-colors |

#### Day Headers

| Element         | Specification                                 |
| --------------- | --------------------------------------------- |
| Day name        | 10px uppercase tracking-wide slate-400        |
| Day number      | text-lg font-display font-bold slate-600      |
| Today highlight | bg-indigo-50/50, top bar indigo-500           |
| Today number    | w-8 h-8 bg-indigo-600 text-white rounded-full |
| Weekend text    | rose-500/70 for day name                      |
| Weekend bg      | bg-slate-50/80                                |

#### Task Row

| Element        | Specification                                     |
| -------------- | ------------------------------------------------- |
| Icon container | w-10 h-10 rounded-xl, category color bg           |
| Icon           | Material symbol, xl size, category color          |
| Task title     | font-semibold text-slate-700 text-sm md:text-base |
| Cell border    | border-l border-slate-100                         |
| Cell padding   | p-2                                               |
| Today column   | bg-indigo-50/20                                   |

#### Cell States

| State              | Visual                                 | Interaction              |
| ------------------ | -------------------------------------- | ------------------------ |
| **Completed**      | ⭐ amber-400, text-[28px], drop-shadow | Tap to undo (today only) |
| **Pending**        | Dashed circle + check icon             | Tap to complete          |
| **Missed**         | ✗ slate-300, text-xl                   | None                     |
| **Future**         | Empty                                  | None                     |
| **Not Applicable** | • slate-200 dot, w-2 h-2               | None                     |

```typescript
interface TaskCellProps {
  cell: TaskCell;
  onComplete: () => void;
  onUndo: () => void;
}

// Pending button styles
const pendingStyles = cn(
  "w-8 h-8 rounded-full",
  "border-2 border-dashed border-slate-300",
  "hover:border-emerald-500 hover:bg-emerald-50",
  "flex items-center justify-center",
  "text-slate-300 hover:text-emerald-500",
  "transition-all"
);
```

#### Task Icon Colors

Defined in `constants.ts` as `ICON_COLORS`:

| Color Key | Background | Icon Color  | Dark BG     | Dark Text   |
| --------- | ---------- | ----------- | ----------- | ----------- |
| blue      | blue-50    | blue-600    | blue-950    | blue-400    |
| emerald   | emerald-50 | emerald-600 | emerald-950 | emerald-400 |
| purple    | purple-50  | purple-600  | purple-950  | purple-400  |
| orange    | orange-50  | orange-600  | orange-950  | orange-400  |
| pink      | pink-50    | pink-600    | pink-950    | pink-400    |
| amber     | amber-50   | amber-600   | amber-950   | amber-400   |
| teal      | teal-50    | teal-600    | teal-950    | teal-400    |
| rose      | rose-50    | rose-600    | rose-950    | rose-400    |

#### Task Icons

Uses Lucide React icons. Defined in `constants.ts` as `TASK_ICONS`:

| Key            | Icon          | Suggested Use  |
| -------------- | ------------- | -------------- |
| smile          | Smile         | Brush Teeth    |
| bed            | Bed           | Make Bed       |
| utensils       | Utensils      | Eat/Table      |
| book-open      | BookOpen      | Reading        |
| shirt          | Shirt         | Clothes/PJs    |
| music          | Music         | Practice Music |
| paw-print      | PawPrint      | Pet Care       |
| graduation-cap | GraduationCap | Homework       |
| shower-head    | ShowerHead    | Shower/Bath    |
| backpack       | Backpack      | Pack Bag       |
| dumbbell       | Dumbbell      | Exercise       |
| sparkles       | Sparkles      | Clean Room     |

> **Note:** Legacy Material Symbols names are automatically mapped to Lucide keys via `getTaskIconByKey()` function.

#### Grid Footer

| Element         | Specification                                          |
| --------------- | ------------------------------------------------------ |
| Container       | border-t bg-slate-50 p-4 px-6                          |
| Info hint       | "Tap cells to update status", slate-400 text-sm        |
| Info icon       | `info` Material symbol                                 |
| Stats container | White card, px-4 py-2, rounded-xl                      |
| Stats label     | "TODAY'S STARS", xs uppercase tracking-wider slate-400 |
| Stats value     | text-lg font-bold, completed/total format              |

### 3. Next Reward Card

Preview of the next reward the child is working toward.

| Element          | Specification                                   |
| ---------------- | ----------------------------------------------- |
| Container        | White card, p-6, rounded-2xl, shadow-card       |
| Glow effect      | Absolute div, amber-50 bg, blur-3xl, opacity-60 |
| Header icon      | `military_tech` amber-500                       |
| Header title     | "Next Reward", text-lg font-display font-bold   |
| Star requirement | "30 STARS", xs slate-400 bg-slate-100 px-2 py-1 |
| Reward emoji     | text-3xl in gradient bg container               |
| Reward title     | text-xl font-bold                               |
| Encouragement    | "You're getting closer!", text-sm slate-500     |
| Button           | "View All Rewards →", full width, black bg      |

```typescript
interface NextRewardCardProps {
  goal: IRewardChartGoal;
  onViewRewards: () => void;
}
```

### 4. Message Card

Encouragement message from parents.

| Element        | Specification                                    |
| -------------- | ------------------------------------------------ |
| Container      | indigo-600 bg, text-white, p-6, rounded-2xl      |
| Shadow         | shadow-glow (indigo)                             |
| Header icon    | `chat` in white/20 bg                            |
| Header title   | "Message from Mom & Dad", font-display font-bold |
| Message box    | white/10 bg, backdrop-blur-md, p-4, rounded-xl   |
| Message text   | italic, text-lg, indigo-50                       |
| Author avatars | -space-x-2 overlapping circles                   |
| Timestamp      | "Sent {time} ago", text-xs indigo-200            |

```typescript
interface MessageCardProps {
  message: IRewardChartMessage;
}
```

---

## Interactions

### Task Completion Flow

1. Child taps pending cell (today's column only)
2. Cell animates to star with pulse effect
3. Goal progress updates (ring animates)
4. Today's Stars counter increments
5. Toast confirmation (optional): "Great job! +1 ⭐"

### Undo Flow

1. Child taps completed star (today's column only)
2. Confirmation dialog: "Remove this star?"
3. On confirm: star reverts to pending, counters decrement

### Animations

| Element       | Animation                        | Duration | Easing      |
| ------------- | -------------------------------- | -------- | ----------- |
| Star appear   | scale(0) → scale(1.2) → scale(1) | 300ms    | spring      |
| Star pulse    | opacity: 1→0.7→1 (loop)          | 2s       | ease-in-out |
| Progress ring | stroke-dashoffset transition     | 500ms    | ease-out    |
| Cell hover    | background-color                 | 200ms    | ease        |
| Button press  | scale(0.95)                      | 100ms    | ease        |

### Touch Targets

| Element             | Minimum Size               |
| ------------------- | -------------------------- |
| Grid cell           | 44x44px                    |
| Pending button      | 32x32px (within 44px cell) |
| View Rewards button | 48px height                |

---

## Dark Mode

### Color Mapping

| Element         | Light        | Dark                  |
| --------------- | ------------ | --------------------- |
| Page background | #f8fafc      | #0f172a               |
| Card background | #ffffff      | #1e293b               |
| Grid header     | slate-50/50  | slate-800/50          |
| Text primary    | slate-900    | white                 |
| Text secondary  | slate-500    | slate-400             |
| Borders         | slate-100    | slate-700/50          |
| Star color      | amber-400    | amber-400 (unchanged) |
| Today column    | indigo-50/20 | indigo-500/10         |

### Glass Panel Effect

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.dark .glass-panel {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

---

## Accessibility

### WCAG 2.1 AA Compliance

| Requirement         | Implementation                                       |
| ------------------- | ---------------------------------------------------- |
| Color contrast      | Star yellow on white: use drop-shadow for visibility |
| Focus indicators    | 2px indigo-500 outline with 2px offset               |
| Touch targets       | 44x44px minimum for all interactive cells            |
| Screen readers      | Full context announcements                           |
| Keyboard navigation | Tab through cells, Enter to toggle                   |

### Screen Reader Announcements

| Element        | Announcement                                                     |
| -------------- | ---------------------------------------------------------------- |
| Chart header   | "{Name}'s Star Chart. {current} of {target} stars toward {goal}" |
| Day header     | "Tuesday, January 13th, today"                                   |
| Completed cell | "Brush Teeth AM, Tuesday, completed, 1 star earned"              |
| Pending cell   | "Make Bed, Tuesday, pending, button, tap to complete"            |
| Missed cell    | "Clear Table, Monday, missed"                                    |
| Not applicable | "PJs On, Tuesday, not scheduled"                                 |
| Today's stats  | "Today's progress: 1 of 5 tasks completed"                       |

### Keyboard Navigation

| Key         | Action                               |
| ----------- | ------------------------------------ |
| Tab         | Move between cells and buttons       |
| Enter/Space | Toggle completion on pending cells   |
| Escape      | Close any open dialogs               |
| Arrow keys  | Navigate grid (optional enhancement) |

---

## Component Structure

```
src/components/reward-chart/
├── reward-chart-page.tsx           # Main page component
├── empty-chart-state.tsx           # State when no tasks exist
├── select-member-state.tsx         # State when selecting a child
├── contexts/
│   └── reward-chart-context.tsx    # Chart state + mutation hooks
├── chart-header/
│   ├── index.ts                    # Re-exports
│   ├── chart-header.tsx            # Title + greeting
│   └── goal-progress-ring.tsx      # Circular progress indicator
├── weekly-grid/
│   ├── index.ts                    # Re-exports
│   ├── weekly-grid.tsx             # Main grid component
│   ├── day-header.tsx              # Column header
│   ├── task-row.tsx                # Row with task + cells
│   ├── task-cell.tsx               # Individual cell
│   ├── grid-footer.tsx             # Info + today's stats
│   └── add-task-row.tsx            # "Add task" button row
├── bottom-cards/
│   ├── index.ts                    # Re-exports
│   ├── next-reward-card.tsx        # Goal preview card
│   └── message-card.tsx            # Parent message card
├── dialogs/
│   ├── index.ts                    # Re-exports
│   ├── task-dialog.tsx             # Create/edit task dialog
│   ├── goal-dialog.tsx             # Create/edit goal dialog
│   └── message-dialog.tsx          # Send message dialog
├── interfaces.ts                    # TypeScript interfaces
├── constants.ts                     # Colors, icons, default tasks
└── index.ts                         # Main export barrel
```

### Hooks (in `src/hooks/use-reward-chart.ts`)

React Query hooks for data fetching and mutations:

- `useRewardChartWeek()` - Fetch weekly grid data
- `useCompleteTask()` - Complete task mutation
- `useUndoTaskCompletion()` - Undo completion mutation
- `useCreateTask()` - Create new task
- `useUpdateTask()` - Update existing task
- `useDeleteTask()` - Soft delete task
- `useReorderTasks()` - Reorder tasks (drag-drop)
- `useCreateGoal()` - Create new goal
- `useUpdateGoal()` - Update existing goal
- `useSendChartMessage()` - Send encouragement message

### State Management

```typescript
// Context for chart state (from reward-chart-context.tsx)
interface RewardChartContextValue {
  weekData: WeeklyChartData | null;
  isLoading: boolean;
  error: Error | null;
  familyId: string;
  chartId: string;
  isManager: boolean;
  allChildren?: ChildChartInfo[];

  // Completion mutations
  completeTask: (taskId: string) => Promise<CompleteTaskResponse | null>;
  undoCompletion: (taskId: string) => Promise<UndoCompletionResponse | null>;

  // Task mutations (manager only)
  createTask: (input: CreateTaskInput) => Promise<void>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  reorderTasks: (taskIds: string[]) => Promise<void>;

  // Goal mutations (manager only)
  createGoal: (input: CreateGoalInput) => Promise<void>;
  updateGoal: (goalId: string, input: UpdateGoalInput) => Promise<void>;

  // Message mutations (manager only)
  sendMessage: (content: string) => Promise<void>;
}
```

### Performance Considerations

- Memoize cell components to prevent unnecessary re-renders
- Use optimistic updates for completion toggles
- Prefetch next week's data when approaching Sunday
- Use `will-change: transform` on animated elements
