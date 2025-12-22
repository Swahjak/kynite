# Calendar Data Model

## Event Entity

```typescript
interface IEvent {
  id: number
  title: string
  description: string
  startDate: string      // ISO 8601 format
  endDate: string        // ISO 8601 format
  color: TEventColor
  user: IUser
}

type TEventColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange'

interface IUser {
  id: string
  name: string
  picturePath: string | null
}
```

## Event Colors

Events are color-coded by category:

| Color | Use Cases |
|-------|-----------|
| Blue | Sports, activities, outdoor events |
| Purple | Personal, gym, self-care |
| Orange | Lessons, learning, education |
| Green | Family events, meals, gatherings |
| Red | Date nights, special occasions |
| Yellow | Celebrations, birthdays, parties |

## Data Sources

| Data | Source | Refresh Rate |
|------|--------|--------------|
| Events | Google Calendar API | Every 5 min |
| Tasks | Chores Module | Real-time |
| Users | Auth/Family Module | On mount |
| Settings | localStorage | Immediate |
| Weather | Weather API (TBD) | Every 30 min |

## State Management

The `CalendarProvider` context manages:
- Current view (today/day/week/month)
- Selected date
- Filtered events
- User filter selection
- Color filter selection
- Settings (persisted to localStorage)

The `DndProvider` context manages:
- Drag state
- Drop target
- Pending confirmation
