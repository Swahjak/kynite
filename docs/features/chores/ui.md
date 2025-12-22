# Chores UI Specification

## Interaction Modes

| Mode | Device | User | Purpose |
|------|--------|------|---------|
| **Wall Display** | Mounted tablet | Kids/Family | View tasks, mark complete |
| **Management** | Mobile/Desktop | Parents/Admins | Create, edit, assign chores |

### Wall Display Mode

**Allowed Actions:**
- View all chores (All, By Person, Urgent filters)
- Mark chores as complete (single tap)
- View progress and streak
- Pull to refresh

**Hidden/Disabled:**
- FAB (Add Chore button)
- Edit/delete chore actions
- Chore creation forms
- Assignment changes

**Touch Targets:** 48px minimum (check button is 48px)

### Management Mode

**Full Access:**
- All viewing capabilities
- Create new chores
- Edit existing chores
- Delete chores
- Assign to family members
- Set recurrence patterns
- Configure XP rewards

---

## Layout

### Desktop/Tablet (md+)

```
+-------------------------------------------------------------------+
| Header                                                             |
+-------------------------------------------------------------------+
| Greeting Section                                                   |
+-------------------------------------------------------------------+
| Progress Card (streak + completion bar)                            |
+-------------------------------------------------------------------+
| Filter Tabs: [All Chores] [By Person] [Urgent]                    |
+-------------------------------------------------------------------+
| Chore List / Columns                                               |
+-------------------------------------------------------------------+
| FAB [+] (Management mode only)                                     |
+-------------------------------------------------------------------+
```

### Mobile (< md)

Single column layout with vertically stacked sections.

---

## Components

### Chore Card

| Element | Specification |
|---------|---------------|
| Avatar | 56px circular with ring |
| Title | lg Bold, truncate single line |
| Status badge | xs Bold uppercase, colored background |
| Assignee | sm, secondary color |
| Check button | 48px circular, primary on hover |

### Card States

| State | Visual |
|-------|--------|
| Default | Full opacity, check hidden |
| Hover | Primary border, check visible |
| Completed | Slide out animation, fade |
| Low priority | 80% opacity |

### Progress Card

| Element | Specification |
|---------|---------------|
| Trophy icon | Primary color, 24px |
| Streak label | "Daily Streak: N Days", Bold |
| Progress | "X/Y Done", secondary color |
| Progress bar | 12px height, primary fill |

### Filter Tabs

| State | Background | Text |
|-------|------------|------|
| Active | Primary (#13ec92) | Dark |
| Inactive | Transparent | Secondary |

---

## Filter Views

### All Chores

Single column list sorted by:
1. Overdue (oldest first)
2. Urgent (soonest first)
3. Today (by time)
4. Future (by date)
5. Flexible (alphabetically)

### By Person

Side-by-side columns per family member.
- Column width: 280-320px
- Horizontal scroll on overflow

### Urgent

Filtered view showing only urgent/overdue chores.

---

## Animations

| Action | Animation |
|--------|-----------|
| Complete chore | Button scale(1.1), card slideX + fade |
| Progress update | Width transition 300ms |
| Card hover | Border color transition 200ms |

---

## Accessibility

- Tab navigation between cards and check buttons
- Enter/Space to complete chore
- Screen reader: "Mark {title} as complete"
- Focus visible: 2px primary outline
- Respect `prefers-reduced-motion`
