# Navigation

Source: `design-system.html`, section `<!-- NAVIGATION -->`.

Only one nav pattern is documented here: a bottom tab bar (mobile/hub-touch context). The sidebar nav pattern (tablet/desktop) is documented in `layout.md` § Sidebar.

## Bottom tab bar

Container:
```css
background: rgba(251,249,244,0.9); /* translucent cream, i.e. surface color at 90% alpha */
border-radius: 24px;
box-shadow: 0 1px 2px rgba(0,0,0,0.04);
border: 1px solid #e1e3e4;
max-width: 520px;
```

Tab row:
```css
display:flex;justify-content:space-around;align-items:center;height:80px;padding:0 8px;
```

Each tab:
```css
display:flex;flex-direction:column;align-items:center;gap:4px;
/* icon: default Material Symbols Outlined size (24px, no override) */
/* label */ font-family:'Baloo 2',sans-serif;font-weight:700;font-size:10px;
```

**Active tab**: `color:#5d5fef;` (applied to the whole tab wrapper, cascading to both icon and label — no separate background/pill treatment, just the color change).

**Inactive tab**: `color:#434656;`.

Tabs shown, in order, with icon + uppercase label:

| Icon | Label |
| --- | --- |
| `home` | HOME |
| `calendar_today` | CALENDAR |
| `checklist` | ROUTINES |
| `workspace_premium` | REWARDS |
| `settings` | SETTINGS |

Same 5 destinations and icon set as the sidebar nav in `layout.md`, confirming these are the app's fixed top-level sections regardless of nav pattern/breakpoint.
