# Feature Documentation Update Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update all feature documentation to align with current implementations and add missing feature specs.

**Architecture:** Each feature requires three core documents (spec.md, data-model.md, ui.md) following the established pattern. Work is parallelizable by feature since each feature's documentation is independent.

**Tech Stack:** Markdown documentation, referencing TypeScript/Drizzle schemas and React components.

---

## Summary of Changes

### Missing Feature Docs (New)

| Feature         | Priority | Files to Create               |
| --------------- | -------- | ----------------------------- |
| Timers          | High     | spec.md, data-model.md, ui.md |
| Device/Wall-Hub | High     | spec.md, data-model.md, ui.md |

### Existing Docs to Update

| Feature          | Status   | Key Updates Needed                                                            |
| ---------------- | -------- | ----------------------------------------------------------------------------- |
| Chores           | Outdated | Schema uses `familyMembers.id` not `users.id`; add `updatedAt`; fix API paths |
| Calendar         | Verify   | Check schema alignment, push notifications, privacy settings                  |
| Dashboard        | Verify   | Check component alignment with actual implementation                          |
| Families         | Verify   | Check invitation system, child accounts, device users                         |
| Google Sync      | Verify   | Check webhook channels, error tracking, sync status                           |
| Reward Chart     | Verify   | Check star transaction integration                                            |
| Reward Store     | Verify   | Check redemption limits, primary goals                                        |
| UI (Header/Menu) | Verify   | Check sync status indicators, cache status                                    |

---

## Complete Feature Spec Structure (Reference)

Each feature should have:

```
feature-name/
├── spec.md        # Overview, documents table, design ref, constraints, key features
├── data-model.md  # Drizzle schema, TypeScript interfaces, API endpoints, relationships
├── ui.md          # Interaction modes (Wall/Management), components, accessibility
└── [optional].md  # api.md (complex APIs), gaps.md (deferred work)
```

### Standard spec.md Sections

1. Overview (what the feature does)
2. Documents table (links to other docs)
3. Design Reference (mockup links)
4. Key Constraints (limitations/scope)
5. Key Features (bullet list)

### Standard data-model.md Sections

1. Entity overview
2. Database Schema (Drizzle TypeScript)
3. Column descriptions table
4. TypeScript interfaces (UI layer)
5. Data relationships diagram
6. API endpoints table
7. Data sources table

### Standard ui.md Sections

1. Interaction Modes (Wall Display vs Management)
2. Layout Structure (responsive breakpoints)
3. Components (with interface definitions)
4. Accessibility (WCAG, keyboard nav)
5. Dark Mode (color mappings)
6. Animations (transitions)

---

## Parallel Execution Strategy

Tasks are grouped by feature for parallel subagent execution:

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Add Missing Features (parallel)                       │
├────────────────────┬────────────────────────────────────────────┤
│ Subagent 1         │ Subagent 2                                 │
│ Create Timers docs │ Create Device/Wall-Hub docs                │
└────────────────────┴────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Update Existing Features (parallel, 4 subagents)      │
├────────────────────┬────────────────────────────────────────────┤
│ Subagent 3         │ Subagent 4                                 │
│ Update Chores      │ Update Calendar                            │
├────────────────────┼────────────────────────────────────────────┤
│ Subagent 5         │ Subagent 6                                 │
│ Update Families    │ Update Google Sync                         │
└────────────────────┴────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: Update Remaining Features (parallel, 4 subagents)     │
├────────────────────┬────────────────────────────────────────────┤
│ Subagent 7         │ Subagent 8                                 │
│ Update Dashboard   │ Update Reward Chart                        │
├────────────────────┼────────────────────────────────────────────┤
│ Subagent 9         │ Subagent 10                                │
│ Update Reward Store│ Update UI (Header/Menu)                    │
└────────────────────┴────────────────────────────────────────────┘
```

---

## Task 1: Create Timers Feature Docs

**Files:**

- Create: `docs/features/timers/spec.md`
- Create: `docs/features/timers/data-model.md`
- Create: `docs/features/timers/ui.md`
- Reference: `src/server/schema.ts:304-358` (timerTemplates, activeTimers)
- Reference: `src/server/services/timer-template-service.ts`
- Reference: `src/server/services/active-timer-service.ts`
- Reference: `src/components/timers/`
- Reference: `src/app/[locale]/(app)/timers/page.tsx`

**Step 1: Read implementation files**

```bash
# Read schema for timer tables
grep -A 60 "Timer Templates table" src/server/schema.ts

# Read timer services
cat src/server/services/timer-template-service.ts
cat src/server/services/active-timer-service.ts

# List timer components
ls -la src/components/timers/

# Read timer page
cat src/app/[locale]/(app)/timers/page.tsx

# Read timer API routes
ls -la src/app/api/v1/timers/
```

**Step 2: Create spec.md**

Create `docs/features/timers/spec.md` with:

- Overview: Timer management for family activities (screen time, chores, activities)
- Documents table linking to data-model.md and ui.md
- Key features:
  - Timer templates (reusable definitions)
  - Active timers (running instances)
  - Categories: screen, chore, activity
  - Star rewards on completion
  - Alert modes: none, completion, escalating
  - Cooldown/confirmation periods
  - Control modes: parents-only or anyone
  - Quick action pins
  - Pause/resume functionality
  - Device ownership tracking

**Step 3: Create data-model.md**

Create `docs/features/timers/data-model.md` with:

- timerTemplates schema (from schema.ts:304-321)
- activeTimers schema (from schema.ts:326-358)
- TypeScript interfaces for UI
- API endpoints table:
  - GET/POST `/api/v1/timers/templates`
  - GET/PATCH/DELETE `/api/v1/timers/templates/:id`
  - GET/POST `/api/v1/timers/active`
  - GET/PATCH/DELETE `/api/v1/timers/active/:id`
  - POST `/api/v1/timers/active/:id/confirm`
- Relationship diagram
- Enums: TimerCategory, TimerStatus, ControlMode, AlertMode

**Step 4: Create ui.md**

Create `docs/features/timers/ui.md` with:

- Interaction modes (Wall Display: view/control, Management: full CRUD)
- Components:
  - TimerCard (active timer display with countdown)
  - TimerTemplateCard (template management)
  - TimerCountdown (countdown ring/bar)
  - QuickActionButton (pinned templates)
  - TimerForm (create/edit template)
- Responsive layouts
- Accessibility (screen reader countdown announcements)
- Dark mode colors

**Step 5: Verify documentation completeness**

```bash
# Verify all files created
ls -la docs/features/timers/

# Check file contents have required sections
head -50 docs/features/timers/spec.md
head -50 docs/features/timers/data-model.md
head -50 docs/features/timers/ui.md
```

---

## Task 2: Create Device/Wall-Hub Feature Docs

**Files:**

- Create: `docs/features/device/spec.md`
- Create: `docs/features/device/data-model.md`
- Create: `docs/features/device/ui.md`
- Reference: `src/server/schema.ts` (devicePairingCodes table)
- Reference: `src/server/services/device-service.ts`
- Reference: `src/components/device/`
- Reference: `src/components/wall-hub/`
- Reference: `src/app/[locale]/device/pair/`

**Step 1: Read implementation files**

```bash
# Read device schema
grep -A 20 "devicePairingCodes" src/server/schema.ts

# Read device service
cat src/server/services/device-service.ts

# List components
ls -la src/components/device/
ls -la src/components/wall-hub/

# Read device routes
ls -la src/app/[locale]/device/
ls -la src/app/api/v1/devices/
```

**Step 2: Create spec.md**

Create `docs/features/device/spec.md` with:

- Overview: Device pairing and wall-hub display mode
- Key features:
  - 6-digit pairing codes
  - Device user type
  - Wall-mounted display optimization
  - Today/Week views for wall display
  - Person filtering
  - Task checking from display
  - Auto-sleep/wake scheduling (if implemented)

**Step 3: Create data-model.md**

Create `docs/features/device/data-model.md` with:

- devicePairingCodes schema
- Device user type handling
- API endpoints:
  - GET/POST `/api/v1/devices`
  - GET/PATCH/DELETE `/api/v1/devices/:id`
  - POST `/api/v1/devices/pair/generate`

**Step 4: Create ui.md**

Create `docs/features/device/ui.md` with:

- Wall-Hub components:
  - PersonColumnHeader
  - ScheduleCard
  - TodayView
  - WeekView
- Device pairing flow UI
- Touch-optimized interactions
- Display mode settings

**Step 5: Verify documentation completeness**

```bash
ls -la docs/features/device/
```

---

## Task 3: Update Chores Feature Docs

**Files:**

- Modify: `docs/features/chores/spec.md`
- Modify: `docs/features/chores/data-model.md`
- Modify: `docs/features/chores/ui.md`
- Reference: `src/server/schema.ts:273-295` (chores table)
- Reference: `src/server/services/chore-service.ts`

**Step 1: Identify discrepancies**

Current issues in data-model.md:

1. Schema says `assigned_to_id UUID REFERENCES users(id)` but actual uses `familyMembers.id`
2. Missing `updatedAt` field in documented schema
3. API paths don't match actual (`/api/chores` vs `/api/v1/families/:familyId/chores`)
4. Interface uses `IUser` but should reference `IFamilyMember`

**Step 2: Update data-model.md schema**

Replace SQL schema with actual Drizzle schema:

```typescript
export const chores = pgTable("chores", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  assignedToId: text("assigned_to_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  dueDate: date("due_date", { mode: "string" }),
  dueTime: text("due_time"), // HH:mm format
  recurrence: text("recurrence").notNull().default("once"),
  isUrgent: boolean("is_urgent").notNull().default(false),
  status: text("status").notNull().default("pending"),
  starReward: integer("star_reward").notNull().default(10),
  completedAt: timestamp("completed_at", { mode: "date" }),
  completedById: text("completed_by_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 3: Update API endpoints**

Replace endpoints with actual:

- GET `/api/v1/families/:familyId/chores`
- POST `/api/v1/families/:familyId/chores`
- GET `/api/v1/families/:familyId/chores/:choreId`
- PATCH `/api/v1/families/:familyId/chores/:choreId`
- DELETE `/api/v1/families/:familyId/chores/:choreId`
- POST `/api/v1/families/:familyId/chores/:choreId/complete`
- GET `/api/v1/families/:familyId/chores/progress`

**Step 4: Update TypeScript interfaces**

Update IChore to use IFamilyMember instead of IUser:

```typescript
interface IChore {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  assignedTo: IFamilyMember | null;
  // ... rest
}
```

**Step 5: Verify documentation alignment**

Read updated files and compare with actual implementation.

---

## Task 4: Update Calendar Feature Docs

**Files:**

- Modify: `docs/features/calendar/spec.md`
- Modify: `docs/features/calendar/data-model.md`
- Modify: `docs/features/calendar/ui.md`
- Reference: `src/server/schema.ts` (events, eventParticipants)
- Reference: `src/components/calendar/`
- Reference: `src/server/services/event-service.ts`

**Step 1: Read actual implementation**

```bash
# Read event schema
grep -A 50 "export const events" src/server/schema.ts

# Read event participants
grep -A 30 "eventParticipants" src/server/schema.ts

# Check calendar components
ls -la src/components/calendar/
ls -la src/components/calendar/views/
```

**Step 2: Update spec.md**

Verify key features match implementation:

- Multiple views (day, week, month, year, agenda)
- Drag-and-drop rescheduling
- Google Calendar integration
- Event privacy (per-calendar)
- Event participants

**Step 3: Update data-model.md**

Ensure schema matches actual Drizzle definitions:

- events table
- eventParticipants table
- syncStatus enum
- Privacy settings

**Step 4: Update ui.md**

Verify components match actual:

- CalendarProvider context
- View components (DayView, WeekView, etc.)
- Event card components
- DnD implementation

**Step 5: Verify documentation**

Compare docs with implementation files.

---

## Task 5: Update Families Feature Docs

**Files:**

- Modify: `docs/features/families/spec.md`
- Modify: `docs/features/families/data-model.md`
- Modify: `docs/features/families/ui.md`
- Reference: `src/server/schema.ts` (families, familyMembers, familyInvites)
- Reference: `src/server/services/family-service.ts`
- Reference: `src/server/services/child-service.ts`

**Step 1: Read actual implementation**

```bash
grep -A 30 "export const families" src/server/schema.ts
grep -A 40 "familyMembers" src/server/schema.ts
grep -A 30 "familyInvites" src/server/schema.ts
cat src/server/services/family-service.ts
cat src/server/services/child-service.ts
```

**Step 2: Update data-model.md**

Add missing features:

- familyInvites table (invitation system)
- childUpgradeTokens table
- Device user type in members
- Member roles (manager, participant, caregiver, device)

**Step 3: Update API endpoints**

Add actual endpoints:

- Invitation endpoints
- Child account endpoints
- Member star balance endpoints

**Step 4: Verify documentation**

Ensure all tables and features are documented.

---

## Task 6: Update Google Sync Feature Docs

**Files:**

- Modify: `docs/features/google-sync/spec.md`
- Modify: `docs/features/google-sync/data-model.md`
- Modify: `docs/features/google-sync/ui.md`
- Modify: `docs/features/google-sync/api.md`
- Reference: `src/server/schema.ts` (googleCalendars, googleCalendarChannels)
- Reference: `src/server/services/google-sync-service.ts`

**Step 1: Read actual implementation**

```bash
grep -A 40 "googleCalendars" src/server/schema.ts
grep -A 30 "googleCalendarChannels" src/server/schema.ts
cat src/server/services/google-sync-service.ts
```

**Step 2: Update data-model.md**

Add:

- googleCalendarChannels table (webhook subscriptions)
- Sync error tracking fields (syncError, syncErrorAt)
- Privacy settings per calendar

**Step 3: Update api.md**

Add webhook endpoints:

- POST `/api/webhooks/google-calendar`
- Cron endpoints for channel management

**Step 4: Verify documentation**

Compare with actual implementation.

---

## Task 7: Update Dashboard Feature Docs

**Files:**

- Modify: `docs/features/dashboard/spec.md`
- Modify: `docs/features/dashboard/data-model.md`
- Modify: `docs/features/dashboard/ui.md`
- Reference: `src/components/dashboard/`
- Reference: `src/app/[locale]/(app)/dashboard/page.tsx`

**Step 1: Read actual implementation**

```bash
ls -la src/components/dashboard/
cat src/app/[locale]/(app)/dashboard/page.tsx
```

**Step 2: Update ui.md**

Ensure components match:

- QuickActions
- ActiveTimersWidget
- TodaysChores
- WeeklyStars
- Greeting
- TodaysFlow

**Step 3: Verify data sources**

Update data-model.md with actual data sources and aggregations.

---

## Task 8: Update Reward Chart Feature Docs

**Files:**

- Modify: `docs/features/reward-chart/spec.md`
- Modify: `docs/features/reward-chart/data-model.md`
- Modify: `docs/features/reward-chart/ui.md`
- Reference: `src/server/schema.ts` (reward chart tables)
- Reference: `src/server/services/reward-chart-service.ts`
- Reference: `src/components/reward-chart/`

**Step 1: Read actual implementation**

```bash
grep -A 30 "rewardCharts" src/server/schema.ts
cat src/server/services/reward-chart-service.ts
ls -la src/components/reward-chart/
```

**Step 2: Update API endpoints**

Ensure all actual endpoints are documented:

- Task reorder endpoint
- Complete/undo endpoints
- Goals CRUD
- Messages CRUD
- Week data endpoint

**Step 3: Verify star integration**

Document actual star transaction flow.

---

## Task 9: Update Reward Store Feature Docs

**Files:**

- Modify: `docs/features/reward-store/spec.md`
- Modify: `docs/features/reward-store/data-model.md`
- Modify: `docs/features/reward-store/ui.md`
- Reference: `src/server/schema.ts` (rewards, redemptions, starTransactions)
- Reference: `src/server/services/reward-store-service.ts`

**Step 1: Read actual implementation**

```bash
grep -A 30 "export const rewards" src/server/schema.ts
grep -A 30 "redemptions" src/server/schema.ts
grep -A 40 "starTransactions" src/server/schema.ts
grep -A 20 "memberStarBalances" src/server/schema.ts
grep -A 20 "memberPrimaryGoals" src/server/schema.ts
```

**Step 2: Update data-model.md**

Add:

- memberStarBalances table (cached balances)
- memberPrimaryGoals table
- Redemption limits feature
- Star transaction types

**Step 3: Verify documentation**

Ensure all features documented.

---

## Task 10: Update UI Feature Docs

**Files:**

- Modify: `docs/features/ui/header.md`
- Modify: `docs/features/ui/menu.md`
- Reference: `src/components/header/`
- Reference: `src/components/menu/`
- Reference: `src/components/status/`

**Step 1: Read actual implementation**

```bash
ls -la src/components/header/
ls -la src/components/menu/
ls -la src/components/status/
```

**Step 2: Update header.md**

Add:

- Sync status indicator
- Account error badges
- Cache status component

**Step 3: Update menu.md**

Ensure all navigation items documented.

**Step 4: Consider adding status.md**

If cache/sync status is significant, create separate doc.

---

## Verification Checklist

After all tasks complete, verify:

- [ ] All features have spec.md, data-model.md, ui.md
- [ ] All Drizzle schemas match documentation
- [ ] All API endpoints match actual routes
- [ ] All TypeScript interfaces align with implementation
- [ ] Cross-references between features are accurate
- [ ] No outdated references (users vs familyMembers)
