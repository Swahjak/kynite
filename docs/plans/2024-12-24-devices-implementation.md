# Devices Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable wall-mounted tablets to access the family planner via 6-digit pairing codes with restricted permissions.

**Architecture:** Devices are phantom users (`type: 'device'`) with `role: 'device'` in familyMembers. They use standard better-auth sessions but with extended context (`isDevice`, `memberRole`). The same UI is served with mutation controls hidden based on session context.

**Tech Stack:** Next.js 16, better-auth, Drizzle ORM, PostgreSQL, shadcn/ui, next-intl

---

## Task 1: Schema - Add User Type Field

**Files:**

- Modify: `src/server/schema.ts:18-26`
- Test: Manual - run migration

**Step 1: Add type field to users table**

In `src/server/schema.ts`, modify the users table definition:

```typescript
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  type: text("type").notNull().default("human"), // 'human' | 'device'
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 2: Update User type export**

No changes needed - `$inferSelect` will automatically include the new field.

**Step 3: Generate migration**

Run: `pnpm db:generate`
Expected: New migration file created in `drizzle/` with ALTER TABLE

**Step 4: Run migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 5: Commit**

```bash
git add src/server/schema.ts drizzle/
git commit -m "feat(schema): add type field to users table for device support"
```

---

## Task 2: Schema - Add Device Pairing Codes Table

**Files:**

- Modify: `src/server/schema.ts` (add after familyInvites, ~line 125)

**Step 1: Add devicePairingCodes table**

Add after `familyInvites` table:

```typescript
/**
 * Device Pairing Codes table - Short-lived codes for device pairing
 */
export const devicePairingCodes = pgTable("device_pairing_codes", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  deviceName: text("device_name").notNull(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 2: Add relations**

Add after `familyInvitesRelations`:

```typescript
export const devicePairingCodesRelations = relations(
  devicePairingCodes,
  ({ one }) => ({
    family: one(families, {
      fields: [devicePairingCodes.familyId],
      references: [families.id],
    }),
    createdBy: one(users, {
      fields: [devicePairingCodes.createdById],
      references: [users.id],
    }),
  })
);
```

**Step 3: Add type exports**

Add to the type exports section at the bottom:

```typescript
export type DevicePairingCode = typeof devicePairingCodes.$inferSelect;
export type NewDevicePairingCode = typeof devicePairingCodes.$inferInsert;
```

**Step 4: Generate and run migration**

Run: `pnpm db:generate && pnpm db:migrate`
Expected: Migration creates device_pairing_codes table

**Step 5: Commit**

```bash
git add src/server/schema.ts drizzle/
git commit -m "feat(schema): add device_pairing_codes table"
```

---

## Task 3: Auth - Extend Custom Session Plugin

**Files:**

- Modify: `src/server/auth.ts:38-54`
- Modify: `src/lib/get-session.ts` (add helper)

**Step 1: Update customSession plugin**

Replace the customSession plugin in `src/server/auth.ts`:

```typescript
plugins: [
  customSession(async ({ user, session }) => {
    // Query user's family membership
    const membership = await db
      .select({
        familyId: familyMembers.familyId,
        role: familyMembers.role,
        displayName: familyMembers.displayName,
        memberId: familyMembers.id,
      })
      .from(familyMembers)
      .where(eq(familyMembers.userId, user.id))
      .limit(1);

    const member = membership[0];
    const isDevice = (user as { type?: string }).type === "device";

    return {
      user,
      session: {
        ...session,
        familyId: member?.familyId ?? null,
        memberId: member?.memberId ?? null,
        memberRole: member?.role ?? null,
        isDevice,
        deviceName: isDevice ? member?.displayName : null,
      },
    };
  }),
],
```

**Step 2: Add schema import for user type**

Add to imports at top of `src/server/auth.ts`:

```typescript
import { users } from "./schema";
```

**Step 3: Add isDevice helper to get-session.ts**

Add to `src/lib/get-session.ts`:

```typescript
/**
 * Check if the current session is a device session
 * Returns false if not authenticated
 */
export async function isDeviceSession() {
  const session = await getSession();
  return session?.session?.isDevice === true;
}

/**
 * Get the current user's member role from session
 * Returns null if not authenticated or no family
 */
export async function getCurrentMemberRole() {
  const session = await getSession();
  return session?.session?.memberRole || null;
}
```

**Step 4: Verify types compile**

Run: `pnpm build`
Expected: Build succeeds (may have type inference from better-auth)

**Step 5: Commit**

```bash
git add src/server/auth.ts src/lib/get-session.ts
git commit -m "feat(auth): extend session with isDevice and memberRole"
```

---

## Task 4: Validation Schemas for Devices

**Files:**

- Create: `src/lib/validations/device.ts`

**Step 1: Create device validation schemas**

Create `src/lib/validations/device.ts`:

```typescript
import { z } from "zod";

// =============================================================================
// PAIRING SCHEMAS
// =============================================================================

export const generatePairingCodeSchema = z.object({
  deviceName: z.string().min(1).max(50),
});

export const completePairingSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});

export type GeneratePairingCodeInput = z.infer<
  typeof generatePairingCodeSchema
>;
export type CompletePairingInput = z.infer<typeof completePairingSchema>;

// =============================================================================
// DEVICE MANAGEMENT SCHEMAS
// =============================================================================

export const updateDeviceSchema = z.object({
  name: z.string().min(1).max(50),
});

export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
```

**Step 2: Commit**

```bash
git add src/lib/validations/device.ts
git commit -m "feat(validation): add device pairing and management schemas"
```

---

## Task 5: Device Service Layer

**Files:**

- Create: `src/server/services/device-service.ts`

**Step 1: Create device service**

Create `src/server/services/device-service.ts`:

```typescript
import { db } from "@/server/db";
import {
  devicePairingCodes,
  users,
  familyMembers,
  sessions,
} from "@/server/schema";
import { eq, and, gt, isNull, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const CODE_EXPIRY_MINUTES = 5;
const DEVICE_SESSION_EXPIRY_DAYS = 90;

/**
 * Generate a random 6-digit pairing code
 */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create a new pairing code for a device
 */
export async function createPairingCode(
  familyId: string,
  createdById: string,
  deviceName: string
): Promise<{ code: string; expiresAt: Date }> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(devicePairingCodes).values({
    id: createId(),
    familyId,
    code,
    deviceName,
    createdById,
    expiresAt,
  });

  return { code, expiresAt };
}

/**
 * Validate and consume a pairing code
 * Returns the pairing code record if valid, null otherwise
 */
export async function consumePairingCode(code: string) {
  const now = new Date();

  // Find valid, unused, non-expired code
  const [pairingCode] = await db
    .select()
    .from(devicePairingCodes)
    .where(
      and(
        eq(devicePairingCodes.code, code),
        gt(devicePairingCodes.expiresAt, now),
        isNull(devicePairingCodes.usedAt)
      )
    )
    .limit(1);

  if (!pairingCode) {
    return null;
  }

  // Mark as used
  await db
    .update(devicePairingCodes)
    .set({ usedAt: now })
    .where(eq(devicePairingCodes.id, pairingCode.id));

  return pairingCode;
}

/**
 * Create a device user and family membership
 */
export async function createDeviceUser(
  familyId: string,
  deviceName: string
): Promise<{ userId: string; memberId: string }> {
  const userId = createId();
  const memberId = createId();
  const email = `device-${userId}@internal.local`;

  // Create device user
  await db.insert(users).values({
    id: userId,
    name: deviceName,
    email,
    emailVerified: true,
    type: "device",
  });

  // Create family membership
  await db.insert(familyMembers).values({
    id: memberId,
    familyId,
    userId,
    role: "device",
    displayName: deviceName,
  });

  return { userId, memberId };
}

/**
 * Get all devices for a family
 */
export async function getDevicesForFamily(familyId: string) {
  const devices = await db
    .select({
      id: users.id,
      name: users.name,
      displayName: familyMembers.displayName,
      createdAt: users.createdAt,
      memberId: familyMembers.id,
    })
    .from(users)
    .innerJoin(familyMembers, eq(familyMembers.userId, users.id))
    .where(and(eq(familyMembers.familyId, familyId), eq(users.type, "device")));

  // Get last activity for each device
  const devicesWithActivity = await Promise.all(
    devices.map(async (device) => {
      const [lastSession] = await db
        .select({ updatedAt: sessions.updatedAt })
        .from(sessions)
        .where(eq(sessions.userId, device.id))
        .orderBy(sql`${sessions.updatedAt} DESC`)
        .limit(1);

      return {
        ...device,
        lastActiveAt: lastSession?.updatedAt ?? device.createdAt,
      };
    })
  );

  return devicesWithActivity;
}

/**
 * Update device name
 */
export async function updateDeviceName(
  deviceUserId: string,
  newName: string
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ name: newName })
      .where(eq(users.id, deviceUserId));

    await tx
      .update(familyMembers)
      .set({ displayName: newName })
      .where(eq(familyMembers.userId, deviceUserId));
  });
}

/**
 * Delete a device (user, family member, and sessions)
 */
export async function deleteDevice(deviceUserId: string): Promise<void> {
  // Delete user (CASCADE will handle familyMembers and sessions)
  await db.delete(users).where(eq(users.id, deviceUserId));
}

/**
 * Verify a device belongs to a family
 */
export async function verifyDeviceInFamily(
  deviceUserId: string,
  familyId: string
): Promise<boolean> {
  const [member] = await db
    .select()
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.userId, deviceUserId),
        eq(familyMembers.familyId, familyId)
      )
    )
    .limit(1);

  return !!member;
}

/**
 * Clean up expired pairing codes (for cron job)
 */
export async function cleanupExpiredPairingCodes(): Promise<number> {
  const result = await db
    .delete(devicePairingCodes)
    .where(sql`${devicePairingCodes.expiresAt} < NOW()`)
    .returning({ id: devicePairingCodes.id });

  return result.length;
}
```

**Step 2: Commit**

```bash
git add src/server/services/device-service.ts
git commit -m "feat(service): add device management service layer"
```

---

## Task 6: API - Generate Pairing Code Endpoint

**Files:**

- Create: `src/app/api/v1/devices/pair/generate/route.ts`

**Step 1: Create the endpoint**

Create `src/app/api/v1/devices/pair/generate/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { createPairingCode } from "@/server/services/device-service";
import { generatePairingCodeSchema } from "@/lib/validations/device";

// POST /api/v1/devices/pair/generate
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    // Get user's family membership
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (!member) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    // Only managers can add devices
    if (member.role !== "manager") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can add devices",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = generatePairingCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        },
        { status: 400 }
      );
    }

    const { code, expiresAt } = await createPairingCode(
      member.familyId,
      session.user.id,
      parsed.data.deviceName
    );

    return NextResponse.json({
      success: true,
      data: { code, expiresAt: expiresAt.toISOString() },
    });
  } catch (error) {
    console.error("Error generating pairing code:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to generate code" },
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/devices/pair/generate/route.ts
git commit -m "feat(api): add device pairing code generation endpoint"
```

---

## Task 7: API - Complete Pairing Endpoint

**Files:**

- Create: `src/app/api/v1/devices/pair/complete/route.ts`

**Step 1: Create the endpoint**

Create `src/app/api/v1/devices/pair/complete/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { sessions } from "@/server/schema";
import { createId } from "@paralleldrive/cuid2";
import {
  consumePairingCode,
  createDeviceUser,
} from "@/server/services/device-service";
import { completePairingSchema } from "@/lib/validations/device";

const DEVICE_SESSION_EXPIRY_DAYS = 90;

// POST /api/v1/devices/pair/complete
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = completePairingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid pairing code format",
          },
        },
        { status: 400 }
      );
    }

    // Validate and consume the pairing code
    const pairingCode = await consumePairingCode(parsed.data.code);

    if (!pairingCode) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CODE",
            message: "Invalid or expired pairing code",
          },
        },
        { status: 400 }
      );
    }

    // Create device user and family membership
    const { userId } = await createDeviceUser(
      pairingCode.familyId,
      pairingCode.deviceName
    );

    // Create a long-lived session for the device
    const sessionToken = createId();
    const expiresAt = new Date(
      Date.now() + DEVICE_SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    await db.insert(sessions).values({
      id: createId(),
      userId,
      token: sessionToken,
      expiresAt,
    });

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set("better-auth.session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      data: {
        deviceName: pairingCode.deviceName,
        message: "Device paired successfully",
      },
    });
  } catch (error) {
    console.error("Error completing device pairing:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to complete pairing",
        },
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/devices/pair/complete/route.ts
git commit -m "feat(api): add device pairing completion endpoint"
```

---

## Task 8: API - Device Management Endpoints

**Files:**

- Create: `src/app/api/v1/devices/route.ts`
- Create: `src/app/api/v1/devices/[id]/route.ts`

**Step 1: Create list devices endpoint**

Create `src/app/api/v1/devices/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { getDevicesForFamily } from "@/server/services/device-service";

// GET /api/v1/devices
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    // Devices can't manage other devices
    if ((session.user as { type?: string }).type === "device") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Devices cannot manage devices",
          },
        },
        { status: 403 }
      );
    }

    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (!member) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    // Only managers can view devices
    if (member.role !== "manager") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can view devices",
          },
        },
        { status: 403 }
      );
    }

    const devices = await getDevicesForFamily(member.familyId);

    return NextResponse.json({ success: true, data: { devices } });
  } catch (error) {
    console.error("Error fetching devices:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch devices" },
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Create device update/delete endpoint**

Create `src/app/api/v1/devices/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import {
  updateDeviceName,
  deleteDevice,
  verifyDeviceInFamily,
} from "@/server/services/device-service";
import { updateDeviceSchema } from "@/lib/validations/device";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/v1/devices/:id
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: deviceId } = await context.params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    if ((session.user as { type?: string }).type === "device") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Devices cannot manage devices",
          },
        },
        { status: 403 }
      );
    }

    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (!member || member.role !== "manager") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can update devices",
          },
        },
        { status: 403 }
      );
    }

    // Verify device belongs to this family
    const belongs = await verifyDeviceInFamily(deviceId, member.familyId);
    if (!belongs) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Device not found" },
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateDeviceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        },
        { status: 400 }
      );
    }

    await updateDeviceName(deviceId, parsed.data.name);

    return NextResponse.json({
      success: true,
      data: { message: "Device updated" },
    });
  } catch (error) {
    console.error("Error updating device:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update device" },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/devices/:id
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id: deviceId } = await context.params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    if ((session.user as { type?: string }).type === "device") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Devices cannot manage devices",
          },
        },
        { status: 403 }
      );
    }

    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (!member || member.role !== "manager") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can remove devices",
          },
        },
        { status: 403 }
      );
    }

    const belongs = await verifyDeviceInFamily(deviceId, member.familyId);
    if (!belongs) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Device not found" },
        },
        { status: 404 }
      );
    }

    await deleteDevice(deviceId);

    return NextResponse.json({
      success: true,
      data: { message: "Device removed" },
    });
  } catch (error) {
    console.error("Error deleting device:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to remove device" },
      },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/v1/devices/
git commit -m "feat(api): add device list, update, and delete endpoints"
```

---

## Task 9: i18n - Add Device Translations

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Add English translations**

Add to `messages/en.json` (in alphabetical order with other top-level keys):

```json
"DevicesPage": {
  "title": "Devices",
  "description": "Manage wall-mounted displays and tablets",
  "addDevice": "Add Device",
  "noDevices": "No devices paired yet",
  "noDevicesDescription": "Add a wall-mounted tablet or display to your family hub",
  "pairedOn": "Paired",
  "lastActive": "Last active",
  "active": "Active",
  "inactive": "Inactive",
  "rename": "Rename",
  "remove": "Remove",
  "removeConfirmTitle": "Remove Device",
  "removeConfirmDescription": "Are you sure you want to remove {deviceName}? The device will be disconnected and will need to be re-paired.",
  "addDeviceDialog": {
    "title": "Add Device",
    "description": "Enter a name for this device, then enter the code on the tablet",
    "deviceName": "Device Name",
    "deviceNamePlaceholder": "Kitchen Tablet",
    "generate": "Generate Code",
    "code": "Pairing Code",
    "codeExpires": "Code expires in {minutes} minutes",
    "done": "Done"
  },
  "renameDialog": {
    "title": "Rename Device",
    "newName": "New Name",
    "save": "Save"
  }
},
"DevicePairPage": {
  "title": "Pair Device",
  "description": "Enter the 6-digit code shown in your family settings",
  "codePlaceholder": "000000",
  "pair": "Pair Device",
  "pairing": "Pairing...",
  "success": "Device paired successfully!",
  "redirecting": "Redirecting to dashboard...",
  "invalidCode": "Invalid or expired code",
  "error": "Failed to pair device"
},
"DeviceDisconnected": {
  "title": "Device Disconnected",
  "description": "Your session has expired or been revoked. Ask a family manager to re-pair this device.",
  "pairAgain": "Enter Pairing Code"
}
```

**Step 2: Add Dutch translations**

Add to `messages/nl.json`:

```json
"DevicesPage": {
  "title": "Apparaten",
  "description": "Beheer wandschermen en tablets",
  "addDevice": "Apparaat toevoegen",
  "noDevices": "Nog geen apparaten gekoppeld",
  "noDevicesDescription": "Voeg een wandtablet of scherm toe aan je gezinshub",
  "pairedOn": "Gekoppeld",
  "lastActive": "Laatst actief",
  "active": "Actief",
  "inactive": "Inactief",
  "rename": "Hernoemen",
  "remove": "Verwijderen",
  "removeConfirmTitle": "Apparaat verwijderen",
  "removeConfirmDescription": "Weet je zeker dat je {deviceName} wilt verwijderen? Het apparaat wordt losgekoppeld en moet opnieuw worden gekoppeld.",
  "addDeviceDialog": {
    "title": "Apparaat toevoegen",
    "description": "Voer een naam in voor dit apparaat en voer de code in op de tablet",
    "deviceName": "Apparaatnaam",
    "deviceNamePlaceholder": "Keukentablet",
    "generate": "Code genereren",
    "code": "Koppelingscode",
    "codeExpires": "Code verloopt over {minutes} minuten",
    "done": "Klaar"
  },
  "renameDialog": {
    "title": "Apparaat hernoemen",
    "newName": "Nieuwe naam",
    "save": "Opslaan"
  }
},
"DevicePairPage": {
  "title": "Apparaat koppelen",
  "description": "Voer de 6-cijferige code in die in je gezinsinstellingen wordt getoond",
  "codePlaceholder": "000000",
  "pair": "Apparaat koppelen",
  "pairing": "Koppelen...",
  "success": "Apparaat succesvol gekoppeld!",
  "redirecting": "Doorsturen naar dashboard...",
  "invalidCode": "Ongeldige of verlopen code",
  "error": "Koppelen mislukt"
},
"DeviceDisconnected": {
  "title": "Apparaat losgekoppeld",
  "description": "Je sessie is verlopen of ingetrokken. Vraag een gezinsbeheerder om dit apparaat opnieuw te koppelen.",
  "pairAgain": "Koppelingscode invoeren"
}
```

**Step 3: Commit**

```bash
git add messages/en.json messages/nl.json
git commit -m "feat(i18n): add device management translations"
```

---

## Task 10: UI - Device Pairing Page

**Files:**

- Create: `src/app/[locale]/device/pair/page.tsx`
- Create: `src/components/device/device-pair-form.tsx`

**Step 1: Create pairing page**

Create `src/app/[locale]/device/pair/page.tsx`:

```typescript
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { DevicePairForm } from "@/components/device/device-pair-form";

interface DevicePairPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DevicePairPage({ params }: DevicePairPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <DevicePairForm locale={locale} />
    </div>
  );
}
```

**Step 2: Create pairing form component**

Create `src/components/device/device-pair-form.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DevicePairFormProps {
  locale: string;
}

export function DevicePairForm({ locale }: DevicePairFormProps) {
  const t = useTranslations("DevicePairPage");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/devices/pair/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(
          data.error?.code === "INVALID_CODE"
            ? t("invalidCode")
            : t("error")
        );
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/${locale}/dashboard`);
      }, 2000);
    } catch {
      setError(t("error"));
      setIsLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);
    setError(null);
  };

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <div className="text-primary mb-4 text-4xl">✓</div>
          <h2 className="mb-2 text-xl font-semibold">{t("success")}</h2>
          <p className="text-muted-foreground">{t("redirecting")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
          <Tablet className="text-primary size-8" />
        </div>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={handleCodeChange}
            placeholder={t("codePlaceholder")}
            className="text-center text-2xl tracking-widest"
            disabled={isLoading}
            autoFocus
          />

          {error && (
            <p className="text-destructive text-center text-sm">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={code.length !== 6 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("pairing")}
              </>
            ) : (
              t("pair")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/[locale]/device/ src/components/device/
git commit -m "feat(ui): add device pairing page and form"
```

---

## Task 11: UI - Device Management in Settings

**Files:**

- Create: `src/components/settings/devices-section.tsx`
- Modify: `src/components/settings/settings-page-client.tsx`

**Step 1: Create devices section component**

Create `src/components/settings/devices-section.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { nl, enUS } from "date-fns/locale";
import {
  Tablet,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Device {
  id: string;
  name: string;
  displayName: string;
  createdAt: string;
  lastActiveAt: string;
}

interface DevicesSectionProps {
  locale: string;
}

export function DevicesSection({ locale }: DevicesSectionProps) {
  const t = useTranslations("DevicesPage");
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const dateLocale = locale === "nl" ? nl : enUS;

  const fetchDevices = async () => {
    try {
      const response = await fetch("/api/v1/devices");
      const data = await response.json();
      if (data.success) {
        setDevices(data.data.devices);
      }
    } catch (error) {
      console.error("Failed to fetch devices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleGenerateCode = async () => {
    if (!newDeviceName.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch("/api/v1/devices/pair/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceName: newDeviceName.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        setPairingCode(data.data.code);
      } else {
        toast.error("Failed to generate code");
      }
    } catch {
      toast.error("Failed to generate code");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!pairingCode) return;
    await navigator.clipboard.writeText(pairingCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleRename = async () => {
    if (!selectedDevice || !newDeviceName.trim()) return;

    try {
      const response = await fetch(`/api/v1/devices/${selectedDevice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeviceName.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Device renamed");
        fetchDevices();
      } else {
        toast.error("Failed to rename device");
      }
    } catch {
      toast.error("Failed to rename device");
    } finally {
      setShowRenameDialog(false);
      setSelectedDevice(null);
      setNewDeviceName("");
    }
  };

  const handleRemove = async () => {
    if (!selectedDevice) return;

    try {
      const response = await fetch(`/api/v1/devices/${selectedDevice.id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Device removed");
        fetchDevices();
      } else {
        toast.error("Failed to remove device");
      }
    } catch {
      toast.error("Failed to remove device");
    } finally {
      setShowRemoveDialog(false);
      setSelectedDevice(null);
    }
  };

  const closeAddDialog = () => {
    setShowAddDialog(false);
    setNewDeviceName("");
    setPairingCode(null);
    fetchDevices(); // Refresh in case device was paired
  };

  const isActive = (lastActiveAt: string) => {
    const lastActive = new Date(lastActiveAt);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return lastActive > hourAgo;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Button onClick={() => setShowAddDialog(true)} size="sm">
            <Plus className="mr-2 size-4" />
            {t("addDevice")}
          </Button>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="py-8 text-center">
              <Tablet className="text-muted-foreground mx-auto mb-4 size-12" />
              <p className="font-medium">{t("noDevices")}</p>
              <p className="text-muted-foreground text-sm">
                {t("noDevicesDescription")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                      <Tablet className="size-5" />
                    </div>
                    <div>
                      <p className="font-medium">{device.displayName}</p>
                      <p className="text-muted-foreground text-sm">
                        {t("pairedOn")}{" "}
                        {new Date(device.createdAt).toLocaleDateString(locale)}{" "}
                        • {t("lastActive")}{" "}
                        {formatDistanceToNow(new Date(device.lastActiveAt), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1 text-sm ${
                        isActive(device.lastActiveAt)
                          ? "text-green-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${
                          isActive(device.lastActiveAt)
                            ? "bg-green-600"
                            : "bg-muted-foreground"
                        }`}
                      />
                      {isActive(device.lastActiveAt)
                        ? t("active")
                        : t("inactive")}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedDevice(device);
                            setNewDeviceName(device.displayName);
                            setShowRenameDialog(true);
                          }}
                        >
                          <Pencil className="mr-2 size-4" />
                          {t("rename")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedDevice(device);
                            setShowRemoveDialog(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" />
                          {t("remove")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Device Dialog */}
      <Dialog open={showAddDialog} onOpenChange={closeAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addDeviceDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("addDeviceDialog.description")}
            </DialogDescription>
          </DialogHeader>

          {!pairingCode ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("addDeviceDialog.deviceName")}</Label>
                <Input
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder={t("addDeviceDialog.deviceNamePlaceholder")}
                />
              </div>
              <Button
                onClick={handleGenerateCode}
                disabled={!newDeviceName.trim() || isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {t("addDeviceDialog.generate")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div>
                <Label>{t("addDeviceDialog.code")}</Label>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="font-mono text-4xl tracking-widest">
                    {pairingCode}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyCode}
                  >
                    {codeCopied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                {t("addDeviceDialog.codeExpires", { minutes: 5 })}
              </p>
              <Button onClick={closeAddDialog} className="w-full">
                {t("addDeviceDialog.done")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("renameDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("renameDialog.newName")}</Label>
              <Input
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleRename}
              disabled={!newDeviceName.trim()}
            >
              {t("renameDialog.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeConfirmDescription", {
                deviceName: selectedDevice?.displayName,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

**Step 2: Update settings page to include devices tab**

Modify `src/components/settings/settings-page-client.tsx`:

```typescript
"use client";

import { useTranslations } from "next-intl";
import { Users, Link2, Tablet } from "lucide-react";
import type { Family } from "@/server/schema";
import type { FamilyMemberWithUser, FamilyMemberRole } from "@/types/family";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FamilySettingsClient } from "@/components/family/family-settings-client";
import { LinkedAccountsSection } from "@/components/settings/linked-accounts-section";
import { DevicesSection } from "@/components/settings/devices-section";

interface SettingsPageClientProps {
  family: Family & { currentUserRole: FamilyMemberRole };
  members: FamilyMemberWithUser[];
  currentUserId: string;
  isManager: boolean;
  locale: string;
}

export function SettingsPageClient({
  family,
  members,
  currentUserId,
  isManager,
  locale,
}: SettingsPageClientProps) {
  const t = useTranslations("SettingsPage");

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>

        <Tabs defaultValue="family" className="w-full">
          <TabsList className={`grid w-full ${isManager ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="family" className="gap-2">
              <Users className="size-4" />
              {t("tabs.family")}
            </TabsTrigger>
            <TabsTrigger value="accounts" className="gap-2">
              <Link2 className="size-4" />
              {t("tabs.accounts")}
            </TabsTrigger>
            {isManager && (
              <TabsTrigger value="devices" className="gap-2">
                <Tablet className="size-4" />
                {t("tabs.devices")}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="family" className="mt-6">
            <FamilySettingsClient
              family={family}
              members={members}
              currentUserId={currentUserId}
              isManager={isManager}
              locale={locale}
            />
          </TabsContent>

          <TabsContent value="accounts" className="mt-6">
            <div className="rounded-lg border p-6">
              <h2 className="mb-2 text-lg font-semibold">
                {t("accounts.title")}
              </h2>
              <p className="text-muted-foreground mb-4 text-sm">
                {t("accounts.description")}
              </p>
              <LinkedAccountsSection familyId={family.id} />
            </div>
          </TabsContent>

          {isManager && (
            <TabsContent value="devices" className="mt-6">
              <DevicesSection locale={locale} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
```

**Step 3: Add "devices" to SettingsPage translations**

Add to both `messages/en.json` and `messages/nl.json` under `SettingsPage.tabs`:

English:

```json
"tabs": {
  "family": "Family",
  "accounts": "Accounts",
  "devices": "Devices"
}
```

Dutch:

```json
"tabs": {
  "family": "Gezin",
  "accounts": "Accounts",
  "devices": "Apparaten"
}
```

**Step 4: Commit**

```bash
git add src/components/settings/ messages/
git commit -m "feat(ui): add devices management section to settings"
```

---

## Task 12: UI - Device Session Hook

**Files:**

- Modify: `src/lib/auth-client.ts` (export session type)
- Create: `src/hooks/use-device-session.ts`

**Step 1: Create device session hook**

Create `src/hooks/use-device-session.ts`:

```typescript
"use client";

import { useSession } from "@/lib/auth-client";

interface DeviceSessionData {
  isDevice: boolean;
  deviceName: string | null;
  memberRole: string | null;
  familyId: string | null;
  canEdit: boolean;
  isManager: boolean;
}

/**
 * Hook to access device-aware session data
 * Returns loading state and session info including device status
 */
export function useDeviceSession(): {
  data: DeviceSessionData | null;
  isPending: boolean;
} {
  const { data: session, isPending } = useSession();

  if (isPending || !session) {
    return { data: null, isPending };
  }

  const sessionData = session.session as {
    isDevice?: boolean;
    deviceName?: string | null;
    memberRole?: string | null;
    familyId?: string | null;
  };

  const isDevice = sessionData.isDevice === true;
  const memberRole = sessionData.memberRole ?? null;

  return {
    data: {
      isDevice,
      deviceName: sessionData.deviceName ?? null,
      memberRole,
      familyId: sessionData.familyId ?? null,
      // Devices cannot edit, only view and interact
      canEdit: !isDevice,
      // Managers are human users with manager role
      isManager: !isDevice && memberRole === "manager",
    },
    isPending,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-device-session.ts
git commit -m "feat(hooks): add useDeviceSession hook for device-aware UI"
```

---

## Task 13: UI - IfNotDevice Wrapper Component

**Files:**

- Create: `src/components/device/if-not-device.tsx`

**Step 1: Create wrapper component**

Create `src/components/device/if-not-device.tsx`:

```typescript
"use client";

import { useDeviceSession } from "@/hooks/use-device-session";

interface IfNotDeviceProps {
  children: React.ReactNode;
  /**
   * Optional: also require manager role
   */
  requireManager?: boolean;
  /**
   * Optional: content to show on devices (instead of nothing)
   */
  fallback?: React.ReactNode;
}

/**
 * Conditionally render children only for non-device sessions.
 * Use this to hide create/edit/delete buttons on device displays.
 *
 * @example
 * <IfNotDevice>
 *   <Button onClick={openCreateModal}>Add Chore</Button>
 * </IfNotDevice>
 *
 * @example
 * <IfNotDevice requireManager>
 *   <Button onClick={openSettings}>Settings</Button>
 * </IfNotDevice>
 */
export function IfNotDevice({
  children,
  requireManager = false,
  fallback = null,
}: IfNotDeviceProps) {
  const { data, isPending } = useDeviceSession();

  // Don't render anything while loading
  if (isPending) {
    return null;
  }

  // No session - don't render (will redirect to login anyway)
  if (!data) {
    return null;
  }

  // If device, show fallback
  if (data.isDevice) {
    return <>{fallback}</>;
  }

  // If requireManager but not manager, show fallback
  if (requireManager && !data.isManager) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

**Step 2: Commit**

```bash
git add src/components/device/if-not-device.tsx
git commit -m "feat(ui): add IfNotDevice wrapper for conditional rendering"
```

---

## Task 14: Device Disconnected Page

**Files:**

- Create: `src/components/device/device-disconnected.tsx`

**Step 1: Create disconnected component**

Create `src/components/device/device-disconnected.tsx`:

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DeviceDisconnectedProps {
  locale: string;
}

export function DeviceDisconnected({ locale }: DeviceDisconnectedProps) {
  const t = useTranslations("DeviceDisconnected");
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="bg-destructive/10 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
            <WifiOff className="text-destructive size-8" />
          </div>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => router.push(`/${locale}/device/pair`)}
            className="w-full"
          >
            {t("pairAgain")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/device/device-disconnected.tsx
git commit -m "feat(ui): add device disconnected screen"
```

---

## Task 15: Verify Build and Tests

**Step 1: Run type check**

Run: `pnpm build`
Expected: Build succeeds without type errors

**Step 2: Run tests**

Run: `pnpm test:run`
Expected: All existing tests pass

**Step 3: Run linting**

Run: `pnpm lint`
Expected: No linting errors

**Step 4: Commit any fixes if needed**

If any fixes were needed:

```bash
git add -A
git commit -m "fix: address build/lint issues"
```

---

## Task 16: Final Integration Test (Manual)

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test pairing flow**

1. Login as a manager
2. Go to Settings → Devices
3. Click "Add Device"
4. Enter device name, generate code
5. Open incognito window
6. Navigate to `/en/device/pair`
7. Enter the code
8. Verify redirect to dashboard
9. Verify session is marked as device (no edit buttons visible)

**Step 3: Test device management**

1. Back in manager session, refresh Devices tab
2. Verify new device appears in list
3. Test rename functionality
4. Test remove functionality

**Step 4: Commit success marker**

```bash
git add -A
git commit -m "feat(devices): complete device pairing and management feature"
```

---

## Summary

This plan implements the devices feature in 16 tasks:

1. Schema: Add user type field
2. Schema: Add device pairing codes table
3. Auth: Extend custom session plugin
4. Validation schemas for devices
5. Device service layer
6. API: Generate pairing code
7. API: Complete pairing
8. API: Device management (list/update/delete)
9. i18n: Add translations
10. UI: Device pairing page
11. UI: Device management in settings
12. UI: Device session hook
13. UI: IfNotDevice wrapper
14. UI: Device disconnected screen
15. Verify build and tests
16. Final integration test
