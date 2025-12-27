# Google Calendar API Reference

Technical reference for integrating with Google Calendar API v3 and internal Family Planner sync endpoints.

## Internal API Endpoints

### Webhook Endpoint

**POST `/api/webhooks/google-calendar`**

Receives push notifications from Google Calendar when events change.

**Headers from Google:**

| Header                  | Description                            |
| ----------------------- | -------------------------------------- |
| `X-Goog-Channel-ID`     | Our channel UUID (from watch response) |
| `X-Goog-Channel-Token`  | Our verification token                 |
| `X-Goog-Resource-State` | `sync`, `exists`, or `not_exists`      |
| `X-Goog-Resource-ID`    | Google's resource identifier           |
| `X-Goog-Message-Number` | Incrementing notification counter      |

**Behavior:**

- `sync`: Initial confirmation message - channel is active
- `exists`: Events changed - triggers incremental sync in background
- `not_exists`: Resource deleted - logs warning

**Response:** Always returns 200 status to acknowledge receipt.

### Cron Endpoints

All cron endpoints require `Authorization: Bearer {CRON_SECRET}` header.

**GET `/api/cron/sync-calendars`**

Fallback polling sync for calendars. Runs every 5-15 minutes.

- Syncs calendars with `lastSyncedAt` older than 5 minutes
- Resumes incomplete syncs (calendars with `paginationToken`)
- Supports pagination limits to avoid timeout (2 pages max per run)

**Response:**

```json
{
  "success": true,
  "data": {
    "total": 5,
    "successful": 4,
    "incomplete": 1,
    "failed": 0
  }
}
```

**GET `/api/cron/setup-channels`**

Sets up push notification channels for calendars without one. Runs daily.

**Response:**

```json
{
  "success": true,
  "data": { "created": 2, "failed": 0 }
}
```

**GET `/api/cron/renew-channels`**

Renews expiring push notification channels. Runs hourly.

- Renews channels expiring within 1 hour
- Creates new channel and stops old one

**Response:**

```json
{
  "success": true,
  "data": { "renewed": 3, "failed": 0 }
}
```

---

## Google Calendar API

### API Base URL

```
https://www.googleapis.com/calendar/v3
```

## Authentication

### OAuth 2.0 Flow

Google Calendar API uses OAuth 2.0 for authentication. The flow:

1. Redirect user to Google's authorization endpoint
2. User grants permissions
3. Google returns authorization code
4. Exchange code for access token + refresh token
5. Use access token for API calls
6. Refresh token when access token expires (typically 1 hour)

### Required Scopes

For 2-way calendar sync, use these scopes:

| Scope                   | URI                                                              | Use Case                              |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| **Events (read/write)** | `https://www.googleapis.com/auth/calendar.events`                | View and edit events on all calendars |
| **Calendar List**       | `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | List user's subscribed calendars      |

**Minimal scope set for MVP:**

```typescript
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];
```

### All Available Scopes

| Scope                            | Description                          | Sensitivity   |
| -------------------------------- | ------------------------------------ | ------------- |
| `calendar`                       | Full access to all calendars         | Sensitive     |
| `calendar.readonly`              | Read-only access to all calendars    | Sensitive     |
| `calendar.events`                | Read/write events on all calendars   | Sensitive     |
| `calendar.events.readonly`       | Read-only events                     | Sensitive     |
| `calendar.events.owned`          | Read/write events on owned calendars | Recommended   |
| `calendar.events.owned.readonly` | Read-only events on owned calendars  | Non-sensitive |
| `calendar.calendarlist`          | Manage calendar subscriptions        | Sensitive     |
| `calendar.calendarlist.readonly` | View calendar list                   | Non-sensitive |
| `calendar.settings.readonly`     | View calendar settings               | Non-sensitive |
| `calendar.freebusy`              | View availability only               | Non-sensitive |

### Token Management

```typescript
interface TokenResponse {
  access_token: string; // Short-lived (1 hour)
  refresh_token: string; // Long-lived, store securely
  expires_in: number; // Seconds until expiration
  token_type: "Bearer";
  scope: string; // Space-separated granted scopes
}
```

**Refresh token expiration triggers:**

- User revokes access
- Unused for 6 months
- User changes password (if using Google Workspace)
- Token limit exceeded (100 per user per client)

---

## Core Endpoints

### Calendar List

**List user's calendars:**

```http
GET /users/me/calendarList
Authorization: Bearer {access_token}
```

Response includes `accessRole` for each calendar:

- `owner` - Full control
- `writer` - Can edit events
- `reader` - Read-only access
- `freeBusyReader` - Can only see free/busy

### Events

| Method        | Endpoint                                                 | Description                   |
| ------------- | -------------------------------------------------------- | ----------------------------- |
| **List**      | `GET /calendars/{calendarId}/events`                     | Fetch events from a calendar  |
| **Get**       | `GET /calendars/{calendarId}/events/{eventId}`           | Get single event              |
| **Insert**    | `POST /calendars/{calendarId}/events`                    | Create new event              |
| **Update**    | `PUT /calendars/{calendarId}/events/{eventId}`           | Replace entire event          |
| **Patch**     | `PATCH /calendars/{calendarId}/events/{eventId}`         | Partial update                |
| **Delete**    | `DELETE /calendars/{calendarId}/events/{eventId}`        | Remove event                  |
| **Instances** | `GET /calendars/{calendarId}/events/{eventId}/instances` | Get recurring event instances |

**Common calendarId values:**

- `primary` - User's primary calendar
- Email address - Specific calendar by email
- Calendar ID - Unique identifier from calendarList

---

## Incremental Synchronization

### Overview

Two-stage sync process:

1. **Initial full sync** - Fetch all events, receive `nextSyncToken`
2. **Incremental sync** - Use `syncToken` to get only changes

### Initial Sync Request

```http
GET /calendars/{calendarId}/events
  ?timeMin=2024-09-22T00:00:00Z    # 3 months ago
  &timeMax=2025-12-22T00:00:00Z    # 1 year ahead
  &singleEvents=true               # Expand recurring events
  &maxResults=250
Authorization: Bearer {access_token}
```

### Initial Sync Response

```json
{
  "kind": "calendar#events",
  "items": [...],
  "nextPageToken": "token_for_next_page",  // If paginated
  "nextSyncToken": "CPDAlvWDx70CEPDAlvWDx70CGAU="  // Only on last page
}
```

### Incremental Sync Request

```http
GET /calendars/{calendarId}/events
  ?syncToken=CPDAlvWDx70CEPDAlvWDx70CGAU=
Authorization: Bearer {access_token}
```

### Handling Pagination

When many changes occur, incremental sync may return `nextPageToken` instead of `nextSyncToken`:

```typescript
async function incrementalSync(calendarId: string, syncToken: string) {
  let pageToken: string | undefined;
  let newSyncToken: string | undefined;
  const allChanges: CalendarEvent[] = [];

  do {
    const params = new URLSearchParams({
      syncToken,
      ...(pageToken && { pageToken }),
    });

    const response = await fetch(
      `${BASE_URL}/calendars/${calendarId}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = await response.json();
    allChanges.push(...data.items);

    pageToken = data.nextPageToken;
    newSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { changes: allChanges, syncToken: newSyncToken };
}
```

### Sync Token Expiration (410 Gone)

When token expires or ACLs change:

```typescript
if (response.status === 410) {
  // Token invalid - perform full sync
  await clearLocalStorage(calendarId);
  return performFullSync(calendarId);
}
```

### Deleted Events

Incremental sync includes deleted events with `status: 'cancelled'`:

```json
{
  "id": "event_123",
  "status": "cancelled"
}
```

---

## Push Notifications (Webhooks)

### Why Use Push Notifications

Polling every 5 minutes consumes quota. Push notifications:

- Reduce API calls by ~99%
- Provide near-real-time updates
- Scale better with many users

### Setting Up a Watch Channel

```http
POST /calendars/{calendarId}/events/watch
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "id": "unique-channel-id-uuid",
  "type": "web_hook",
  "address": "https://your-app.com/api/webhooks/google-calendar",
  "token": "optional-verification-token",
  "expiration": 1735689600000
}
```

### Watch Response

```json
{
  "kind": "api#channel",
  "id": "unique-channel-id-uuid",
  "resourceId": "resource-id-from-google",
  "resourceUri": "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  "expiration": "1735689600000"
}
```

### Webhook Notification Headers

Google sends POST requests to your webhook URL with these headers:

| Header                      | Description                       |
| --------------------------- | --------------------------------- |
| `X-Goog-Channel-ID`         | Your channel ID                   |
| `X-Goog-Resource-ID`        | Google's resource identifier      |
| `X-Goog-Resource-State`     | `sync`, `exists`, or `not_exists` |
| `X-Goog-Message-Number`     | Incrementing message counter      |
| `X-Goog-Channel-Token`      | Your verification token (if set)  |
| `X-Goog-Channel-Expiration` | Human-readable expiration         |

**Important:** The request body is empty. You must call the API to get actual changes.

### Handling Webhook Notifications

```typescript
async function handleWebhook(headers: Headers) {
  const resourceState = headers.get("X-Goog-Resource-State");
  const channelId = headers.get("X-Goog-Channel-ID");

  if (resourceState === "sync") {
    // Initial sync message - channel is now active
    return { status: 200 };
  }

  if (resourceState === "exists") {
    // Resource changed - fetch updates
    const channel = await getChannelById(channelId);
    await performIncrementalSync(channel.calendarId, channel.syncToken);
  }

  return { status: 200 };
}
```

### Channel Expiration & Renewal

Channels expire after ~1 week. Implement renewal:

```typescript
async function renewChannelIfNeeded(channel: WatchChannel) {
  const expiresAt = new Date(parseInt(channel.expiration));
  const renewThreshold = 24 * 60 * 60 * 1000; // 24 hours before

  if (Date.now() > expiresAt.getTime() - renewThreshold) {
    // Stop old channel
    await stopChannel(channel.id, channel.resourceId);
    // Create new channel
    return createWatchChannel(channel.calendarId);
  }
}
```

### Stopping a Channel

```http
POST /channels/stop
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "id": "unique-channel-id-uuid",
  "resourceId": "resource-id-from-google"
}
```

### Webhook Requirements

- **HTTPS required** with valid SSL certificate
- No self-signed certificates
- Must respond with 200 status within 10 seconds
- Domain must be verified in Google Cloud Console

---

## Rate Limits & Quotas

### Quota Structure

| Quota Type           | Limit                | Window               |
| -------------------- | -------------------- | -------------------- |
| Per project          | Varies by quota tier | Per minute (sliding) |
| Per user per project | Default varies       | Per minute (sliding) |
| Daily total          | 1,000,000 queries    | 24 hours             |

### Rate Limit Responses

```typescript
// 403 or 429 with error
{
  "error": {
    "code": 403,
    "message": "Rate Limit Exceeded",
    "errors": [{
      "domain": "usageLimits",
      "reason": "rateLimitExceeded"
    }]
  }
}
```

### Exponential Backoff Implementation

```typescript
async function fetchWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 5
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt === maxRetries - 1) {
        throw error;
      }

      const delay = Math.min(
        1000 * Math.pow(2, attempt) + Math.random() * 1000,
        32000
      );
      await sleep(delay);
    }
  }
  throw new Error("Max retries exceeded");
}

function isRetryable(error: ApiError): boolean {
  return [403, 429, 500, 503].includes(error.status);
}
```

### Service Account Quota Attribution

When using service accounts with domain-wide delegation:

```http
GET /calendars/primary/events?quotaUser=user@example.com
```

Or via header:

```http
X-Goog-Quota-User: user@example.com
```

---

## Error Handling

### Error Response Format

```typescript
interface GoogleApiError {
  error: {
    code: number; // HTTP status code
    message: string; // Human-readable message
    errors: Array<{
      domain: string; // Error domain (e.g., 'global', 'usageLimits')
      reason: string; // Specific error reason
      message: string; // Detailed message
    }>;
  };
}
```

### Error Handling Matrix

| Status  | Reason              | Action                               |
| ------- | ------------------- | ------------------------------------ |
| **400** | `badRequest`        | Fix request parameters, do not retry |
| **401** | `authError`         | Refresh access token                 |
| **403** | `rateLimitExceeded` | Exponential backoff                  |
| **403** | `forbidden`         | Check calendar permissions           |
| **404** | `notFound`          | Resource doesn't exist or no access  |
| **409** | `conflict`          | Re-fetch and retry                   |
| **410** | `fullSyncRequired`  | Clear storage, full sync             |
| **412** | `conditionNotMet`   | Re-fetch, reapply changes            |
| **429** | `rateLimitExceeded` | Exponential backoff                  |
| **500** | `backendError`      | Exponential backoff                  |

### Implementation

```typescript
async function handleApiResponse(response: Response) {
  if (response.ok) {
    return response.json();
  }

  const error = await response.json();
  const reason = error.error?.errors?.[0]?.reason;

  switch (response.status) {
    case 401:
      await refreshAccessToken();
      throw new RetryableError("Token refreshed");

    case 403:
    case 429:
      if (
        reason === "rateLimitExceeded" ||
        reason === "userRateLimitExceeded"
      ) {
        throw new RateLimitError(error.error.message);
      }
      throw new ForbiddenError(error.error.message);

    case 410:
      if (reason === "fullSyncRequired") {
        throw new FullSyncRequiredError();
      }
      break;

    default:
      throw new ApiError(response.status, error.error.message);
  }
}
```

---

## Best Practices

### 1. Minimize API Calls

- Use incremental sync with `syncToken`
- Use push notifications instead of polling
- Request only needed fields with `fields` parameter

```http
GET /calendars/primary/events?fields=items(id,summary,start,end,status)
```

### 2. Spread Traffic

```typescript
// Bad: Sync all users at midnight
const syncInterval = 5 * 60 * 1000; // 5 minutes

// Good: Add jitter to spread load
const jitter = Math.random() * 0.5; // ±25%
const syncInterval = 5 * 60 * 1000 * (1 + jitter - 0.25);
```

### 3. Handle Recurring Events

For MVP, use `singleEvents=true` to expand recurring events:

```http
GET /calendars/{calendarId}/events
  ?singleEvents=true
  &timeMin=2024-09-22T00:00:00Z
  &timeMax=2025-12-22T00:00:00Z
```

This returns individual instances instead of recurrence rules.

### 4. Timezone Handling

Events return times in the calendar's timezone:

```json
{
  "start": {
    "dateTime": "2024-12-22T10:00:00-05:00",
    "timeZone": "America/New_York"
  }
}
```

All-day events use `date` instead of `dateTime`:

```json
{
  "start": {
    "date": "2024-12-25"
  }
}
```

### 5. Batch Requests

Reduce round trips with batch API:

```http
POST /batch/calendar/v3
Content-Type: multipart/mixed; boundary=batch_boundary

--batch_boundary
Content-Type: application/http

GET /calendar/v3/calendars/primary/events/event1

--batch_boundary
Content-Type: application/http

GET /calendar/v3/calendars/primary/events/event2

--batch_boundary--
```

---

## Event Data Structure

### Event Object

```typescript
interface GoogleCalendarEvent {
  id: string; // Unique event ID
  status: "confirmed" | "tentative" | "cancelled";
  summary: string; // Event title
  description?: string; // Event description
  location?: string; // Event location

  start: {
    dateTime?: string; // ISO 8601 for timed events
    date?: string; // YYYY-MM-DD for all-day events
    timeZone?: string; // IANA timezone
  };

  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };

  created: string; // Creation timestamp
  updated: string; // Last modification timestamp

  organizer: {
    email: string;
    displayName?: string;
    self?: boolean;
  };

  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: "needsAction" | "declined" | "tentative" | "accepted";
  }>;

  recurrence?: string[]; // RRULE strings (not present with singleEvents=true)
  recurringEventId?: string; // Parent event ID for instances

  colorId?: string; // Event color (1-11)

  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: "email" | "popup";
      minutes: number;
    }>;
  };
}
```

---

## Sources

- [Synchronize resources efficiently](https://developers.google.com/workspace/calendar/api/guides/sync) - Google Developers (Updated Dec 2025)
- [Choose Google Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth) - Google Developers (Updated Dec 2025)
- [Handle API errors](https://developers.google.com/workspace/calendar/api/guides/errors) - Google Developers
- [Manage quotas](https://developers.google.com/workspace/calendar/api/guides/quota) - Google Developers
- [Push notifications](https://developers.google.com/workspace/calendar/api/guides/push) - Google Developers (Updated Dec 2025)
- [Events reference](https://developers.google.com/workspace/calendar/api/v3/reference/events) - Google Developers
- [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2) - Google Developers
