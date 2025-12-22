# Family Planner Brand Guidelines

This document defines the visual identity, design language, and user experience principles for Family Planner.

---

## Brand Identity

### Brand Name

**Family Planner** — A family organizational hub designed for wall-mounted displays and mobile devices.

### Tagline

_Family OS_ — Positioning the app as the operating system for family life.

### Brand Personality

- **Warm & Welcoming**: Friendly greetings, personal touches
- **Organized & Reliable**: Clear structure, intuitive navigation
- **Playful yet Functional**: Engaging for kids, practical for parents
- **Modern & Clean**: Contemporary design with purposeful whitespace

---

## Logo & Icon

### Primary Icon

The brand uses an icon-based identity featuring a **house/home symbol** rendered in the primary brand color. The icon represents:

- Family and home life
- A central hub for organization
- Warmth and togetherness

### Icon Specifications

```
Shape: Rounded house silhouette
Color: Primary (#13ec92)
Background: Primary with 20% opacity for containers
Style: Material Symbols "family_home" or custom house icon
```

### Icon Usage

- Header: Icon with text "Family Planner" and "Family OS" tagline
- Favicon: Simplified house icon
- App icon: House icon on primary color background

---

## Color System

### Core Colors

| Name              | Hex       | CSS Variable            | Usage                                          |
| ----------------- | --------- | ----------------------- | ---------------------------------------------- |
| **Primary**       | `#13ec92` | `--color-primary`       | CTAs, active states, highlights, brand accents |
| **Primary Hover** | `#0fd683` | `--color-primary-hover` | Button hover states                            |
| **Primary Dark**  | `#0d9e61` | `--color-primary-dark`  | Icons on light primary backgrounds             |

### Background Colors

| Name                 | Light Mode | Dark Mode | Usage                     |
| -------------------- | ---------- | --------- | ------------------------- |
| **Background**       | `#f6f8f7`  | `#10221a` | Page background           |
| **Surface**          | `#ffffff`  | `#1c2e26` | Cards, panels, modals     |
| **Surface Elevated** | `#ffffff`  | `#253830` | Elevated cards, dropdowns |
| **Surface Hover**    | `#f0f4f3`  | `#2f453b` | Interactive surface hover |

### Text Colors

| Name               | Light Mode | Dark Mode | Usage                          |
| ------------------ | ---------- | --------- | ------------------------------ |
| **Text Primary**   | `#111815`  | `#ffffff` | Headings, important content    |
| **Text Secondary** | `#618979`  | `#8baea0` | Labels, descriptions, metadata |
| **Text Muted**     | `#9ca3af`  | `#6b7280` | Disabled, placeholder text     |

### Border Colors

| Name               | Light Mode | Dark Mode | Usage                       |
| ------------------ | ---------- | --------- | --------------------------- |
| **Border Default** | `#dbe6e1`  | `#2a3831` | Card borders, dividers      |
| **Border Light**   | `#e6e8e7`  | `#374740` | Subtle separators           |
| **Border Focus**   | `#13ec92`  | `#13ec92` | Focus rings, active borders |

---

## Event & Category Color Palette

A vibrant palette for distinguishing events, family members, and categories. Each color includes background, border, and text variants.

### Event Colors

| Category   | Background                    | Border       | Text                        | Use Cases                          |
| ---------- | ----------------------------- | ------------ | --------------------------- | ---------------------------------- |
| **Blue**   | `blue-50` / `blue-900/20`     | `blue-400`   | `blue-600` / `blue-400`     | Sports, activities, outdoor events |
| **Purple** | `purple-50` / `purple-900/20` | `purple-400` | `purple-600` / `purple-400` | Personal, gym, self-care           |
| **Orange** | `orange-50` / `orange-900/20` | `orange-400` | `orange-600` / `orange-400` | Lessons, learning, education       |
| **Green**  | `green-50` / `green-900/20`   | `green-500`  | `green-700` / `green-400`   | Family events, meals, gatherings   |
| **Red**    | `red-50` / `red-900/20`       | `red-400`    | `red-600` / `red-400`       | Date nights, special occasions     |
| **Yellow** | `yellow-50` / `yellow-900/20` | `yellow-400` | `yellow-700` / `yellow-400` | Celebrations, birthdays, parties   |
| **Pink**   | `pink-50` / `pink-900/20`     | `pink-400`   | `pink-600` / `pink-400`     | Creative, arts, hobbies            |
| **Teal**   | `teal-50` / `teal-900/20`     | `teal-400`   | `teal-600` / `teal-400`     | Health, wellness, appointments     |

### Family Member Colors

Assign distinct colors to family members for quick visual identification:

| Role         | Avatar Background | Avatar Text  | Ring Color      |
| ------------ | ----------------- | ------------ | --------------- |
| **Parent 1** | `blue-100`        | `blue-600`   | `blue-400/50`   |
| **Parent 2** | `green-100`       | `green-700`  | `green-400/50`  |
| **Child 1**  | `purple-100`      | `purple-600` | `purple-400/50` |
| **Child 2**  | `orange-100`      | `orange-600` | `orange-400/50` |
| **Child 3**  | `pink-100`        | `pink-600`   | `pink-400/50`   |
| **Extended** | `gray-100`        | `gray-600`   | `gray-400/50`   |

### Status Colors

| Status          | Color        | Usage                            |
| --------------- | ------------ | -------------------------------- |
| **Success**     | `green-500`  | Completed tasks, confirmations   |
| **Warning**     | `orange-500` | Reminders, approaching deadlines |
| **Error**       | `red-500`    | Errors, missed events, alerts    |
| **Info**        | `blue-500`   | Information, tips                |
| **Streak/Fire** | `orange-500` | Gamification, achievements       |

---

## Typography

### Font Families

| Type        | Font      | Fallback   | Usage                                      |
| ----------- | --------- | ---------- | ------------------------------------------ |
| **Display** | Lexend    | sans-serif | Headings, UI elements, buttons, navigation |
| **Body**    | Noto Sans | sans-serif | Body text, descriptions, long-form content |

### Font Loading

```html
<link
  href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700;800&family=Noto+Sans:wght@400;500;700&display=swap"
  rel="stylesheet"
/>
```

### Type Scale

| Element        | Size            | Weight          | Line Height | Font      |
| -------------- | --------------- | --------------- | ----------- | --------- |
| **Display XL** | 5rem (80px)     | 900 (Black)     | 1.0         | Lexend    |
| **Display LG** | 4rem (64px)     | 800 (ExtraBold) | 1.1         | Lexend    |
| **H1**         | 2rem (32px)     | 700 (Bold)      | 1.2         | Lexend    |
| **H2**         | 1.5rem (24px)   | 700 (Bold)      | 1.3         | Lexend    |
| **H3**         | 1.25rem (20px)  | 600 (SemiBold)  | 1.4         | Lexend    |
| **Body Large** | 1.125rem (18px) | 400             | 1.5         | Noto Sans |
| **Body**       | 1rem (16px)     | 400             | 1.5         | Noto Sans |
| **Body Small** | 0.875rem (14px) | 400             | 1.5         | Noto Sans |
| **Caption**    | 0.75rem (12px)  | 500 (Medium)    | 1.4         | Lexend    |
| **Overline**   | 0.625rem (10px) | 700 (Bold)      | 1.2         | Lexend    |

### Typography Guidelines

- **Time displays**: Use tabular numbers (`tabular-nums`) for consistent width
- **Labels**: Uppercase with wider letter-spacing (`tracking-wider`)
- **Headings**: Tight letter-spacing (`tracking-tight`) for large display text
- **Numbers**: Bold weight for emphasis (star counts, dates, timers)

---

## Iconography

### Icon Library

**Material Symbols Outlined** — Google's variable icon font

### Icon Loading

```html
<link
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
  rel="stylesheet"
/>
```

### Icon Styles

| Style        | Settings             | Usage                   |
| ------------ | -------------------- | ----------------------- |
| **Outlined** | `FILL: 0, wght: 400` | Default UI icons        |
| **Filled**   | `FILL: 1, wght: 400` | Active states, emphasis |

```css
.material-symbols-outlined {
  font-variation-settings:
    "FILL" 0,
    "wght" 400,
    "GRAD" 0,
    "opsz" 24;
}

.icon-filled {
  font-variation-settings:
    "FILL" 1,
    "wght" 400,
    "GRAD" 0,
    "opsz" 24;
}
```

### Icon Sizes

| Size    | Pixels | Usage                       |
| ------- | ------ | --------------------------- |
| **XS**  | 14px   | Inline with small text      |
| **SM**  | 18px   | Buttons, list items         |
| **MD**  | 24px   | Default, navigation         |
| **LG**  | 28px   | Headers, emphasis           |
| **XL**  | 32px   | Feature highlights          |
| **2XL** | 40px   | Empty states, illustrations |

### Common Icons

| Action        | Icon Name        | Filled |
| ------------- | ---------------- | ------ |
| Dashboard     | `dashboard`      | Yes    |
| Calendar      | `calendar_month` | No     |
| Schedule      | `schedule`       | No     |
| Add           | `add`            | No     |
| Settings      | `settings`       | No     |
| Notifications | `notifications`  | No     |
| Family        | `family_home`    | Yes    |
| Check         | `check`          | No     |
| Location      | `location_on`    | No     |
| Timer         | `timer`          | No     |

---

## Spacing & Layout

### Spacing Scale

Based on a 4px base unit:

| Token | Value | Usage                      |
| ----- | ----- | -------------------------- |
| `1`   | 4px   | Tight spacing, icon gaps   |
| `2`   | 8px   | Compact elements           |
| `3`   | 12px  | Default element gaps       |
| `4`   | 16px  | Card padding, section gaps |
| `5`   | 20px  | Comfortable spacing        |
| `6`   | 24px  | Section padding            |
| `8`   | 32px  | Large section gaps         |
| `10`  | 40px  | Page sections              |

### Border Radius

| Token     | Value  | Usage                            |
| --------- | ------ | -------------------------------- |
| `default` | 4px    | Subtle rounding                  |
| `lg`      | 8px    | Buttons, inputs                  |
| `xl`      | 12px   | Cards, panels                    |
| `2xl`     | 16px   | Large cards, modals              |
| `full`    | 9999px | Pills, avatars, circular buttons |

### Shadows

| Level   | Value                          | Usage                    |
| ------- | ------------------------------ | ------------------------ |
| **SM**  | `0 1px 2px rgba(0,0,0,0.05)`   | Subtle elevation (cards) |
| **MD**  | `0 4px 6px rgba(0,0,0,0.1)`    | Dropdowns, popovers      |
| **LG**  | `0 10px 15px rgba(0,0,0,0.1)`  | Modals, dialogs          |
| **2XL** | `0 25px 50px rgba(0,0,0,0.25)` | Floating menus           |

---

## Components

### Buttons

#### Primary Button

```
Background: Primary (#13ec92)
Text: Dark (#10221a)
Font: Lexend, Bold
Padding: 12px 24px
Border Radius: lg (8px)
Shadow: sm
Hover: Primary hover (#0fd683)
Active: scale(0.95)
```

#### Secondary Button

```
Background: White / Surface
Border: 1px solid Border Default
Text: Text Primary
Hover: Surface Hover
```

#### Icon Button

```
Size: 40px / 48px
Border Radius: lg (8px) or full
Background: Surface or transparent
Hover: Surface Hover
```

### Cards

#### Default Card

```
Background: Surface (white / #1c2e26)
Border: 1px solid Border Default
Border Radius: xl (12px) or 2xl (16px)
Shadow: sm
Padding: 20px
```

#### Event Card

```
Background: Category color (50 opacity)
Border-Left: 4px solid Category color
Border Radius: lg (8px)
Padding: 12px
```

#### Active/Current Card

```
Background: Primary (10% opacity)
Border: 2px solid Primary
Shadow: md
```

### Avatars

```
Sizes: 24px, 32px, 40px, 48px
Shape: Circle (rounded-full)
Border: 2px ring with offset
Ring Color: Primary or category color
```

### Pills & Chips

#### Filter Chip

```
Height: 40px
Padding: 8px 16px
Border Radius: full
Background: Surface (inactive) / Dark (active)
Border: 1px solid Border Default (inactive)
```

#### Tag/Badge

```
Height: 24px
Padding: 4px 12px
Border Radius: full
Font: Caption, Bold
Background: Category color with opacity
```

### Progress Indicators

#### Progress Bar

```
Track: Border Default color
Fill: Primary
Height: 8px
Border Radius: full
```

#### Streak Indicator

```
Icon: local_fire_department (orange-500)
Progress: Percentage with progress bar
Badge: Rounded container with stats
```

---

## Motion & Animation

### Timing Functions

| Name        | Value                                    | Usage                |
| ----------- | ---------------------------------------- | -------------------- |
| **Default** | `ease`                                   | General transitions  |
| **Smooth**  | `ease-in-out`                            | Page transitions     |
| **Bounce**  | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Playful interactions |

### Duration Scale

| Token      | Value | Usage                      |
| ---------- | ----- | -------------------------- |
| **Fast**   | 150ms | Micro-interactions, hovers |
| **Normal** | 200ms | Default transitions        |
| **Slow**   | 300ms | Page transitions, modals   |
| **Slower** | 500ms | Complex animations         |

### Common Transitions

#### Hover State

```css
transition: all 200ms ease;
/* or specific properties */
transition:
  background-color 150ms ease,
  transform 150ms ease;
```

#### Button Press

```css
.button:active {
  transform: scale(0.95);
}
```

#### Dropdown/Menu Appear

```css
.menu {
  animation: fadeInZoom 200ms ease-out;
  transform-origin: top-left;
}

@keyframes fadeInZoom {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

#### Card Hover

```css
.card {
  transition:
    box-shadow 200ms ease,
    transform 200ms ease;
}
.card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

#### Icon Hover

```css
.icon {
  transition: transform 200ms ease;
}
.group:hover .icon {
  transform: scale(1.1);
}
```

#### Color Mode Transition

```css
body {
  transition:
    background-color 200ms ease,
    color 200ms ease;
}
```

### Animation Guidelines

1. **Purpose**: Every animation should serve a purpose (feedback, guidance, delight)
2. **Subtlety**: Prefer subtle animations; avoid distracting motion
3. **Performance**: Use `transform` and `opacity` for smooth 60fps animations
4. **Accessibility**: Respect `prefers-reduced-motion` preference
5. **Consistency**: Use the defined timing and duration tokens

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Voice & Tone

### Greeting Patterns

Use time-based, personalized greetings:

| Time       | Greeting                        |
| ---------- | ------------------------------- |
| 5am - 12pm | "Good Morning, [Family Name]"   |
| 12pm - 5pm | "Good Afternoon, [Family Name]" |
| 5pm - 9pm  | "Good Evening, [Family Name]"   |
| 9pm - 5am  | "Good Night, [Family Name]"     |

### Copy Guidelines

#### Headlines

- **Clear and direct**: "Today's Flow", "Weekly Stars", "Active Timers"
- **Action-oriented**: "Add Event", "Log Chore"
- **Friendly but functional**: Balance warmth with clarity

#### Labels

- **Concise**: "Now", "Next", "Later"
- **Uppercase for categories**: "STREAK", "TODAY", "WEEKLY STARS"
- **Contextual**: "Kitchen Duty: Leo", "City Park Field 4"

#### Empty States

- **Encouraging**: Use gentle icons (weekend, bedtime)
- **Suggestive**: "Free Time", "Nap Time"
- **Non-judgmental**: Avoid negative language

#### Notifications

- **Timely**: "3 Events Remaining"
- **Celebratory**: Star counts, streak progress
- **Actionable**: Clear next steps

### Tone Attributes

| Attribute       | Description                            |
| --------------- | -------------------------------------- |
| **Warm**        | Like talking to a family member        |
| **Helpful**     | Guides without overwhelming            |
| **Encouraging** | Celebrates achievements, big and small |
| **Clear**       | No jargon, simple language             |
| **Inclusive**   | Works for all family structures        |

---

## Dark Mode

### Implementation

Dark mode is implemented using the `dark` class on the `<html>` element:

```html
<html class="dark"></html>
```

### Color Mapping

All colors have light/dark variants. Dark mode uses:

- Deeper, muted backgrounds
- Slightly desaturated accent colors
- Maintained contrast ratios for accessibility

### Dark Mode Transitions

Smooth transition between modes:

```css
body {
  transition:
    background-color 200ms ease,
    color 200ms ease;
}
```

---

## Accessibility

### Color Contrast

- All text meets WCAG 2.1 AA standards (4.5:1 for normal text, 3:1 for large text)
- Interactive elements have visible focus states
- Don't rely solely on color to convey information

### Focus States

```css
:focus-visible {
  outline: 2px solid #13ec92;
  outline-offset: 2px;
}
```

### Touch Targets

- Minimum touch target: 44x44px
- Adequate spacing between interactive elements

### Motion

- Respect `prefers-reduced-motion`
- Provide pause controls for auto-playing content

---

## Responsive Design

### Breakpoints

| Name    | Min Width | Usage         |
| ------- | --------- | ------------- |
| **sm**  | 640px     | Large phones  |
| **md**  | 768px     | Tablets       |
| **lg**  | 1024px    | Small laptops |
| **xl**  | 1280px    | Desktops      |
| **2xl** | 1536px    | Large screens |

### Mobile Considerations

- Collapsible navigation via hamburger menu
- Touch-optimized interactions
- Simplified layouts for small screens
- Bottom-sheet patterns for mobile actions

### Wall Display Mode

Optimized for large, wall-mounted displays:

- Large typography for distance reading
- High contrast for various lighting
- Simplified, glanceable information
- Auto-refresh for real-time updates

---

## File Naming & Organization

### Design Files

```
docs/design/
├── dashboard/
│   ├── dashboard-design1.html
│   └── dashboard-design1.png
├── calendar/
│   ├── day/
│   ├── week/
│   │   ├── calendar-week-design1.html
│   │   └── calendar-week-design1.png
│   └── month/
└── components/
```

### Asset Naming

- Use kebab-case: `calendar-week-design1.png`
- Include version numbers: `design1`, `design2`
- Be descriptive: `user-avatar-mom.png`

---

## Tailwind Configuration

Reference configuration for implementing the brand:

```javascript
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#13ec92",
        "primary-hover": "#0fd683",
        "primary-dark": "#0d9e61",
        "background-light": "#f6f8f7",
        "background-dark": "#10221a",
        "surface-light": "#ffffff",
        "surface-dark": "#1c2e26",
      },
      fontFamily: {
        display: ["Lexend", "sans-serif"],
        body: ["Noto Sans", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
    },
  },
};
```

---

_Last updated: December 2024_
