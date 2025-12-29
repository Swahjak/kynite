# Recurring Events Design

## Overview

Add recurring event support to the calendar's "add event" action, allowing users to create events that repeat on a schedule.

## Design Decisions

| Decision             | Choice                                          | Rationale                                                               |
| -------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| Pattern complexity   | Simple (daily/weekly/monthly/yearly + interval) | Covers 95% of family use cases                                          |
| Storage approach     | Persist occurrences at creation                 | Enables per-occurrence state, simpler queries, works with existing code |
| End conditions       | Never / After X / Until date                    | Standard UX, minimal implementation difference                          |
| Google Calendar sync | Local-only for now                              | Avoids RRULE complexity, can add later                                  |

## Data Model

### New Table: `recurring_event_patterns`

```typescript
export const recurringEventPatterns = pgTable("recurring_event_patterns", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id),
  frequency: text("frequency").notNull(), // 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: integer("interval").notNull().default(1),
  endType: text("end_type").notNull(), // 'never' | 'count' | 'date'
  endCount: integer("end_count"), // if endType='count'
  endDate: timestamp("end_date", { mode: "date" }), // if endType='date'
  generatedUntil: timestamp("generated_until", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

### Events Table Additions

```typescript
// New columns in events table
recurringPatternId: text("recurring_pattern_id").references(() => recurringEventPatterns.id, { onDelete: "cascade" }),
occurrenceDate: timestamp("occurrence_date", { mode: "date" }),
```

### Frontend IEvent Interface Additions

```typescript
// Add to IEvent
recurringPatternId?: string;  // null = single event
occurrenceDate?: string;      // identifies which instance
```

## Occurrence Generation

### When Generation Happens

1. **On creation** - Generate 1 year of occurrences immediately
2. **Via cron job** - Weekly task extends patterns approaching their horizon

### Generation Logic

```typescript
// generateOccurrences(pattern, templateEvent, fromDate, toDate)
// 1. Calculate all occurrence dates between fromDate and toDate
// 2. For each date:
//    - Clone templateEvent (title, description, category, participants, etc.)
//    - Adjust startTime/endTime to the new occurrence date
//    - Set recurringPatternId and occurrenceDate
//    - Insert event + participants
// 3. Update pattern.generatedUntil = toDate
```

### Date Calculation by Frequency

- **Daily**: Add `interval` days to startDate
- **Weekly**: Add `interval * 7` days
- **Monthly**: Add `interval` months (handle month-end edge cases)
- **Yearly**: Add `interval` years

### Stop Conditions

- `endType='count'`: Stop after `endCount` total occurrences
- `endType='date'`: Stop if occurrence date > `endDate`
- `endType='never'`: Generate up to `toDate` (the horizon)

## Edit & Delete Operations

### Edit Dialog

When editing a recurring event occurrence, show options:

- **This event only** - Updates just this occurrence
- **All events** - Updates the pattern + all occurrences

### Edit "This Event Only"

```typescript
// Update single event row
// No pattern changes, no regeneration
```

### Edit "All Events"

```typescript
// 1. Update the pattern record (if frequency/interval/end changed)
// 2. Update ALL existing occurrences with new properties
// 3. If pattern changed: delete future occurrences, regenerate from today
```

### Delete Dialog

Same options:

- **This event only** - Deletes single occurrence row
- **All events** - Deletes pattern (cascade deletes all occurrences)

## Form UI

### AddEditEventDialog Changes

Add collapsible "Repeat" section after date fields:

```
▼ Repeat
┌─────────────────────────────────────┐
│ Frequency: [Does not repeat ▼]      │
│                                     │
│ (when frequency selected:)          │
│ Every: [1] [weeks ▼]                │
│ Ends:  ○ Never                      │
│        ○ After [10] occurrences     │
│        ○ On [date picker]           │
└─────────────────────────────────────┘
```

### Form Schema Additions

```typescript
recurrence: z.object({
  frequency: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().min(1).max(99).default(1),
  endType: z.enum(['never', 'count', 'date']),
  endCount: z.number().min(1).max(365).optional(),
  endDate: z.date().optional(),
}).optional(),
```

### New Component

`RecurrenceFields` - Handles the repeat section, conditionally shows interval/end options.

## API Layer

### Modified Routes

```
POST   /api/events              - Accepts recurrence data, creates pattern + occurrences
PUT    /api/events/[id]?scope=  - Accepts 'this' | 'all'
DELETE /api/events/[id]?scope=  - Accepts 'this' | 'all'
```

### Create Flow

```typescript
// POST /api/events with recurrence:
// 1. If recurrence.frequency !== 'none':
//    a. Create recurring_event_patterns row
//    b. Generate 1 year of event occurrences
//    c. Create event_participants for each occurrence
// 2. Else: create single event (existing logic)
```

### Update Flow

```typescript
// PUT /api/events/[id]?scope=this - Update single event row only
// PUT /api/events/[id]?scope=all  - Update pattern + all occurrences
```

### Delete Flow

```typescript
// DELETE /api/events/[id]?scope=this - Delete single event row
// DELETE /api/events/[id]?scope=all  - Delete pattern (cascades)
```

## Cron Job

### Horizon Extension

```typescript
// Schedule: Weekly (Sundays at 2am)
// 1. Query patterns where generatedUntil < (now + 30 days)
// 2. For each pattern:
//    a. Get most recent occurrence as template
//    b. Generate from generatedUntil to (now + 1 year)
//    c. Respect endType/endCount/endDate limits
// 3. Log summary
```

## Testing Strategy

| Area                        | Test Type         |
| --------------------------- | ----------------- |
| Occurrence date calculation | Unit tests        |
| End conditions              | Unit tests        |
| API create/update/delete    | Integration tests |
| Form validation             | Unit tests        |
| Edit this/all behavior      | E2E tests         |

### Edge Cases

- Month-end dates (Jan 31 → Feb 28)
- Leap years (Feb 29)
- DST transitions
- Pattern with endCount already reached

## Out of Scope (Future)

- "This and future events" edit option
- Google Calendar sync for recurring events
- Day-of-week selection (e.g., "every Mon/Wed/Fri")
- Complex patterns (e.g., "2nd Tuesday of month")
