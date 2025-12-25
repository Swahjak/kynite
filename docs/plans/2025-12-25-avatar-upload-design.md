# Avatar Upload Design

Family members can upload custom SVG avatars generated from getavataaars.com, replacing Google profile images.

## Summary

- **Scope**: Family-member level (different avatar per family membership)
- **Source**: External creation at getavataaars.com, uploaded via file picker
- **Storage**: Inline SVG in database (`familyMembers.avatarSvg` column)
- **Security**: Server-side sanitization with DOMPurify
- **Fallback**: Avatar → Google image → Initials with color

## Data Model

Add `avatarSvg` column to `familyMembers` table:

```typescript
// src/server/schema.ts
export const familyMembers = pgTable("family_members", {
  // ... existing columns
  avatarSvg: text("avatar_svg"),
});
```

Display priority in FamilyAvatar component:

1. `familyMember.avatarSvg` — render inline SVG
2. `familyMember.user.image` — Google profile image
3. Initials with `avatarColor` — existing fallback

## API

Extend `PATCH /api/v1/families/[familyId]/members/[memberId]`:

- Accept multipart/form-data with `avatar` file field
- Validate: SVG format, max 10KB
- Sanitize SVG server-side before storing
- Send `avatarSvg: null` to remove custom avatar

Validation schema:

```typescript
// src/lib/validations/family.ts
export const updateMemberSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarColor: z.enum([...]).optional(),
  avatarSvg: z.string().max(10000).nullable().optional(),
});
```

Permissions unchanged: managers edit anyone, members edit themselves.

## UI Components

### Avatar Upload Dialog

Add to member edit dialog:

1. Current avatar preview
2. "Upload Avatar" button (file picker, `.svg` only)
3. Link to getavataaars.com (new tab)
4. "Remove Avatar" button (if custom avatar set)

### FamilyAvatar Updates

```tsx
// src/components/family/family-avatar.tsx
if (member.avatarSvg) {
  return <div dangerouslySetInnerHTML={{ __html: member.avatarSvg }} />
}
if (member.user?.image) {
  return <AvatarImage src={member.user.image} />
}
return <InitialsAvatar ... />
```

Using `dangerouslySetInnerHTML` is safe because SVG is sanitized server-side.

## Dependencies

```bash
pnpm add isomorphic-dompurify
```

## Security

SVG sanitization utility:

```typescript
// src/lib/svg-sanitizer.ts
import DOMPurify from "isomorphic-dompurify";

export function sanitizeSvg(svgContent: string): string {
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}
```

Server-side validation:

1. File size ≤ 10KB
2. Content starts with `<svg`
3. DOMPurify strips: `<script>`, `on*` handlers, `<foreignObject>`, external URLs

## Testing

### Unit Tests (Vitest)

- `svg-sanitizer.test.ts`: script tags stripped, event handlers stripped, external URLs stripped, valid avataaars preserved

### E2E Tests (Playwright)

- Upload valid avatar → displays correctly
- Upload oversized file → error message
- Upload non-SVG → rejection
- Remove avatar → fallback to Google/initials

## i18n

```json
{
  "family": {
    "avatar": {
      "upload": "Upload avatar / Avatar uploaden",
      "remove": "Remove avatar / Avatar verwijderen",
      "createAt": "Create your avatar at getavataaars.com",
      "fileTooLarge": "File must be smaller than 10KB",
      "invalidFormat": "Only SVG files are allowed"
    }
  }
}
```
