# Device/Wall-Hub Feature Specification

## Overview

The Device/Wall-Hub feature enables dedicated displays (tablets, wall-mounted screens) to be paired with a family account for hands-free viewing of schedules and task completion. This creates a central "command center" for family organization without requiring individual logins.

## Documents

| Document                      | Description                                            |
| ----------------------------- | ------------------------------------------------------ |
| [Data Model](./data-model.md) | Device entities, pairing codes, database schema        |
| [UI Specification](./ui.md)   | Wall-hub components, views, touch-optimized interfaces |

## Key Constraints

- **No authentication required on device**: Devices authenticate once via pairing code
- **Long-lived sessions**: Device sessions last 90 days (vs standard session expiry)
- **Read-mostly interface**: Devices can view schedules and complete tasks, but cannot manage family settings
- **Manager-only device management**: Only family managers can add, rename, or remove devices

## Key Features

### Device Pairing

- 6-digit numeric pairing codes
- 5-minute code expiration
- Max 5 pairing attempts per code
- Automatic device user creation upon successful pairing

### Wall-Hub Display

- **Today View**: Person-column layout showing today's events and chores per family member
- **Week View**: Day-column layout with 7-day calendar grid
- **Full Calendar**: Access to complete calendar view (hidden on mobile)
- Person filtering with avatar chips
- Real-time "NOW" badge for current events
- Touch-optimized task completion with confetti celebration

### Device User Type

- Special user type: `device` (vs `human`)
- Family membership role: `device`
- Email format: `device-{cuid}@internal.local`
- Cannot manage other devices or family settings

## Pairing Flow

```
Manager initiates          Device enters            System validates
    pairing                   code                   & pairs
       |                        |                        |
       v                        v                        v
+-------------+          +-------------+          +-------------+
| POST        |          | POST        |          | - Validate  |
| /api/v1/    |  ----->  | /api/auth/  |  ----->  | - Create    |
| devices/    |  6-digit | device/pair/|          |   device    |
| pair/       |   code   | complete    |          |   user      |
| generate    |          |             |          | - Set 90-day|
+-------------+          +-------------+          |   session   |
       |                        |                 +-------------+
       v                        v                        |
  Display code             Success!                      v
  to manager           Redirect to                  Device can
                        dashboard                   access family
```

## Security Considerations

- Pairing codes are cryptographically random (100,000 - 999,999 range)
- Codes expire after 5 minutes
- Failed attempts are tracked (max 5 per code)
- Devices cannot manage devices (API checks `user.type`)
- Device users have restricted role (`device` vs `manager`/`member`)
- Cascade delete: Removing device deletes user, membership, and sessions
