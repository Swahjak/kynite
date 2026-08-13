# Page layout

Source: `design-system.html`, section `<!-- PAGE LAYOUT -->`.

> "Sidebar + header + footer shell for the tablet/desktop 'Hub' context."

## Shell frame

```css
display:flex;border-radius:24px;overflow:hidden;
box-shadow:0 4px 24px rgba(0,0,0,0.08);
border:1px solid #e1e3e4;
height:560px; /* demo height in the spec; real usage is viewport-driven */
```

## Sidebar

```css
width:200px;flex-shrink:0;
background:#ffffff;
border-right:1px solid #e1e3e4;
display:flex;flex-direction:column;
padding:24px 16px;gap:4px;
```

**Brand mark row** (top): `display:flex;align-items:center;gap:10px;margin-bottom:24px;` — mini "K" badge (see `brand.md` § Sidebar/nav mini mark) + wordmark `font-family:'Baloo 2',sans-serif;font-weight:800;font-size:16px;letter-spacing:-0.02em;`.

**Nav item, active**:
```css
display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;
background:rgba(93,95,239,0.08);color:#5d5fef;
font-family:'Baloo 2',sans-serif;font-weight:700;font-size:13px;
```
Icon at `font-size:18px;`.

**Nav item, inactive**:
```css
display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;
color:#434656;
font-family:'Poppins',sans-serif;font-size:13px; /* not bold, not Baloo 2 */
```

**Bottom-pinned item** (e.g. Settings): same inactive style, with `margin-top:auto;` on the wrapping element to push it to the sidebar's bottom edge.

Nav items shown, in order: Home (active), Calendar, Routines, Rewards, then Settings pinned to bottom. Icons: `home`, `calendar_today`, `checklist`, `workspace_premium`, `settings`.

## Header

```css
height:64px;flex-shrink:0;
display:flex;align-items:center;justify-content:space-between;
padding:0 24px;
border-bottom:1px solid #e1e3e4;
```

Title: `font-family:'Baloo 2',sans-serif;font-weight:700;font-size:17px;`. Right side: `display:flex;align-items:center;gap:14px;` containing a `notifications` icon (`font-size:20px;color:#434656;`) and a `32px` circular avatar.

## Content area

```css
flex:1;padding:20px 24px;
display:grid;grid-template-columns:1.3fr 1fr;gap:16px;
background: /* inherits shell's #fbf9f4 wrapper */
```

Two example content cards inside: a "Today at home" summary card (`background:#ffffff;border-radius:18px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,0.04);` — note: **18px** radius here, smaller than the 24px card standard, since it's nested inside the shell) and an approval-request card (`background:#f5f3ee;` same radius/padding/shadow pattern).

Content-card event row pattern: `display:flex;gap:8px;` with a leading `8px` category-hue dot (`margin-top:6px;` to align with the first text line) and stacked title/sub-label text.

## Footer

```css
height:40px;flex-shrink:0;
display:flex;align-items:center;justify-content:space-between;
padding:0 24px;
border-top:1px solid #e1e3e4;
font-family:'Poppins',sans-serif;font-size:12px;color:#747688;
```

Content: sync-status text on the left ("Synced 2 min ago"), product/hub label on the right ("Kynite Family Hub").

## Outer page wrapper (design-system page itself, for reference)

```css
background:#fbf9f4;min-height:100vh;font-family:'Poppins',sans-serif;color:#191c1d;
```
Content max-width container: `max-width:1180px;margin:0 auto;padding:0 32px 96px;display:flex;flex-direction:column;gap:64px;` (each section is a `64px`-gapped block).
