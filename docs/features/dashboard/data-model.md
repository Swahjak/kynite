# Dashboard Data Model

## Dashboard Data

```typescript
interface DashboardData {
  family: {
    name: string
    photoUrl?: string
  }
  currentTime: Date
  weather: WeatherData
  todaysEvents: Event[]
  activeTimers: Timer[]
  familyMembers: FamilyMember[]
  quickActions: QuickAction[]
}

interface WeatherData {
  temperature: number
  unit: 'F' | 'C'
  condition: string
  icon: string
}

interface Event {
  id: string
  title: string
  startTime: Date
  endTime: Date
  location?: string
  category: EventCategory
  assignedTo?: string[]
}

interface Timer {
  id: string
  title: string
  subtitle: string
  remainingSeconds: number
  totalSeconds: number
  category: string
  iconName: string
}

interface FamilyMember {
  id: string
  name: string
  role: 'parent' | 'child'
  avatarColor: string
  avatarUrl?: string
  starCount: number
}

interface QuickAction {
  id: string
  label: string
  icon: string
  iconColor: string
  timerDuration?: number  // seconds
  isFeatured: boolean
}
```

## Data Sources

| Data | Source | Refresh Rate |
|------|--------|--------------|
| Current time | Client clock | Every second |
| Weather | External API | Every 30 min |
| Events | Google Calendar API | Every 5 min |
| Timers | Local state / DB | Real-time |
| Star counts | Database | On demand |

## Greeting Logic

```typescript
function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good Morning"
  if (hour >= 12 && hour < 17) return "Good Afternoon"
  if (hour >= 17 && hour < 21) return "Good Evening"
  return "Good Night"
}
```

## Level Calculation

```typescript
function getLevel(starCount: number): number {
  return Math.floor(starCount / 10)
}
// Title varies by level: Explorer, Artist, Champion, etc.
```
