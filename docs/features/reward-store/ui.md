# Reward Store UI Specification

## Interaction Modes

| Mode | Device | User | Purpose |
|------|--------|------|---------|
| **Wall Display** | Mounted tablet | Kids | View rewards, redeem with stars |
| **Management** | Mobile/Desktop | Parents | Create, edit, manage rewards |

### Wall Display Mode

**Allowed Actions:**
- View star balance
- Browse available rewards
- Redeem rewards (when affordable)
- View redemption history
- View weekly earnings chart
- View recent activity

**Hidden/Disabled:**
- Create reward
- Edit reward
- Delete reward
- Adjust star balances
- Configure limits

**Touch Targets:** 48px minimum

### Management Mode

**Full Access:**
- All viewing capabilities
- Create new rewards
- Edit existing rewards
- Delete rewards
- Set costs and limits
- Award bonus stars
- View all family members' balances

---

## Layout

### Desktop

```
+------------------------------------------------------------------+
| Header: Greeting + Star Balance Card                              |
+----------------------------------------------+-------------------+
| Rewards Marketplace (2/3)                    | Sidebar (1/3)     |
| - Filter tabs (Available | Redeemed)         | - Weekly Chart    |
| - Reward cards grid (2 columns)              | - Recent Activity |
+----------------------------------------------+-------------------+
```

### Mobile

Single column with sidebar sections stacked below marketplace.

---

## Components

### Star Balance Card

| Element | Specification |
|---------|---------------|
| Total | text-4xl font-black (Lexend) |
| Star icon | Filled, primary color |
| Weekly delta | text-xs, primary-dark |

### Reward Card

**Structure:**
```
+-----------------------------------+
| [Image]                   [Badge] |
+-----------------------------------+
| Title                             |
| Description (2 lines max)         |
|                                   |
| ★ 500            [Redeem Button]  |
+-----------------------------------+
```

**States:**

| State | Image | Button | Star Cost |
|-------|-------|--------|-----------|
| Affordable | Full color | Primary "Redeem" | Primary |
| Unaffordable | Grayscale + overlay | Disabled "Need X more" | Muted |
| Limit reached | Grayscale | Disabled "Available in X days" | Muted |

### Badges

| Type | Style | Use Case |
|------|-------|----------|
| Popular | White/90 bg | High redemption |
| New | Primary bg | Recently added |
| Limited | Orange bg | Limited quantity |
| Locked | Black/60 bg + lock icon | Unaffordable |

### Redemption Flow

1. User taps "Redeem" button
2. Confirmation dialog appears (optional, parent-configurable)
3. Stars deducted immediately
4. Success toast shown
5. Activity logged

### Confirmation Dialog

Use shadcn/ui `AlertDialog`:
- Shows reward title
- Shows cost and balance before/after
- "Cancel" (secondary) and "Redeem Now" (primary) buttons

---

## Accessibility

- Star balance: "1,250 stars, 120 earned this week"
- Reward cards: "Movie Night Choice, 500 stars, Redeem button"
- Locked rewards: "Locked, need 250 more stars"
- Focus visible: 2px primary outline
