# Child Members Phase 2 - Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the child members feature by adding the link-account flow, UI components, security fixes, and tests.

**Architecture:** Add link-account page that validates upgrade tokens and links Google accounts to child profiles. Add UI dialogs in family settings for child management. Fix security gaps identified in code review.

**Tech Stack:** Next.js 16, React 19, shadcn/ui, Drizzle ORM, Playwright E2E

---

## Task 1: Add Database Index for Performance

**Files:**

- Modify: `src/server/schema.ts`

**Step 1: Add index on childUpgradeTokens.childUserId**

```typescript
// Add after childUpgradeTokens table definition
import { index } from "drizzle-orm/pg-core";

// Update table to include index
export const childUpgradeTokens = pgTable(
  "child_upgrade_tokens",
  {
    // ... existing columns
  },
  (table) => [
    index("child_upgrade_tokens_child_user_id_idx").on(table.childUserId),
  ]
);
```

**Step 2: Generate and run migration**

Run: `pnpm db:generate && pnpm db:migrate`

**Step 3: Commit**

```bash
git add src/server/schema.ts drizzle/
git commit -m "perf(schema): add index on childUpgradeTokens.childUserId"
```

---

## Task 2: Add User Type Validation to Upgrade Token Creation

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/children/[childMemberId]/upgrade-token/route.ts`

**Step 1: Add validation that user is type "child"**

After getting the child member, add:

```typescript
// Verify the user is actually a child type
const childUser = await db
  .select({ type: users.type })
  .from(users)
  .where(eq(users.id, childMember[0].userId))
  .limit(1);

if (childUser.length === 0 || childUser[0].type !== "child") {
  return Errors.validation({
    _errors: ["Can only generate upgrade tokens for child accounts"],
  });
}
```

**Step 2: Add import for users schema**

Add `users` to the imports from `@/server/schema`.

**Step 3: Commit**

```bash
git add src/app/api/v1/families/[familyId]/children/[childMemberId]/upgrade-token/route.ts
git commit -m "fix(api): validate user type before creating upgrade token"
```

---

## Task 3: Create Link Account API Endpoint

**Files:**

- Create: `src/app/api/v1/link-account/route.ts`

**Step 1: Create the endpoint**

```typescript
// src/app/api/v1/link-account/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import {
  getUpgradeToken,
  upgradeChildToAccount,
} from "@/server/services/child-service";
import { Errors } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return Errors.validation({ token: "Token is required" });
    }

    // Validate token exists and is valid
    const upgradeToken = await getUpgradeToken(token);
    if (!upgradeToken) {
      return Errors.validation({
        token: "Invalid or expired token",
      });
    }

    // Upgrade the child account
    const updatedUser = await upgradeChildToAccount(
      token,
      session.user.email,
      session.user.name
    );

    return NextResponse.json({
      success: true,
      data: {
        message: "Account linked successfully",
        userId: updatedUser.id,
      },
    });
  } catch (error) {
    console.error("Error linking account:", error);

    if (error instanceof Error) {
      if (error.message === "Email already in use") {
        return Errors.validation({
          email: "This email is already associated with another account",
        });
      }
      if (
        error.message === "Token expired" ||
        error.message === "Invalid token"
      ) {
        return Errors.validation({ token: error.message });
      }
    }

    return Errors.internal("Failed to link account");
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return Errors.validation({ token: "Token is required" });
  }

  const upgradeToken = await getUpgradeToken(token);

  if (!upgradeToken) {
    return NextResponse.json({
      success: true,
      data: { valid: false, reason: "Invalid or expired token" },
    });
  }

  return NextResponse.json({
    success: true,
    data: { valid: true, expiresAt: upgradeToken.expiresAt },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/link-account/route.ts
git commit -m "feat(api): add link-account endpoint for child upgrades"
```

---

## Task 4: Create Link Account Page

**Files:**

- Create: `src/app/[locale]/link-account/page.tsx`
- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Add translations**

Add to `messages/en.json` under "LinkAccount":

```json
{
  "LinkAccount": {
    "title": "Link Your Account",
    "description": "Connect your account to your family profile",
    "invalidToken": "This link is invalid or has expired",
    "alreadyLinked": "This account is already linked",
    "linkButton": "Link My Account",
    "linking": "Linking...",
    "success": "Account linked successfully!",
    "successDescription": "You can now access your family from any device",
    "goToDashboard": "Go to Dashboard",
    "error": "Failed to link account"
  }
}
```

Add to `messages/nl.json`:

```json
{
  "LinkAccount": {
    "title": "Koppel je account",
    "description": "Verbind je account met je familieprofiel",
    "invalidToken": "Deze link is ongeldig of verlopen",
    "alreadyLinked": "Dit account is al gekoppeld",
    "linkButton": "Koppel mijn account",
    "linking": "Koppelen...",
    "success": "Account succesvol gekoppeld!",
    "successDescription": "Je hebt nu toegang tot je familie vanaf elk apparaat",
    "goToDashboard": "Ga naar dashboard",
    "error": "Account koppelen mislukt"
  }
}
```

**Step 2: Create the page**

```typescript
// src/app/[locale]/link-account/page.tsx
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LinkAccountClient } from "./link-account-client";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function LinkAccountPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const t = await getTranslations("LinkAccount");

  if (!token) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <LinkAccountClient token={token} />
    </div>
  );
}
```

**Step 3: Create client component**

```typescript
// src/app/[locale]/link-account/link-account-client.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

interface Props {
  token: string;
}

export function LinkAccountClient({ token }: Props) {
  const t = useTranslations("LinkAccount");
  const router = useRouter();
  const [status, setStatus] = useState<"validating" | "valid" | "invalid" | "linking" | "success" | "error">("validating");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`/api/v1/link-account?token=${token}`);
        const data = await res.json();

        if (data.success && data.data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    }

    validateToken();
  }, [token]);

  async function handleLink() {
    setStatus("linking");
    setError(null);

    try {
      const res = await fetch("/api/v1/link-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setError(data.error?.message || t("error"));
      }
    } catch {
      setStatus("error");
      setError(t("error"));
    }
  }

  if (status === "validating") {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (status === "invalid") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <XCircle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle>{t("invalidToken")}</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <CardTitle>{t("success")}</CardTitle>
          <CardDescription>{t("successDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => router.push("/dashboard")}>
            {t("goToDashboard")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
        <Button
          className="w-full"
          onClick={handleLink}
          disabled={status === "linking"}
        >
          {status === "linking" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("linking")}
            </>
          ) : (
            t("linkButton")
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/[locale]/link-account/ messages/
git commit -m "feat(ui): add link-account page for child upgrades"
```

---

## Task 5: Create Add Child Dialog Component

**Files:**

- Create: `src/components/family/add-child-dialog.tsx`

**Step 1: Create the dialog**

```typescript
// src/components/family/add-child-dialog.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AVATAR_COLORS, type AvatarColor } from "@/types/family";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface AddChildDialogProps {
  familyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const colorMap: Record<AvatarColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  teal: "bg-teal-500",
};

export function AddChildDialog({
  familyId,
  open,
  onOpenChange,
  onSuccess,
}: AddChildDialogProps) {
  const t = useTranslations("Family");
  const [name, setName] = useState("");
  const [avatarColor, setAvatarColor] = useState<AvatarColor>("blue");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/families/${familyId}/children`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarColor }),
      });

      const data = await res.json();

      if (data.success) {
        setName("");
        setAvatarColor("blue");
        onOpenChange(false);
        onSuccess();
      } else {
        setError(data.error?.message || "Failed to add child");
      }
    } catch {
      setError("Failed to add child");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("addChild")}</DialogTitle>
            <DialogDescription>
              {t("childNamePlaceholder")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("childName")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("childNamePlaceholder")}
                maxLength={50}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t("selectAvatarColor")}</Label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    className={cn(
                      "h-8 w-8 rounded-full transition-all",
                      colorMap[color],
                      avatarColor === color
                        ? "ring-2 ring-offset-2 ring-primary"
                        : "opacity-60 hover:opacity-100"
                    )}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                t("createChild")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/family/add-child-dialog.tsx
git commit -m "feat(ui): add AddChildDialog component"
```

---

## Task 6: Create Upgrade Token Dialog Component

**Files:**

- Create: `src/components/family/upgrade-token-dialog.tsx`

**Step 1: Create the dialog**

```typescript
// src/components/family/upgrade-token-dialog.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, Check } from "lucide-react";

interface UpgradeTokenDialogProps {
  familyId: string;
  childMemberId: string;
  childName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeTokenDialog({
  familyId,
  childMemberId,
  childName,
  open,
  onOpenChange,
}: UpgradeTokenDialogProps) {
  const t = useTranslations("Family");
  const [isGenerating, setIsGenerating] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/v1/families/${familyId}/children/${childMemberId}/upgrade-token`,
        { method: "POST" }
      );

      const data = await res.json();

      if (data.success) {
        const fullUrl = `${window.location.origin}${data.data.linkUrl}`;
        setLinkUrl(fullUrl);
        setExpiresAt(new Date(data.data.expiresAt).toLocaleString());
      } else {
        setError(data.error?.message || "Failed to generate link");
      }
    } catch {
      setError("Failed to generate link");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (linkUrl) {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleClose() {
    setLinkUrl(null);
    setExpiresAt(null);
    setCopied(false);
    setError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("linkAccount")}</DialogTitle>
          <DialogDescription>
            Generate a link for {childName} to connect their account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!linkUrl ? (
            <>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  t("generateUpgradeLink")
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Account Link</Label>
                <div className="flex gap-2">
                  <Input value={linkUrl} readOnly className="font-mono text-sm" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                {t("linkExpires")}: {expiresAt}
              </p>

              <p className="text-sm text-muted-foreground">
                Share this link with {childName}. When they click it and sign in,
                their account will be connected to their family profile.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/family/upgrade-token-dialog.tsx
git commit -m "feat(ui): add UpgradeTokenDialog component"
```

---

## Task 7: Update Role Badge and Dialog to Use i18n

**Files:**

- Modify: `src/components/family/role-badge.tsx`
- Modify: `src/components/family/member-edit-dialog.tsx`

**Step 1: Update role-badge.tsx**

```typescript
// src/components/family/role-badge.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import type { FamilyMemberRole } from "@/types/family";

interface RoleBadgeProps {
  role: FamilyMemberRole;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const t = useTranslations("Family.roles");

  const variantMap: Record<
    FamilyMemberRole,
    "default" | "secondary" | "outline"
  > = {
    manager: "default",
    participant: "secondary",
    caregiver: "outline",
    device: "outline",
    child: "secondary",
  };

  return (
    <Badge variant={variantMap[role]} className={className}>
      {t(role)}
    </Badge>
  );
}
```

**Step 2: Add role translations to messages**

Add to `messages/en.json` under "Family":

```json
{
  "Family": {
    "roles": {
      "manager": "Manager",
      "participant": "Member",
      "caregiver": "Caregiver",
      "device": "Device",
      "child": "Child"
    }
  }
}
```

Add to `messages/nl.json`:

```json
{
  "Family": {
    "roles": {
      "manager": "Beheerder",
      "participant": "Lid",
      "caregiver": "Verzorger",
      "device": "Apparaat",
      "child": "Kind"
    }
  }
}
```

**Step 3: Commit**

```bash
git add src/components/family/role-badge.tsx messages/
git commit -m "refactor(ui): use i18n for role labels"
```

---

## Task 8: Add E2E Test for Child Creation

**Files:**

- Create: `e2e/tests/family/children.spec.ts`

**Step 1: Create E2E test file**

```typescript
// e2e/tests/family/children.spec.ts
import { test, expect } from "@playwright/test";
import {
  createTestFamily,
  createTestUser,
  loginAsUser,
} from "../../utils/test-helpers";

test.describe("Child Members", () => {
  test("manager can create a child member via API", async ({ request }) => {
    // Setup: Create family with manager
    const { family, manager, token } = await createTestFamily();

    // Create child
    const response = await request.post(
      `/api/v1/families/${family.id}/children`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          name: "Test Child",
          avatarColor: "blue",
        },
      }
    );

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.member.displayName).toBe("Test Child");
    expect(data.data.member.role).toBe("child");
  });

  test("non-manager cannot create a child member", async ({ request }) => {
    const { family, participant, participantToken } = await createTestFamily({
      withParticipant: true,
    });

    const response = await request.post(
      `/api/v1/families/${family.id}/children`,
      {
        headers: { Authorization: `Bearer ${participantToken}` },
        data: {
          name: "Test Child",
          avatarColor: "blue",
        },
      }
    );

    expect(response.status()).toBe(403);
  });

  test("manager can generate upgrade token for child", async ({ request }) => {
    const { family, manager, token } = await createTestFamily();

    // First create a child
    const childRes = await request.post(
      `/api/v1/families/${family.id}/children`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: "Test Child", avatarColor: "blue" },
      }
    );
    const childData = await childRes.json();
    const childMemberId = childData.data.member.id;

    // Generate upgrade token
    const tokenRes = await request.post(
      `/api/v1/families/${family.id}/children/${childMemberId}/upgrade-token`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    expect(tokenRes.ok()).toBe(true);
    const tokenData = await tokenRes.json();
    expect(tokenData.data.token).toBeDefined();
    expect(tokenData.data.linkUrl).toContain("/link-account?token=");
  });

  test("enforces maximum 10 children per family", async ({ request }) => {
    const { family, token } = await createTestFamily();

    // Create 10 children
    for (let i = 0; i < 10; i++) {
      const res = await request.post(`/api/v1/families/${family.id}/children`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: `Child ${i + 1}`, avatarColor: "blue" },
      });
      expect(res.ok()).toBe(true);
    }

    // 11th should fail
    const response = await request.post(
      `/api/v1/families/${family.id}/children`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: "Child 11", avatarColor: "blue" },
      }
    );

    expect(response.status()).toBe(400);
  });
});
```

**Step 2: Commit**

```bash
git add e2e/tests/family/children.spec.ts
git commit -m "test(e2e): add child member creation tests"
```

---

## Task 9: Run Full Verification

**Step 1: Run all tests**

```bash
pnpm test:run
pnpm lint
```

**Step 2: Run E2E tests (if DB available)**

```bash
pnpm e2e:setup && pnpm e2e e2e/tests/family/children.spec.ts
```

**Step 3: Run build**

```bash
pnpm turbo run build:next
```

---

## Summary

After completing all tasks:

1. **Security fixes**: DB index, user type validation
2. **Link account flow**: API endpoint + UI page
3. **UI components**: AddChildDialog, UpgradeTokenDialog
4. **i18n**: Proper translations for roles
5. **E2E tests**: API-level tests for child creation flow

**Not included** (deferred):

- Rate limiting (requires infrastructure)
- Token cleanup job (requires cron setup)
- Comprehensive service unit tests (integration tests via E2E instead)
