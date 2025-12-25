# Avatar Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable family members to upload custom SVG avatars from getavataaars.com, stored inline in the database.

**Architecture:** Add `avatarSvg` column to `familyMembers` table, extend the member update API to handle file uploads with server-side SVG sanitization via DOMPurify, and update the FamilyAvatar component to render custom SVGs with fallback to Google image then initials.

**Tech Stack:** Next.js 16, Drizzle ORM, isomorphic-dompurify, React 19, TypeScript

---

## Task 1: Add isomorphic-dompurify dependency

**Files:**

- Modify: `package.json`

**Step 1: Install dependency**

Run:

```bash
pnpm add isomorphic-dompurify
```

**Step 2: Verify installation**

Run: `pnpm list isomorphic-dompurify`
Expected: Shows isomorphic-dompurify in dependencies

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add isomorphic-dompurify for SVG sanitization"
```

---

## Task 2: Add avatarSvg column to schema

**Files:**

- Modify: `src/server/schema.ts:97-109`

**Step 1: Add column to familyMembers table**

In `src/server/schema.ts`, update the `familyMembers` table definition to add `avatarSvg`:

```typescript
export const familyMembers = pgTable("family_members", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'manager' | 'participant' | 'caregiver' | 'device'
  displayName: text("display_name"),
  avatarColor: text("avatar_color"),
  avatarSvg: text("avatar_svg"), // New column
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 2: Generate migration**

Run: `pnpm db:generate`
Expected: Creates new migration file in drizzle folder

**Step 3: Apply migration**

Run: `pnpm db:push` (dev) or `pnpm db:migrate` (production)
Expected: Schema applied successfully

**Step 4: Commit**

```bash
git add src/server/schema.ts drizzle/
git commit -m "feat(db): add avatarSvg column to familyMembers table"
```

---

## Task 3: Create SVG sanitizer utility

**Files:**

- Create: `src/lib/svg-sanitizer.ts`
- Create: `src/lib/__tests__/svg-sanitizer.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/svg-sanitizer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { sanitizeSvg, isValidSvg } from "../svg-sanitizer";

describe("sanitizeSvg", () => {
  it("preserves valid avataaars SVG structure", () => {
    const validSvg = `<svg viewBox="0 0 264 280" xmlns="http://www.w3.org/2000/svg">
      <circle cx="132" cy="140" r="100" fill="#D0C6AC"/>
    </svg>`;
    const result = sanitizeSvg(validSvg);
    expect(result).toContain("<svg");
    expect(result).toContain("<circle");
  });

  it("strips script tags", () => {
    const maliciousSvg = `<svg><script>alert('xss')</script><circle/></svg>`;
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
  });

  it("strips event handlers", () => {
    const maliciousSvg = `<svg><circle onclick="alert('xss')" onerror="alert('xss')"/></svg>`;
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("onerror");
  });

  it("strips javascript URLs", () => {
    const maliciousSvg = `<svg><a href="javascript:alert('xss')"><circle/></a></svg>`;
    const result = sanitizeSvg(maliciousSvg);
    expect(result).not.toContain("javascript:");
  });
});

describe("isValidSvg", () => {
  it("returns true for valid SVG", () => {
    const validSvg = `<svg viewBox="0 0 100 100"><circle/></svg>`;
    expect(isValidSvg(validSvg)).toBe(true);
  });

  it("returns false for non-SVG content", () => {
    expect(isValidSvg("<div>not svg</div>")).toBe(false);
    expect(isValidSvg("plain text")).toBe(false);
    expect(isValidSvg("")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/lib/__tests__/svg-sanitizer.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/lib/svg-sanitizer.ts`:

```typescript
import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize SVG content by removing potentially dangerous elements
 * Strips scripts, event handlers, and external resource references
 */
export function sanitizeSvg(svgContent: string): string {
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}

/**
 * Check if content appears to be a valid SVG
 * Basic validation - checks for opening svg tag
 */
export function isValidSvg(content: string): boolean {
  if (!content || typeof content !== "string") {
    return false;
  }
  const trimmed = content.trim();
  return trimmed.startsWith("<svg") && trimmed.includes("</svg>");
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/lib/__tests__/svg-sanitizer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/svg-sanitizer.ts src/lib/__tests__/svg-sanitizer.test.ts
git commit -m "feat: add SVG sanitizer utility with DOMPurify"
```

---

## Task 4: Update validation schema

**Files:**

- Modify: `src/lib/validations/family.ts:24-35`
- Modify: `src/lib/validations/__tests__/family.test.ts`

**Step 1: Write the failing test**

Add to `src/lib/validations/__tests__/family.test.ts`:

```typescript
describe("updateMemberSchema with avatarSvg", () => {
  it("accepts valid avatarSvg", () => {
    const result = updateMemberSchema.safeParse({
      avatarSvg: "<svg></svg>",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null avatarSvg (for removal)", () => {
    const result = updateMemberSchema.safeParse({
      avatarSvg: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects avatarSvg over 10KB", () => {
    const largeSvg = "<svg>" + "x".repeat(10001) + "</svg>";
    const result = updateMemberSchema.safeParse({
      avatarSvg: largeSvg,
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/lib/validations/__tests__/family.test.ts`
Expected: FAIL - avatarSvg not in schema

**Step 3: Update validation schema**

In `src/lib/validations/family.ts`, update `updateMemberSchema`:

```typescript
export const updateMemberSchema = z.object({
  displayName: z
    .string()
    .max(50, "Display name must be 50 characters or less")
    .optional()
    .nullable(),
  avatarColor: z
    .enum(AVATAR_COLORS as [string, ...string[]])
    .optional()
    .nullable(),
  avatarSvg: z
    .string()
    .max(10000, "Avatar SVG must be smaller than 10KB")
    .optional()
    .nullable(),
  role: z.enum(FAMILY_MEMBER_ROLES as [string, ...string[]]).optional(),
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/lib/validations/__tests__/family.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/validations/family.ts src/lib/validations/__tests__/family.test.ts
git commit -m "feat: add avatarSvg to updateMemberSchema validation"
```

---

## Task 5: Update family service

**Files:**

- Modify: `src/server/services/family-service.ts:146-184`

**Step 1: Update updateMember function signature and logic**

In `src/server/services/family-service.ts`, update the `updateMember` function:

```typescript
/**
 * Update a family member's display name, avatar color, avatar SVG, or role
 */
export async function updateMember(
  memberId: string,
  data: {
    displayName?: string | null;
    avatarColor?: string | null;
    avatarSvg?: string | null;
    role?: FamilyMemberRole;
  }
) {
  const updateData: Record<string, unknown> = {};

  if (data.displayName !== undefined) {
    updateData.displayName = data.displayName;
  }
  if (data.avatarColor !== undefined) {
    updateData.avatarColor = data.avatarColor;
  }
  if (data.avatarSvg !== undefined) {
    updateData.avatarSvg = data.avatarSvg;
  }
  if (data.role !== undefined) {
    updateData.role = data.role;
  }

  if (Object.keys(updateData).length === 0) {
    // No updates provided
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, memberId))
      .limit(1);
    return member;
  }

  const [updated] = await db
    .update(familyMembers)
    .set(updateData)
    .where(eq(familyMembers.id, memberId))
    .returning();

  return updated;
}
```

**Step 2: Update getFamilyMembers to include avatarSvg**

In the same file, update `getFamilyMembers` select to include `avatarSvg`:

```typescript
export async function getFamilyMembers(
  familyId: string
): Promise<FamilyMemberWithUser[]> {
  const members = await db
    .select({
      id: familyMembers.id,
      familyId: familyMembers.familyId,
      userId: familyMembers.userId,
      role: familyMembers.role,
      displayName: familyMembers.displayName,
      avatarColor: familyMembers.avatarColor,
      avatarSvg: familyMembers.avatarSvg, // Add this
      createdAt: familyMembers.createdAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(familyMembers)
    .innerJoin(users, eq(familyMembers.userId, users.id))
    .where(eq(familyMembers.familyId, familyId));

  return members
    .filter((m) => m.role !== "device")
    .map((m) => ({
      ...m,
      role: m.role as FamilyMemberRole,
    }));
}
```

**Step 3: Run tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/server/services/family-service.ts
git commit -m "feat: add avatarSvg support to family service"
```

---

## Task 6: Update types

**Files:**

- Modify: `src/types/family.ts:38-52`

**Step 1: Add avatarSvg to FamilyMemberWithUser interface**

Update `src/types/family.ts`:

```typescript
export interface FamilyMemberWithUser {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyMemberRole;
  displayName: string | null;
  avatarColor: string | null;
  avatarSvg: string | null; // Add this
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}
```

**Step 2: Run TypeScript check**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/types/family.ts
git commit -m "feat: add avatarSvg to FamilyMemberWithUser type"
```

---

## Task 7: Update API route with sanitization

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/members/[memberId]/route.ts`

**Step 1: Update PATCH handler to sanitize SVG**

Update the route to import and use the sanitizer:

```typescript
// At top of file, add imports
import { sanitizeSvg, isValidSvg } from "@/lib/svg-sanitizer";

// In PATCH handler, after validation parsing, before updateMember call:
// Add SVG sanitization
let sanitizedSvg: string | null | undefined = parsed.data.avatarSvg;
if (parsed.data.avatarSvg) {
  if (!isValidSvg(parsed.data.avatarSvg)) {
    return Errors.validation({
      avatarSvg: "Invalid SVG format",
    });
  }
  sanitizedSvg = sanitizeSvg(parsed.data.avatarSvg);
}

const updated = await updateMember(memberId, {
  displayName: parsed.data.displayName,
  avatarColor: parsed.data.avatarColor,
  avatarSvg: sanitizedSvg,
  role: parsed.data.role as FamilyMemberRole | undefined,
});
```

**Step 2: Run tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/app/api/v1/families/[familyId]/members/[memberId]/route.ts
git commit -m "feat(api): add SVG sanitization to member update endpoint"
```

---

## Task 8: Update FamilyAvatar component

**Files:**

- Modify: `src/components/family/family-avatar.tsx`

**Step 1: Update component to render SVG**

Update `src/components/family/family-avatar.tsx`:

```typescript
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AvatarColor } from "@/types/family";

interface FamilyAvatarProps {
  name: string;
  color?: AvatarColor | null;
  avatarSvg?: string | null;
  googleImage?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function FamilyAvatar({
  name,
  color,
  avatarSvg,
  googleImage,
  size = "md",
  className,
}: FamilyAvatarProps) {
  const sizeClasses = {
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-12 text-base",
  };

  const colorClassMap: Record<AvatarColor, string> = {
    blue: "bg-[var(--event-blue-border)] text-white",
    purple: "bg-[var(--event-purple-border)] text-white",
    orange: "bg-[var(--event-orange-border)] text-white",
    green: "bg-[var(--event-green-border)] text-white",
    red: "bg-[var(--event-red-border)] text-white",
    yellow: "bg-[var(--event-yellow-border)] text-white",
    pink: "bg-[var(--event-pink-border)] text-white",
    teal: "bg-[var(--event-teal-border)] text-white",
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Priority 1: Custom SVG avatar
  if (avatarSvg) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-full",
          sizeClasses[size],
          className
        )}
        dangerouslySetInnerHTML={{ __html: avatarSvg }}
      />
    );
  }

  // Priority 2: Google profile image
  if (googleImage) {
    return (
      <Avatar className={cn(sizeClasses[size], className)}>
        <AvatarImage src={googleImage} alt={name} />
        <AvatarFallback
          className={cn(
            "font-semibold",
            color ? colorClassMap[color] : "bg-muted text-muted-foreground"
          )}
        >
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
    );
  }

  // Priority 3: Initials with color
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarFallback
        className={cn(
          "font-semibold",
          color ? colorClassMap[color] : "bg-muted text-muted-foreground"
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
```

**Step 2: Run tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/components/family/family-avatar.tsx
git commit -m "feat: update FamilyAvatar to render SVG with priority fallback"
```

---

## Task 9: Update FamilyMemberCard to pass avatar data

**Files:**

- Modify: `src/components/family/family-member-card.tsx:64-67`

**Step 1: Update FamilyAvatar usage**

In `src/components/family/family-member-card.tsx`, update the FamilyAvatar call:

```typescript
<FamilyAvatar
  name={displayName}
  color={member.avatarColor as AvatarColor}
  avatarSvg={member.avatarSvg}
  googleImage={member.user.image}
/>
```

**Step 2: Run TypeScript check**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/family/family-member-card.tsx
git commit -m "feat: pass avatarSvg and googleImage to FamilyAvatar"
```

---

## Task 10: Add avatar upload UI to MemberEditDialog

**Files:**

- Modify: `src/components/family/member-edit-dialog.tsx`

**Step 1: Update dialog with avatar upload section**

Update `src/components/family/member-edit-dialog.tsx`:

```typescript
"use client";

import { useState, useRef } from "react";
import type {
  FamilyMemberWithUser,
  FamilyMemberRole,
  AvatarColor,
} from "@/types/family";
import { FAMILY_MEMBER_ROLES } from "@/types/family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarColorPicker } from "./avatar-color-picker";
import { FamilyAvatar } from "./family-avatar";
import { Upload, Trash2, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

interface MemberEditDialogProps {
  member: FamilyMemberWithUser;
  canChangeRole: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    displayName?: string | null;
    avatarColor?: AvatarColor | null;
    avatarSvg?: string | null;
    role?: FamilyMemberRole;
  }) => void;
}

const roleLabels: Record<FamilyMemberRole, string> = {
  manager: "Manager",
  participant: "Member",
  caregiver: "Caregiver",
  device: "Device",
  child: "Child",
};

const MAX_FILE_SIZE = 10 * 1024; // 10KB

export function MemberEditDialog({
  member,
  canChangeRole,
  open,
  onOpenChange,
  onSave,
}: MemberEditDialogProps) {
  const t = useTranslations("family.avatar");
  const [displayName, setDisplayName] = useState(member.displayName || "");
  const [avatarColor, setAvatarColor] = useState<AvatarColor | null>(
    (member.avatarColor as AvatarColor) || null
  );
  const [avatarSvg, setAvatarSvg] = useState<string | null>(
    member.avatarSvg || null
  );
  const [role, setRole] = useState<FamilyMemberRole>(
    member.role as FamilyMemberRole
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentDisplayName = displayName || member.user.name;

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(t("fileTooLarge"));
      return;
    }

    // Validate file type
    if (!file.name.endsWith(".svg") && file.type !== "image/svg+xml") {
      setUploadError(t("invalidFormat"));
      return;
    }

    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content && content.trim().startsWith("<svg")) {
        setAvatarSvg(content);
      } else {
        setUploadError(t("invalidFormat"));
      }
    };
    reader.readAsText(file);
  }

  function handleRemoveAvatar() {
    setAvatarSvg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSave() {
    onSave({
      displayName: displayName || null,
      avatarColor,
      avatarSvg,
      ...(canChangeRole && { role }),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update display name and appearance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center gap-3">
            <FamilyAvatar
              name={currentDisplayName}
              color={avatarColor}
              avatarSvg={avatarSvg}
              googleImage={member.user.image}
              size="lg"
            />
          </div>

          {/* Avatar Upload */}
          <div className="space-y-2">
            <Label>{t("upload")}</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,image/svg+xml"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {t("upload")}
              </Button>
              {avatarSvg && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("remove")}
                </Button>
              )}
            </div>
            <a
              href="https://getavataaars.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
            >
              <ExternalLink className="h-3 w-3" />
              {t("createAt")}
            </a>
            {uploadError && (
              <p className="text-destructive text-xs">{uploadError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={member.user.name}
            />
            <p className="text-muted-foreground text-xs">
              Leave empty to use account name
            </p>
          </div>

          <div className="space-y-2">
            <Label>Avatar Color</Label>
            <AvatarColorPicker value={avatarColor} onChange={setAvatarColor} />
            <p className="text-muted-foreground text-xs">
              Used when no custom avatar is set
            </p>
          </div>

          {canChangeRole && (
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as FamilyMemberRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAMILY_MEMBER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Run TypeScript check**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/family/member-edit-dialog.tsx
git commit -m "feat: add avatar upload UI to member edit dialog"
```

---

## Task 11: Update onUpdate callback in FamilyMemberCard

**Files:**

- Modify: `src/components/family/family-member-card.tsx:36-41`

**Step 1: Add avatarSvg to onUpdate type**

Update the `onUpdate` prop type in `FamilyMemberCardProps`:

```typescript
onUpdate: (data: {
  displayName?: string | null;
  avatarColor?: AvatarColor | null;
  avatarSvg?: string | null;
  role?: FamilyMemberRole;
}) => void;
```

**Step 2: Run TypeScript check**

Run: `pnpm tsc --noEmit`
Expected: No type errors (may need to update calling components)

**Step 3: Commit**

```bash
git add src/components/family/family-member-card.tsx
git commit -m "feat: add avatarSvg to member card onUpdate callback"
```

---

## Task 12: Add i18n translations

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Add English translations**

In `messages/en.json`, add under the "family" key:

```json
{
  "family": {
    "avatar": {
      "upload": "Upload avatar",
      "remove": "Remove avatar",
      "createAt": "Create your avatar at getavataaars.com",
      "fileTooLarge": "File must be smaller than 10KB",
      "invalidFormat": "Only SVG files are allowed"
    }
  }
}
```

**Step 2: Add Dutch translations**

In `messages/nl.json`, add under the "family" key:

```json
{
  "family": {
    "avatar": {
      "upload": "Avatar uploaden",
      "remove": "Avatar verwijderen",
      "createAt": "Maak je avatar op getavataaars.com",
      "fileTooLarge": "Bestand moet kleiner zijn dan 10KB",
      "invalidFormat": "Alleen SVG-bestanden zijn toegestaan"
    }
  }
}
```

**Step 3: Run dev server to verify no i18n errors**

Run: `pnpm dev`
Expected: No missing translation errors

**Step 4: Commit**

```bash
git add messages/en.json messages/nl.json
git commit -m "feat(i18n): add avatar upload translations"
```

---

## Task 13: Write E2E test for avatar upload

**Files:**

- Create: `e2e/tests/family/avatar-upload.spec.ts`

**Step 1: Create E2E test**

Create `e2e/tests/family/avatar-upload.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { authTest } from "../../fixtures/auth-fixture";

const VALID_SVG = `<svg viewBox="0 0 264 280" xmlns="http://www.w3.org/2000/svg">
  <circle cx="132" cy="140" r="100" fill="#D0C6AC"/>
</svg>`;

authTest.describe("Avatar Upload", () => {
  authTest("can upload and display custom avatar", async ({ authedPage }) => {
    // Navigate to family settings
    await authedPage.goto("/settings");

    // Find and click edit on a member
    await authedPage.getByRole("button", { name: /edit/i }).first().click();

    // Upload avatar file
    const fileInput = authedPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "avatar.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(VALID_SVG),
    });

    // Save changes
    await authedPage.getByRole("button", { name: /save/i }).click();

    // Verify avatar is displayed (SVG content in page)
    await expect(authedPage.locator("svg circle")).toBeVisible();
  });

  authTest("shows error for oversized file", async ({ authedPage }) => {
    await authedPage.goto("/settings");
    await authedPage.getByRole("button", { name: /edit/i }).first().click();

    // Create large file (> 10KB)
    const largeSvg = "<svg>" + "x".repeat(15000) + "</svg>";
    const fileInput = authedPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "large.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(largeSvg),
    });

    // Verify error message
    await expect(authedPage.getByText(/smaller than 10KB/i)).toBeVisible();
  });

  authTest("can remove custom avatar", async ({ authedPage }) => {
    // Assume avatar already set from previous test
    await authedPage.goto("/settings");
    await authedPage.getByRole("button", { name: /edit/i }).first().click();

    // Click remove avatar
    await authedPage.getByRole("button", { name: /remove/i }).click();

    // Save and verify avatar removed (falls back to initials)
    await authedPage.getByRole("button", { name: /save/i }).click();
  });
});
```

**Step 2: Commit**

```bash
git add e2e/tests/family/avatar-upload.spec.ts
git commit -m "test(e2e): add avatar upload tests"
```

---

## Task 14: Run all tests and verify

**Step 1: Run unit tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 3: Run linter**

Run: `pnpm lint`
Expected: No errors

**Step 4: Run E2E tests (optional - requires DB)**

Run: `pnpm e2e:full`
Expected: All tests pass

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any test or lint issues"
```

---

## Summary

After completing all tasks, you will have:

1. **Database**: `avatarSvg` column on `familyMembers` table
2. **Backend**: SVG sanitization with DOMPurify, updated API endpoint
3. **Frontend**: Avatar upload UI in member edit dialog, priority-based avatar rendering
4. **i18n**: Translations for upload UI in Dutch and English
5. **Tests**: Unit tests for sanitizer and validation, E2E tests for upload flow
