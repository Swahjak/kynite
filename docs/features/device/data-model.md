# Device Data Model

## Device Pairing Code Entity

```typescript
interface IDevicePairingCode {
  id: string;
  familyId: string; // Reference to target family
  code: string; // 6-digit numeric code
  deviceName: string; // User-provided name for the device
  createdById: string; // Manager who initiated pairing
  expiresAt: Date; // 5 minutes from creation
  usedAt: Date | null; // Set when code is consumed
  attempts: number; // Failed attempt counter (max 5)
  createdAt: Date;
}
```

## Device User Entity

Device users are stored in the `users` table with a special type:

```typescript
interface IDeviceUser {
  id: string;
  name: string; // Device name
  email: string; // Format: device-{cuid}@internal.local
  emailVerified: boolean; // Always true for devices
  type: "device"; // Distinguishes from human users
  createdAt: Date;
  updatedAt: Date;
}
```

## Device Family Membership

Devices have family membership with a restricted role:

```typescript
interface IDeviceMember {
  id: string;
  familyId: string;
  userId: string; // References device user
  role: "device"; // Restricted role (not manager/member)
  displayName: string; // Device name
}
```

## Database Schema

### Device Pairing Codes Table

```sql
CREATE TABLE device_pairing_codes (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  created_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Users Table (Device Type)

```sql
-- Devices are stored in the users table with type='device'
INSERT INTO users (id, name, email, email_verified, type)
VALUES (
  'cuid_device_id',
  'Living Room Display',
  'device-cuid_device_id@internal.local',
  true,
  'device'
);
```

### Family Members Table (Device Role)

```sql
-- Device family membership uses role='device'
INSERT INTO family_members (id, family_id, user_id, role, display_name)
VALUES (
  'cuid_member_id',
  'family_id',
  'cuid_device_id',
  'device',
  'Living Room Display'
);
```

## Constants

| Constant                     | Value         | Description                    |
| ---------------------------- | ------------- | ------------------------------ |
| `CODE_EXPIRY_MINUTES`        | 5             | Pairing code valid for         |
| `DEVICE_SESSION_EXPIRY_DAYS` | 90            | Device session duration        |
| `MAX_PAIRING_ATTEMPTS`       | 5             | Failed attempts before lockout |
| Code range                   | 100000-999999 | 6-digit code range             |

## API Endpoints

### Device Pairing

| Endpoint                         | Method | Auth Required | Description                   |
| -------------------------------- | ------ | ------------- | ----------------------------- |
| `/api/v1/devices/pair/generate`  | POST   | Manager       | Generate 6-digit pairing code |
| `/api/auth/device/pair/complete` | POST   | None          | Complete pairing with code    |

### Device Management

| Endpoint              | Method | Auth Required | Description                    |
| --------------------- | ------ | ------------- | ------------------------------ |
| `/api/v1/devices`     | GET    | Manager       | List all devices for family    |
| `/api/v1/devices/:id` | PATCH  | Manager       | Update device name             |
| `/api/v1/devices/:id` | DELETE | Manager       | Remove device (cascade delete) |

## Request/Response Examples

### Generate Pairing Code

```typescript
// POST /api/v1/devices/pair/generate
// Request
{ "deviceName": "Kitchen Display" }

// Response
{
  "success": true,
  "data": {
    "code": "847293",
    "expiresAt": "2024-01-15T10:05:00.000Z"
  }
}
```

### Complete Pairing

```typescript
// POST /api/auth/device/pair/complete
// Request
{ "code": "847293" }

// Response
{
  "deviceName": "Kitchen Display",
  "message": "Device paired successfully"
}
// Also sets session cookies (session_token, session_data)
```

### List Devices

```typescript
// GET /api/v1/devices
// Response
{
  "success": true,
  "data": {
    "devices": [
      {
        "id": "cuid_device_1",
        "name": "Kitchen Display",
        "displayName": "Kitchen Display",
        "createdAt": "2024-01-15T10:00:00.000Z",
        "memberId": "cuid_member_1",
        "lastActiveAt": "2024-01-15T14:30:00.000Z"
      }
    ]
  }
}
```

## Validation Schemas

```typescript
// Generate pairing code
const generatePairingCodeSchema = z.object({
  deviceName: z.string().min(1).max(50),
});

// Complete pairing
const completePairingSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});

// Update device
const updateDeviceSchema = z.object({
  name: z.string().min(1).max(50),
});
```

## Data Sources

| Data          | Source     | Refresh Rate              |
| ------------- | ---------- | ------------------------- |
| Pairing codes | PostgreSQL | On demand (expires 5 min) |
| Device list   | PostgreSQL | On mount, after changes   |
| Last activity | Sessions   | On device API calls       |
