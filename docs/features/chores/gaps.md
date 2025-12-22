# Chores Data Model - Deferred Gaps

Gap analysis performed 2024-12-22. Critical gaps (#1-3) have been resolved. Below are deferred items for future work.

---

## Missing Relationships

### 1. No Routine/Task Relationship (PRD FR5)

**PRD FR5:** "Parents can define 'Routines' composed of multiple sequential tasks."

**Missing from chores model:**
- `routine_id` foreign key
- `Routine` entity definition
- `sort_order` for task sequencing within routine

---

### 2. No Timer Prescription Fields (PRD FR6)

**PRD FR6:** "Timer Prescriptions (proactive countdowns)"

The dashboard model shows `Timer` interface with `remainingSeconds`, `totalSeconds`, etc.

**Missing from chores:**
- `timer_duration` (seconds)
- Link to timer/prescription system
- How timers relate to chores

---

### 3. Permission Model Not Referenced

**families/data-model.md defines:**
| Role | Events |
|------|--------|
| manager | Full CRUD |
| participant | Mark complete |
| caregiver | View only |

**Chores model should document:**
- Who can create/edit chores
- Who can mark complete
- Who can view

---

## Underspecified Areas

### 4. Recurrence Handling

The model defines recurrence types but doesn't explain:
- Are recurring chores templates or instances?
- What happens when completed? (New instance created?)
- Is there a `chore_instances` table?
- How do streaks work with recurrence?

---

### 5. Streak Entity Missing

API lists `/api/chores/streak` but no schema:
```typescript
// Missing definition
interface Streak {
  userId: string
  currentStreak: number
  longestStreak: number
  lastCompletedAt: Date
}
```

---

### 6. Progress Endpoint Underspecified

API lists `/api/chores/progress` with no response schema.

---

## Inconsistencies

### 7. IUser Interface Mismatches

**Chores model:**
```typescript
interface IUser {
  id: string
  name: string
  picturePath: string | null  // Different name
  color: string               // Different name
}
```

**Families model uses:**
- `avatar_color` (snake_case in DB)
- `image` (from users table in JOIN)

**Dashboard model uses:**
- `avatarColor` (camelCase)
- `avatarUrl`

**Fix:** Use consistent naming and reference the shared `FamilyMember` type.

---

### 8. TypeScript/SQL Type Mismatches

| Field | TypeScript | SQL | Issue |
|-------|------------|-----|-------|
| id | `string` | `UUID` | Clarify string format |
| assignedTo | `IUser` (object) | `assigned_to_id` (FK) | Explain hydration |
| dueDate | `Date?` | `DATE` | Nullability semantics |

---

### 9. Missing `created_by` Field

Table has `assigned_to_id` but no `created_by_id` to track chore creator.
