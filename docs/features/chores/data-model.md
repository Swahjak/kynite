# Chores Data Model

## Chore Entity

```typescript
interface IChore {
  id: string
  title: string
  description?: string
  assignedTo: IUser
  dueDate?: Date
  dueTime?: string        // HH:mm format
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

## Computed Properties

```typescript
type UrgencyStatus = 'none' | 'due-soon' | 'urgent' | 'overdue'

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
```

## Database Schema

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

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chores` | GET | Fetch all pending chores |
| `/api/chores/:id/complete` | POST | Mark chore as complete |
| `/api/chores/streak` | GET | Get current streak data |
| `/api/chores/progress` | GET | Get today's progress |

## Data Sources

| Data | Source | Refresh Rate |
|------|--------|--------------|
| Chores | PostgreSQL | On mount, after completion |
| Users | PostgreSQL | On mount |
| Streak | PostgreSQL | After completion |
| Progress | Computed | Real-time |

## XP Rewards

| Chore Type | XP Reward |
|------------|-----------|
| Daily routine | 10 XP |
| Weekly task | 25 XP |
| Urgent/time-sensitive | 15 XP |
| Special/bonus | 50 XP |

*Note: XP values are configured in the administration interface.*
