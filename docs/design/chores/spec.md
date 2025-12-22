# Chores Specification

> **Design Reference Only**
>
> This document contains visual mockups and styling references. For implementation
> requirements, data models, and interaction rules, see the feature specification
> in `docs/features/chores/`.
>
> When implementing, apply the project's brand guidelines and established patterns
> from the codebase. Do not copy mockup code directly.

This document defines the design, layout, components, and behavior for the Family Planner chores view.

---

## Table of Contents

1. [Overview](#overview)
2. [Layout Structure](#layout-structure)
3. [Components](#components)
4. [Filter Views](#filter-views)
5. [Chore Card](#chore-card)
6. [Progress & Gamification](#progress--gamification)
7. [Interactions](#interactions)
8. [Data Model](#data-model)
9. [Responsive Design](#responsive-design)
10. [Brand Styling](#brand-styling)
11. [Accessibility](#accessibility)
12. [Technical Implementation](#technical-implementation)

---

## Overview

The chores view serves as the **task display and completion interface** for the Family Planner application. It provides family members with an at-a-glance view of outstanding household tasks, optimized for quick completion on wall-mounted displays and mobile devices.

### Purpose

- Display outstanding chores for all family members
- Enable quick task completion with a single tap
- Track daily progress and maintain streaks
- Surface urgent and overdue tasks prominently
- Provide gamification feedback to encourage children

### Design Principles

- **Warm & Welcoming**: Friendly greetings, encouraging progress messaging
- **Organized & Reliable**: Clear visual hierarchy, intuitive filtering
- **Playful yet Functional**: Engaging for kids, practical for parents
- **Wall Display Optimized**: Large touch targets, glanceable information, high contrast

### Key Constraints

- **Read-only interface**: Chore creation, editing, and assignment is managed through a separate administration interface
- **Completion-focused**: The only interactive action is marking chores as complete
- **Display-first**: Optimized for passive viewing and quick interactions

---

## Layout Structure

### Desktop/Tablet (md+)

```
+-------------------------------------------------------------------+
| Header (Wall Hub + Date/Time + Weather + Profile)                 |
+-------------------------------------------------------------------+
| Greeting Section                                                   |
| "Good Morning, Smiths!" - "Let's crush today's goals."            |
+-------------------------------------------------------------------+
| Progress Card                                                      |
| [Trophy] Daily Streak: 12 Days              3/8 Done [=========]  |
+-------------------------------------------------------------------+
| Filter Tabs                                                        |
| [All Chores] [By Person] [Urgent]                                 |
+-------------------------------------------------------------------+
| Chore List / Columns                                               |
| +------------------+ +------------------+ +------------------+     |
| | [Avatar]         | | [Avatar]         | | [Avatar]         |     |
| | Chore Title      | | Chore Title      | | Chore Title      |     |
| | [Badge] Assignee | | [Badge] Assignee | | [Badge] Assignee |     |
| |              [v] | |              [v] | |              [v] |     |
| +------------------+ +------------------+ +------------------+     |
+-------------------------------------------------------------------+
| FAB (navigates to chore management)                        [+]    |
+-------------------------------------------------------------------+
```

### Mobile (< md)

```
+---------------------------+
| Header (compact)          |
+---------------------------+
| Greeting + Date           |
+---------------------------+
| Progress Card             |
+---------------------------+
| Filter Tabs (scrollable)  |
+---------------------------+
| Chore List (single col)   |
| +---------------------+   |
| | Chore Card 1        |   |
| +---------------------+   |
| | Chore Card 2        |   |
| +---------------------+   |
| | ...                 |   |
| +---------------------+   |
+---------------------------+
| FAB                   [+] |
+---------------------------+
```

---

## Components

### 1. Header

The header follows the standard Wall Hub header pattern used across the application.

| Element | Specification |
|---------|---------------|
| Brand icon | `smart_display` in Primary/20 container |
| Title | "Wall Hub", xl Bold, Lexend |
| Subtitle | Date + Time (e.g., "Monday, Oct 24 - 9:41 AM") |
| Weather widget | Temperature + icon, pill style |
| Profile avatar | 40px circular, ring-2 |

### 2. Greeting Section

Dynamic greeting based on time of day, personalized with family name.

| Element | Specification |
|---------|---------------|
| Greeting | Time-based (see Voice & Tone), 3xl-4xl Bold |
| Subtitle | Encouraging message, lg, Text Secondary |
| Font | Lexend |
| Spacing | px-6 pt-8 pb-4 |

#### Greeting Logic

```
05:00 - 11:59 -> "Good Morning, {FamilyName}!"
12:00 - 16:59 -> "Good Afternoon, {FamilyName}!"
17:00 - 20:59 -> "Good Evening, {FamilyName}!"
21:00 - 04:59 -> "Good Night, {FamilyName}!"
```

#### Subtitle Variants

- Morning: "Let's crush today's goals."
- Afternoon: "Keep up the momentum!"
- Evening: "Almost there!"
- Night: "Rest up for tomorrow."

### 3. Progress Card

Displays daily completion progress and streak information.

| Property | Value |
|----------|-------|
| Background | Surface (white / #1c2e26) |
| Border | 1px solid Border Default |
| Border radius | 2xl (16px) |
| Shadow | sm |
| Padding | 20px |

#### Elements

| Element | Specification |
|---------|---------------|
| Trophy icon | `trophy`, Primary color (#13ec92), 24px |
| Streak label | "Daily Streak: {N} Days", base Bold |
| Completion count | "{done}/{total} Done", sm Bold, Text Secondary |
| Progress bar | Full width, 12px height, Primary fill |

#### Progress Bar

```
Track: Border Default (#dbe6e1 / #2a3831)
Fill: Primary (#13ec92)
Height: 12px
Border radius: full
Transition: width 500ms ease-out
```

### 4. Filter Tabs

Segmented control for switching between chore views.

| Property | Value |
|----------|-------|
| Container | h-12, rounded-xl, Background Muted |
| Padding | p-1 |
| Position | sticky top-[80px], z-40 |

#### Tab States

**Active Tab**:
| Property | Value |
|----------|-------|
| Background | Primary (#13ec92) |
| Text | Dark (#111815) |
| Shadow | sm |
| Border radius | lg (8px) |

**Inactive Tab**:
| Property | Value |
|----------|-------|
| Background | Transparent |
| Text | Text Secondary (#618979 / #8baaa0) |
| Hover | Surface Hover |

#### Available Filters

| Filter | Icon | Description |
|--------|------|-------------|
| All Chores | - | All outstanding chores, sorted by urgency |
| By Person | - | Columnar view per family member |
| Urgent | - | Only urgent and overdue chores |

### 5. Floating Action Button (FAB)

Navigates to chore management interface (external).

| Property | Value |
|----------|-------|
| Position | fixed, bottom-8, right-8 |
| Size | 64px (size-16) |
| Background | Primary (#13ec92) |
| Icon | `add`, 36px, Dark (#111815) |
| Border radius | full |
| Shadow | lg |
| Hover | shadow-xl, scale-105 |
| Transition | all 300ms |

---

## Filter Views

### All Chores View

Default view displaying all outstanding chores in a single scrollable list.

#### Sort Order

1. Overdue chores (oldest first)
2. Urgent chores (soonest due first)
3. Today's chores (by time)
4. Future chores (by date)
5. Flexible/no deadline chores (alphabetically)

#### Layout

- Single column, full width
- Gap: 12px between cards
- Padding: px-6

### By Person View

Displays family members in side-by-side columns with their assigned chores.

#### Column Layout

```
+----------------+ +----------------+ +----------------+ +----------------+
| [Avatar]       | | [Avatar]       | | [Avatar]       | | [Avatar]       |
| Dad            | | Mom            | | Sarah          | | Sam            |
| 2 chores       | | 1 chore        | | 3 chores       | | 2 chores       |
+----------------+ +----------------+ +----------------+ +----------------+
| Take out trash | | Water plants   | | Empty dish...  | | Feed the dog   |
| Fix the shelf  | |                | | Clean room     | | Homework       |
|                | |                | | Set table      | |                |
+----------------+ +----------------+ +----------------+ +----------------+
```

#### Column Specifications

| Property | Value |
|----------|-------|
| Min width | 280px |
| Max width | 320px |
| Background | Surface |
| Border | 1px solid Border Default |
| Border radius | 2xl (16px) |
| Padding | 16px |
| Gap between columns | 16px |
| Scroll | Horizontal on overflow |

#### Column Header

| Element | Specification |
|---------|---------------|
| Avatar | 48px circular, ring-2 |
| Name | lg Bold, Text Primary |
| Count | sm, Text Secondary (e.g., "3 chores") |

### Urgent View

Filtered view showing only urgent and overdue chores.

#### Urgency Determination

A chore is considered **urgent** if ANY of these conditions are true:

1. **Overdue**: Due date/time has passed
2. **Due soon**: Due within the next 4 hours
3. **Manual flag**: Explicitly marked as urgent by administrator

#### Visual Distinction

| Status | Badge Color | Badge Text |
|--------|-------------|------------|
| Overdue | orange-50/orange-600 | "OVERDUE" |
| Due tonight | red-50/red-600 | "TONIGHT - {time}" |
| Urgent (manual) | red-50/red-600 | Priority icon badge |

---

## Chore Card

The primary UI element displaying individual chores.

### Card Structure

```
+-------------------------------------------------------------+
| [Avatar (56px)]  [Title]                              [Check]|
|    [!]           [Status Badge] [Assignee]                   |
+-------------------------------------------------------------+
```

### Card Specifications

| Property | Value |
|----------|-------|
| Background | Surface (white / #1c2e26) |
| Border | 1px solid Border Default |
| Border radius | 2xl (16px) |
| Shadow | sm |
| Padding | 20px (px-5 py-4) |
| Gap | 16px |
| Hover border | Primary/50 |
| Transition | all 200ms |
| Cursor | pointer |

### Avatar Section

| Element | Specification |
|---------|---------------|
| Size | 56px (h-14 w-14) |
| Shape | Circular |
| Ring | 2px white / surface-dark |
| Image | User photo or fallback |

#### Priority Indicator

When chore is urgent, show indicator badge on avatar:

| Property | Value |
|----------|-------|
| Position | absolute, -bottom-1, -right-1 |
| Size | 24px |
| Background | red-100 / red-900 |
| Icon | `priority_high`, 14px |
| Icon color | red-600 / red-200 |
| Border | 2px white / surface-dark |

### Content Section

| Element | Specification |
|---------|---------------|
| Title | lg Bold, Text Primary |
| Title hover | Primary color |
| Truncate | Single line with ellipsis |

### Status Badge

Contextual badge showing timing/recurrence information.

| Status | Background | Text Color | Example |
|--------|------------|------------|---------|
| Tonight | red-50 / red-900/30 | red-600 / red-300 | "TONIGHT - 8 PM" |
| Overdue | orange-50 / orange-900/30 | orange-600 / orange-300 | "OVERDUE" |
| Morning | blue-50 / blue-900/30 | blue-600 / blue-300 | "MORNING" |
| Weekly | Border Default | Text Primary / gray-300 | "WEEKLY" |
| Weekend | Border Default | Text Primary / gray-300 | "WEEKEND" |
| Daily | green-50 / green-900/30 | green-600 / green-300 | "DAILY" |

#### Badge Styling

| Property | Value |
|----------|-------|
| Font | xs Bold, uppercase |
| Padding | px-2 py-0.5 |
| Border radius | full |
| Letter spacing | tracking-wide |

### Assignee Label

| Property | Value |
|----------|-------|
| Font | sm, Text Secondary |
| Position | After status badge |

### Check Button

Large, touch-friendly completion button.

| Property | Value |
|----------|-------|
| Size | 48px (size-12) |
| Background | Surface Muted (#f0f4f3 / #2a4036) |
| Icon | `check`, 32px |
| Icon color | Transparent (hidden until hover) |
| Border radius | full |
| Hover background | Primary (#13ec92) |
| Hover icon | Dark (#111815) |
| Active | scale-90 |
| Transition | all 300ms |

### Card States

#### Default State
Standard appearance as described above.

#### Hover State
```css
.chore-card:hover {
  border-color: var(--color-primary-50);
}
.chore-card:hover .title {
  color: var(--color-primary);
}
```

#### Low Priority / Future State
For chores scheduled far in the future:

| Property | Value |
|----------|-------|
| Opacity | 80% |
| Background | Surface with reduced opacity |

#### Completed State (Momentary)
Brief animation shown after completion:

```css
.chore-card.completed {
  opacity: 0;
  transform: translateX(100%);
  transition: all 300ms ease-out;
}
```

---

## Progress & Gamification

### Daily Streak

Tracks consecutive days of completing all assigned chores.

#### Streak Logic

```
Streak increments when:
- All chores for the day are marked complete
- Check performed before midnight

Streak resets when:
- Day ends with incomplete chores
- Manually reset by administrator
```

#### Streak Display

| Element | Specification |
|---------|---------------|
| Icon | `trophy`, Primary color |
| Label | "Daily Streak: {N} Days" |
| Font | base Bold |

### Completion Progress

Real-time progress indicator for the current day.

| Element | Specification |
|---------|---------------|
| Format | "{completed}/{total} Done" |
| Font | sm Bold, Text Secondary |
| Progress bar | Visual percentage fill |

### XP Integration

When gamification is enabled (see Calendar spec), chore completion awards XP.

| Chore Type | XP Reward |
|------------|-----------|
| Daily routine | 10 XP |
| Weekly task | 25 XP |
| Urgent/time-sensitive | 15 XP |
| Special/bonus | 50 XP |

*Note: XP values are configured in the administration interface.*

---

## Interactions

### Completing a Chore

The only interactive action on this interface.

#### Flow

1. User taps check button on chore card
2. Button fills with Primary color
3. Checkmark icon appears
4. Card animates out (slide + fade)
5. Progress bar updates
6. Streak updates if applicable
7. Optional: Toast notification with XP reward

#### Animation Sequence

```
1. Check button: scale(1.1), background -> Primary, icon visible
2. Card: after 200ms delay, opacity -> 0, translateX(100%)
3. Remove from DOM after 300ms
4. Progress bar: width transition 300ms
```

### Navigation

#### FAB Tap
- Navigates to chore management interface
- Could open in modal, new page, or external app

#### Card Tap (Non-button area)
- Optional: Show chore details in a read-only dialog
- Alternative: No action (button-only interaction)

### Pull to Refresh (Mobile)

| Property | Value |
|----------|-------|
| Threshold | 80px |
| Indicator | Circular spinner, Primary color |
| Action | Refetch chores from database |

---

## Data Model

### Chore Interface

```typescript
interface IChore {
  id: string
  title: string
  description?: string
  assignedTo: IUser
  dueDate?: Date          // Optional due date
  dueTime?: string        // Optional time (HH:mm format)
  recurrence: ChoreRecurrence
  isUrgent: boolean       // Manual urgency flag
  status: ChoreStatus
  xpReward: number
  createdAt: Date
  completedAt?: Date
  completedBy?: IUser
}

type ChoreRecurrence =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'weekdays'
  | 'weekends'
  | 'monthly'

type ChoreStatus =
  | 'pending'
  | 'completed'
  | 'skipped'

interface IUser {
  id: string
  name: string
  picturePath: string | null
  color: string           // For avatar fallback
}
```

### Computed Properties

```typescript
// Derived urgency status
function getUrgencyStatus(chore: IChore): UrgencyStatus {
  if (chore.status !== 'pending') return 'none'
  if (chore.isUrgent) return 'urgent'
  if (!chore.dueDate) return 'none'

  const now = new Date()
  const due = combineDateAndTime(chore.dueDate, chore.dueTime)

  if (due < now) return 'overdue'
  if (due < addHours(now, 4)) return 'due-soon'

  return 'none'
}

type UrgencyStatus = 'none' | 'due-soon' | 'urgent' | 'overdue'
```

### Database Schema

```sql
CREATE TABLE chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to_id UUID REFERENCES users(id),
  due_date DATE,
  due_time TIME,
  recurrence VARCHAR(20) DEFAULT 'once',
  is_urgent BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending',
  xp_reward INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  completed_by_id UUID REFERENCES users(id)
);
```

### Data Sources

| Data | Source | Refresh Rate |
|------|--------|--------------|
| Chores | PostgreSQL | On mount, after completion |
| Users | PostgreSQL | On mount |
| Streak | PostgreSQL | After completion |
| Progress | Computed | Real-time |

---

## Responsive Design

### Breakpoints

| Breakpoint | Layout | Columns (By Person) |
|------------|--------|---------------------|
| < sm (640px) | Single column | 1 |
| sm - md | Single column | 1-2 (scrollable) |
| md - lg | Single column | 2-3 |
| lg - xl | Single column | 3-4 |
| xl+ | Single column | 4+ |

### Mobile Optimizations

- Filter tabs horizontally scrollable
- Card padding reduced to 16px
- Check button size maintained (touch target)
- FAB position adjusted for thumb reach
- Greeting text size reduced to 2xl

### Wall Display Mode (2xl+)

- Larger greeting text (4xl)
- Increased card padding
- Larger avatars (64px)
- Auto-refresh every 30 seconds
- Hide FAB (management via separate device)

---

## Brand Styling

### Color Variables

```css
/* From brand guidelines */
--color-primary: #13ec92;
--color-primary-hover: #0fd683;
--color-background-light: #f6f8f7;
--color-background-dark: #10221a;
--color-surface-light: #ffffff;
--color-surface-dark: #1c2e26;
--color-text-primary-light: #111815;
--color-text-primary-dark: #ffffff;
--color-text-secondary-light: #618979;
--color-text-secondary-dark: #8baea0;
--color-border-light: #dbe6e1;
--color-border-dark: #2a3831;
```

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Greeting | Lexend | 3xl-4xl | Bold |
| Subtitle | Lexend | lg | Regular |
| Card title | Lexend | lg | Bold |
| Badge text | Lexend | xs | Bold |
| Assignee | Noto Sans | sm | Regular |
| Progress label | Lexend | base | Bold |
| Filter tabs | Lexend | sm | Bold |

### Shadows

| Usage | Value |
|-------|-------|
| Cards | `0 1px 2px rgba(0,0,0,0.05)` |
| FAB | `0 10px 15px rgba(0,0,0,0.1)` |
| FAB hover | `0 25px 50px rgba(0,0,0,0.25)` |

### Animations

```css
/* Standard transition */
transition: all 200ms ease;

/* Button press */
.button:active {
  transform: scale(0.95);
}

/* Check button activation */
.check-button:active {
  transform: scale(0.90);
}

/* Card removal */
@keyframes slideOut {
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}
```

---

## Accessibility

### WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | All text meets 4.5:1 minimum |
| Focus indicators | 2px Primary outline with 2px offset |
| Touch targets | Minimum 48x48px for check button |
| Screen readers | ARIA labels on interactive elements |
| Reduced motion | Respect `prefers-reduced-motion` |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move between chore cards and check buttons |
| Enter/Space | Activate check button (complete chore) |
| Arrow keys | Navigate between cards in list |

### Screen Reader Considerations

- Chore cards: "{title}, assigned to {name}, {status badge}"
- Check button: "Mark {title} as complete"
- Progress: "{completed} of {total} chores completed"
- Streak: "Daily streak: {N} days"

### Focus States

```css
.chore-card:focus-visible {
  outline: 2px solid #13ec92;
  outline-offset: 2px;
}

.check-button:focus-visible {
  outline: 2px solid #13ec92;
  outline-offset: 2px;
  background: var(--color-primary);
}
```

---

## Technical Implementation

### Component Architecture

```
src/components/chores/
├── index.tsx                    # Main chores page
├── interfaces.ts                # TypeScript interfaces
├── types.ts                     # Type definitions
├── helpers.ts                   # Utility functions
├── hooks.ts                     # Custom hooks
├── contexts/
│   └── chores-context.tsx       # State management
├── header/
│   └── chores-header.tsx        # Page header
├── progress/
│   └── progress-card.tsx        # Streak + progress display
├── filters/
│   └── filter-tabs.tsx          # View filter tabs
├── views/
│   ├── all-chores-view.tsx      # List view
│   ├── by-person-view.tsx       # Column view
│   └── urgent-view.tsx          # Filtered urgent view
├── components/
│   ├── chore-card.tsx           # Individual chore card
│   ├── chore-list.tsx           # Scrollable chore list
│   ├── person-column.tsx        # Family member column
│   └── check-button.tsx         # Completion button
└── fab/
    └── add-chore-fab.tsx        # Floating action button
```

### State Management

**ChoresProvider** manages:
- Current filter view (all/person/urgent)
- Chores list
- Completion state
- Streak data
- Optimistic updates

### Hooks

```typescript
// Main context hook
function useChores(): ChoresContextValue

// Individual chore operations
function useCompleteChore(): (choreId: string) => Promise<void>

// Computed data
function useChoreProgress(): { completed: number; total: number; percentage: number }
function useStreak(): { days: number; isActive: boolean }
function useGroupedByPerson(): Map<string, IChore[]>
```

### API Integration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chores` | GET | Fetch all pending chores |
| `/api/chores/:id/complete` | POST | Mark chore as complete |
| `/api/chores/streak` | GET | Get current streak data |
| `/api/chores/progress` | GET | Get today's progress |

### Optimistic Updates

```typescript
// Complete chore with optimistic update
async function completeChore(choreId: string) {
  // Immediately update UI
  setChores(prev => prev.filter(c => c.id !== choreId))
  updateProgress(prev => ({ ...prev, completed: prev.completed + 1 }))

  try {
    await api.post(`/chores/${choreId}/complete`)
  } catch (error) {
    // Rollback on failure
    refetchChores()
    showErrorToast('Failed to complete chore')
  }
}
```

### Performance Considerations

- Memoize filtered/sorted chore lists
- Virtualize long chore lists (>50 items)
- Debounce completion requests
- Prefetch user avatars
- Use `will-change: transform` for animated elements

---

## Dark Mode

Full dark mode support following the application theme.

### Color Mapping

| Element | Light | Dark |
|---------|-------|------|
| Page background | #f6f8f7 | #10221a |
| Cards | #ffffff | #1c2e26 |
| Text Primary | #111815 | #ffffff |
| Text Secondary | #618979 | #8baea0 |
| Borders | #dbe6e1 | #2a3831 |
| Primary | #13ec92 | #13ec92 |
| Check button bg | #f0f4f3 | #2a4036 |

### Implementation

```css
/* Applied via dark class on html element */
.dark .chore-card {
  background: #1c2e26;
  border-color: #2a3831;
}

.dark .check-button {
  background: #2a4036;
}
```

---

## Design Assets Reference

| File | Description |
|------|-------------|
| `chores-design-1.png` | Main chores view mockup |
| `chores-code-1.html` | Full HTML/CSS reference implementation |

---

*Last updated: December 2024*
