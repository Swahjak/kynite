# Legacy Rebuild Parity Checklist

Date: 2026-08-06

This is a flat inventory of every user-facing capability found in the legacy Kynite app (this repo, pre-rebuild). It was compiled by reading the route tree, components, server services, i18n message files, and E2E specs. Each item cites the legacy source file/route that proves the behavior exists.

**Verification note**: This list is a discovery artifact. In the final milestone of the rebuild, every item below must be re-verified one by one against the greenfield app (checked off only once confirmed present and working there) — this file is not itself proof the rebuild is done, only proof of what legacy did.

---

## Auth & Accounts

- [ ] User signs in exclusively via Google OAuth (no email/password) with a branded "Continue with Google" button showing a loading spinner state (`source: src/components/auth/google-sign-in-button.tsx`)
- [ ] Google OAuth requests `email`, `profile`, `calendar.events`, and `calendar.calendarlist.readonly` scopes, offline access type, and forces consent screen to guarantee refresh tokens (`source: src/server/auth.ts`)
- [ ] Login page renders branded card (logo, tagline) with sign-in button and supports `callbackUrl` redirect after login (`source: src/app/(main)/[locale]/login/page.tsx`)
- [ ] Session cookie is httpOnly, 7-day expiry, refreshed every 24h, with a 5-minute cookie cache (`source: src/server/auth.ts`)
- [ ] Session carries custom fields: `familyId`, `memberId`, `memberRole`, `isDevice`, `deviceName`, resolved via a `customSession` plugin querying family membership (`source: src/server/auth.ts`)
- [ ] Account linking is enabled, allowing multiple Google accounts (even with different emails) to link to one user, with OAuth tokens encrypted at rest using the auth secret (`source: src/server/auth.ts`)
- [ ] User can link an additional Google account from settings via "Link Google Account" button using Better-Auth's `linkSocial` (`source: src/components/settings/link-google-account-button.tsx`)
- [ ] User can unlink a linked Google account with a confirmation dialog warning that calendar access will be removed (`source: src/components/settings/linked-google-account-card.tsx`)
- [ ] Linked account card shows email, "Calendar access" badge when calendar scope present, link date, and persisted sync error message if token refresh failed (`source: src/components/settings/linked-google-account-card.tsx`)
- [ ] User menu shows avatar, name/email, settings link, cycling theme toggle (system/light/dark), cycling language toggle (nl/en) with cookie + DB persistence, 24-hour time format switch, and logout (`source: src/components/auth/user-menu.tsx`)
- [ ] Changing language in the user menu updates a DB preference and syncs to a `NEXT_LOCALE` cookie, redirecting to the same page in the new locale (`source: src/components/auth/user-menu.tsx`)
- [ ] Onboarding flow: authenticated user without a family is routed to create a family, then optionally generate/skip an invite link, then a completion screen with a "Go to Calendar" CTA (`source: src/app/(main)/[locale]/(auth)/onboarding/create/page.tsx`)
- [ ] Users with an existing family are redirected away from the create-family page directly to `/calendar` (`source: src/app/(main)/[locale]/(auth)/onboarding/create/page.tsx`)
- [ ] Family invite links (`/join/[token]`) require login first (redirecting to `/login?callbackUrl=...`), then validate the token and show family name with a "Join Family" CTA, handling already-a-member and invalid/expired states (`source: src/components/family/join-family-client.tsx`)
- [ ] Child "upgrade to full account" link (`/link-account?token=...`) validates the token, shows remaining expiry time (hours/minutes), and on confirmation upgrades the child's placeholder account to a full account (handles invalid/expired/already-in-use email states) then redirects to dashboard (`source: src/app/(main)/[locale]/link-account/link-account-client.tsx`)
- [ ] Device pairing page accepts a 6-digit numeric code (auto-strips non-digits, max length 6), shows success/expired-code error states, and redirects to `/dashboard` after successful pairing (`source: src/components/device/device-pair-form.tsx`)
- [ ] Device-disconnected screen shows an offline icon/message and a button to re-pair the device (`source: src/components/device/device-disconnected.tsx`)
- [ ] Unauthenticated users hitting protected routes are redirected to `/login` with a `callbackUrl` param; authenticated users without a family are redirected to `/onboarding`; public routes remain accessible without auth (`source: e2e/tests/auth/redirect.spec.ts`)
- [ ] Session persists across page navigation and page reload without redirecting back to login (`source: e2e/tests/auth/session.spec.ts`)
- [ ] Device pairing codes expire after 5 minutes and are invalidated after 5 failed attempts (`source: src/server/services/device-service.ts`)
- [ ] Device sessions are provisioned with a 90-day expiry window distinct from human sessions (`source: src/server/services/device-service.ts`)

## Family & Profiles

- [ ] Creating a family names the household and automatically assigns the creator the "manager" role (`source: src/server/services/family-service.ts`)
- [ ] Family settings page lets a manager inline-edit and save the family name (`source: src/components/family/family-settings-client.tsx`)
- [ ] Family settings lists all members with avatar, display name, email, role badge; managers can edit any member, edit their own profile, remove other members, and change roles (`source: src/components/family/family-member-card.tsx`)
- [ ] Any member can leave the family via a confirmation dialog, redirecting them to onboarding afterward (`source: src/components/family/family-settings-client.tsx`)
- [ ] Managers can permanently delete the family via a "danger zone" requiring the family name to be typed as confirmation, then redirect to the homepage since the session becomes invalid (`source: src/components/family/family-settings-client.tsx`)
- [ ] Managers can add child profiles (name + avatar color, no login credentials) via a dialog; child accounts are placeholder users with `type: "child"` and role `child` (`source: src/components/family/add-child-dialog.tsx`)
- [ ] Family member roles are: manager, participant, caregiver, device, child — each with a distinct badge style/translation (`source: src/components/family/role-badge.tsx`)
- [ ] Members can be edited with a display name override, an 8-color avatar palette picker, custom SVG avatar upload (max 20KB, validated `.svg` extension + MIME type + content sniffing), and (if permitted) role change via dropdown (`source: src/components/family/member-edit-dialog.tsx`)
- [ ] Family avatars render with priority: custom uploaded SVG > Google profile image > colored initials fallback, with ring styling by avatar color (`source: src/components/family/family-avatar.tsx`)
- [ ] Managers can generate a shareable family invite link (optionally with expiry-in-days and max-uses), copy it to clipboard, and regenerate a new one at will (`source: src/components/family/invite-link-generator.tsx`)
- [ ] Invite acceptance validates expiry and max-use-count, rejects if already a member, and adds the joining user as role "participant" while incrementing the invite's use count (`source: src/server/services/family-service.ts`)
- [ ] Managers can generate a one-time "upgrade link" for a child profile (24-hour expiry) so the child can later link a real Google account to their existing profile/history, shown with expiry timestamp and copy-to-clipboard (`source: src/components/family/upgrade-token-dialog.tsx`)
- [ ] Upgrading a child account validates token expiry/single-use/email-uniqueness, converts the user record to `type: "human"`, and promotes the family member role from "child" to "participant" (`source: src/server/services/child-service.ts`)
- [ ] Onboarding "Invite Family Members" step lets a new manager generate/copy an invite link or skip, then continue to the completion screen (`source: src/components/family/onboarding/invite-members-step.tsx`)
- [ ] Adding a family member via API restricts assignable roles to manager/participant/caregiver and validates the target user exists and isn't already a member (`source: src/app/api/v1/families/[familyId]/members/route.ts`)

## Calendar

- [ ] Calendar supports five views: agenda, day, week, month, year, switchable via animated tab control with icons (`source: src/components/calendar/header/view-tabs.tsx`)
- [ ] Calendar view, badge style (dot vs colored), and agenda "group by" (date vs color) preferences persist to `localStorage` under key `calendar-settings` (`source: src/components/calendar/contexts/calendar-context.tsx`)
- [ ] 24-hour time format preference is persisted server-side per user and toggled from the calendar context (`source: src/components/calendar/contexts/calendar-context.tsx`)
- [ ] Events can be created and edited via a dialog with fields: title, all-day toggle, start/end date-time, category, event type, assigned owner (required), additional participants (multi-select), description, and (new events only) recurrence rules (`source: src/components/calendar/dialogs/add-edit-event-dialog.tsx`)
- [ ] Event categories are sports/work/school/family/social/home, each mapped to a fixed color (green/blue/yellow/purple/pink/orange) and icon (`source: src/components/calendar/types.ts`)
- [ ] Event types are event/birthday/appointment/task/reminder, each with an icon (`source: src/components/calendar/types.ts`)
- [ ] Recurrence supports frequency none/daily/weekly/monthly/yearly, a custom interval (e.g. every N days/weeks/months/years), and end conditions of never/after N occurrences/on a specific date, in a collapsible "Repeat" section (`source: src/components/calendar/fields/recurrence-fields.tsx`)
- [ ] Editing or deleting a recurring event prompts the user to choose scope: "this event" or "all events" in the series (`source: src/components/calendar/dialogs/recurring-event-scope-dialog.tsx`)
- [ ] Recurring event series generate all occurrences up front, capped at a 1-year generation horizon, stored under a shared recurring pattern (`source: src/server/services/event-service.ts`)
- [ ] A weekly cron job extends recurring event occurrence generation as the horizon approaches (`source: src/app/api/cron/extend-recurring-events/route.ts`)
- [ ] Events can be dragged and dropped onto a new date/time; dropping in the same position is a no-op; a "confirm move" toggle in settings controls whether drops require confirmation via dialog or apply instantly (`source: src/components/calendar/contexts/dnd-context.tsx`)
- [ ] Timed events can be resized (top/bottom handles) with a live preview tooltip showing new start/end times, snapped to the day boundaries, with a 15-minute minimum duration (`source: src/components/calendar/dnd/resizable-event.tsx`)
- [ ] Calendar can be filtered by event color/category via a dropdown with a checkmark on active filters and a "clear filter" action (`source: src/components/calendar/header/filter.tsx`)
- [ ] Calendar can be filtered by person (assigned user) via a select dropdown showing an avatar group "All" option plus per-user entries; only visible to managers (`source: src/components/calendar/header/user-select.tsx`)
- [ ] Settings menu (manager-only) toggles dark mode, drag-drop confirmation dialog, dot-vs-colored event badges, and agenda grouping mode (`source: src/components/calendar/settings/settings.tsx`)
- [ ] Month view day cells that overflow visible events show a "+N more" trigger opening a modal listing all events for that day (`source: src/components/calendar/dialogs/events-list-dialog.tsx`)
- [ ] Event details dialog shows participants, start/end date+time, and description, with inline Edit and Delete actions (`source: src/components/calendar/dialogs/event-details-dialog.tsx`)
- [ ] Deleting an event shows an "are you absolutely sure" confirmation with a loading state during deletion (`source: src/components/calendar/dialogs/delete-event-dialog.tsx`)
- [ ] Birthday events surface in a dedicated red "cake" banner strip above day/week views, clickable to open event details (`source: src/components/calendar/views/week-and-day-view/birthday-banner.tsx`)
- [ ] Agenda view groups events by date or by category (toggle), searchable via a command palette input, showing time range or date+time depending on grouping (`source: src/components/calendar/views/agenda-view/agenda-events.tsx`)
- [ ] Date navigator shows current month/year, an event count badge for the active view, previous/next navigation, and a formatted range label (`source: src/components/calendar/header/date-navigator.tsx`)
- [ ] Region setting (US/GB/NL/DE/FR/ES/IT/BE) drives date format, 12h/24h default, and date-fns locale (default region NL) (`source: src/components/calendar/types.ts`)
- [ ] Events created/edited on a private (owner-only) Google calendar are shown as "Hidden" (title/description/location redacted) to family members other than the calendar's own Google account owner (`source: src/server/services/event-service.ts`)
- [ ] Events synced from a read-only (`accessRole: reader`) Google calendar cannot be edited or deleted locally (`source: src/server/services/event-service.ts`)
- [ ] Calendar sync error indicator (warning icon with tooltip) appears in the header when any linked account has a persisted sync error (`source: src/components/calendar/header/calendar-header.tsx`)
- [ ] Events support all-day handling (date-only, no time component) driven by an `allDay` flag that hides time pickers in the event form (`source: src/components/calendar/dialogs/add-edit-event-dialog.tsx`)

## Google Sync

- [ ] Users link Google accounts for calendar access; settings page lists linked accounts and lets managers/owners expand each account to select which of its Google calendars to sync (`source: src/components/sync/calendar-selection-section.tsx`)
- [ ] Adding a Google calendar to sync requires family membership; only the account owner or a family manager may link calendars from that Google account (`source: src/app/api/v1/families/[familyId]/calendars/route.ts`)
- [ ] Linking a calendar automatically creates a Google push-notification watch channel for real-time updates, falling back to polling if channel creation fails (`source: src/server/services/google-channel-service.ts`)
- [ ] Each linked calendar can be toggled sync-enabled/disabled, with read-only calendars (reader/freeBusyReader access role) visually marked with a lock icon and disabled toggle when sync is off (`source: src/components/sync/calendar-toggle.tsx`)
- [ ] Each linked calendar has a "Private" toggle hiding event details from other family members; disabled until sync is enabled, with tooltip explaining the state (`source: src/components/settings/calendar-privacy-toggle.tsx`)
- [ ] Manual "Sync Now" button triggers on-demand sync of all enabled calendars for a linked account (`source: src/components/sync/calendar-selection-section.tsx`)
- [ ] Deleting a synced calendar requires confirmation showing the number of events that will be removed, fetched from an event-count endpoint (`source: src/app/api/v1/families/[familyId]/calendars/[calendarId]/event-count/route.ts`)
- [ ] Sync status badge shows synced/syncing/pending/conflict/error/offline states with icon, color, and tooltip showing last-synced time or error message (`source: src/components/sync/sync-status-badge.tsx`)
- [ ] Initial sync pulls events from 3 months in the past to 12 months in the future, paginating in batches of up to 250 events per page and capping at 2 pages per run to avoid timeouts, persisting a resumable pagination token (`source: src/server/services/google-sync-service.ts`)
- [ ] Incremental sync uses Google's sync token; a 410 Gone response triggers automatic fallback to a full initial resync (`source: src/server/services/google-sync-service.ts`)
- [ ] Status-only Google event types (workingLocation, focusTime, outOfOffice) are filtered out during sync and not imported as calendar events (`source: src/server/services/google-sync-service.ts`)
- [ ] Cancelled Google events are deleted locally during incremental sync; matching is done by Google calendar id + Google event id (`source: src/server/services/google-sync-service.ts`)
- [ ] Google event attendees are matched to family members by email (case-insensitive) and synced as event participants; the calendar's own owner is always included as a participant even if not matched via attendee list (`source: src/server/services/google-sync-service.ts`)
- [ ] Google OAuth access tokens are automatically refreshed (with 5-minute expiry buffer) using the stored encrypted refresh token; failures persist a user-visible "Token refresh failed - please re-link account" error on the account (`source: src/server/services/google-token-service.ts`)
- [ ] Google-provided OAuth tokens are decrypted from Better-Auth's `encryptOAuthTokens` storage, with backward-compatible detection of unencrypted legacy tokens (`source: src/server/services/google-token-service.ts`)
- [ ] Google Calendar push notification channels are created with a 7-day TTL and a signed verification token; a channel per calendar is stopped/recreated as needed and stopped when a calendar is unlinked (`source: src/server/services/google-channel-service.ts`)
- [ ] Webhook endpoint validates channel id/token against stored channel records, then triggers a background incremental sync for the associated calendar on "exists" resource-state notifications; "sync" and "not_exists" states are acknowledged without action (`source: src/app/api/webhooks/google-calendar/route.ts`)
- [ ] Hourly cron job renews any push channels expiring within the next hour, using a Bearer `CRON_SECRET` for auth (`source: src/app/api/cron/renew-channels/route.ts`)
- [ ] Daily cron job creates missing push channels for any sync-enabled calendar lacking one, protected by the same cron secret (`source: src/app/api/cron/setup-channels/route.ts`)
- [ ] Cron job runs incremental sync every 5 minutes for calendars that are enabled and (never synced, mid-incomplete-sync, or stale beyond the interval), protected by the cron secret (`source: src/app/api/cron/sync-calendars/route.ts`)
- [ ] Channel status can be queried/created/stopped per calendar via a manager-only API, returning active state and expiry countdown (`source: src/app/api/v1/families/[familyId]/calendars/[calendarId]/channel/route.ts`)
- [ ] Manual sync-trigger API auto-selects initial vs incremental sync based on whether a sync cursor already exists for the calendar (`source: src/app/api/v1/families/[familyId]/calendars/[calendarId]/sync/route.ts`)

## Chores/Routines

- [ ] View a filtered "All Chores" list and an "Urgent" list via tab toggle showing only overdue/urgent/due-soon chores (`source: src/components/chores/components/filter-tabs.tsx`)
- [ ] Filter chores by family member using person filter chips (with an "Everyone" option) (`source: src/components/chores/chores.tsx`)
- [ ] See a "Today's Progress" bar showing completed/total chores as a percentage (`source: src/components/chores/components/progress-card.tsx`)
- [ ] Complete an assigned chore via a tap/check button, showing a loading spinner then success state, triggering confetti sized to the chore's star reward (`source: src/components/chores/components/chore-card.tsx`)
- [ ] "Take" an unassigned chore by opening a dialog and selecting a family member (device/system members excluded from the picker) (`source: src/components/chores/components/take-chore-dialog.tsx`)
- [ ] Expand a chore card (managers only) to reveal inline Edit / Delete / Take / Done actions (`source: src/components/chores/components/chore-card.tsx`)
- [ ] Create or edit a chore via a dialog form with title, star reward (1-50), assignee (or unassigned), due date, due time (enabled only if due date set), recurrence (once/daily/weekly/weekdays/weekends/monthly), urgent toggle, and description (`source: src/components/chores/dialogs/chore-dialog.tsx`)
- [ ] Delete a chore via a confirmation alert dialog, permanently removing it (`source: src/components/chores/dialogs/delete-chore-dialog.tsx`)
- [ ] Floating action button to add a new chore, visible only to managers (`source: src/components/chores/components/fab.tsx`)
- [ ] Chore urgency badge is computed and shown (overdue/urgent/due-soon) with a formatted due-date/time label (`source: src/components/chores/helpers.ts`)
- [ ] Chores list sorted by urgency/order via a shared sort helper (`source: src/components/chores/helpers.ts`)
- [ ] Server-side create/update/delete of chores, completing and undoing a completion, and computing today's chore progress (completed/total/percentage) for a family (`source: src/server/services/chore-service.ts`)
- [ ] REST endpoints for listing/creating chores, per-chore get/update/delete, complete action, and progress summary (`source: src/app/api/v1/families/[familyId]/chores/route.ts`)
- [ ] On the Wall-Hub Today/Week views, chores assigned to a person or due on a specific day render as tappable checkboxes that fire confetti and mark complete (`source: src/components/wall-hub/shared/task-checkbox.tsx`)
- [ ] Dashboard "Today's Chores" section groups chores into Urgent / Due Soon / Today sections, supports complete and take-chore actions inline (`source: src/components/dashboard/todays-chores/todays-chores.tsx`)

## Rewards/Star Chart

- [ ] Weekly Star Chart grid: each routine task shown as a row with per-day cells (Mon-Sun) that can be tapped to mark complete (star icon) or undo (only for today's cell) (`source: src/components/reward-chart/weekly-grid/weekly-grid.tsx`)
- [ ] Completing a task cell shows optimistic UI update and fires confetti sized to the task's star value; failure reverts and shows a toast (`source: src/components/reward-chart/weekly-grid/task-cell.tsx`)
- [ ] Cell states: completed (star), pending (dashed check), missed (X), not_applicable (dot for non-scheduled days), future (blank) (`source: src/components/reward-chart/weekly-grid/task-cell.tsx`)
- [ ] Managers can drag-and-drop reorder tasks in the weekly grid (`source: src/components/reward-chart/weekly-grid/weekly-grid.tsx`)
- [ ] Managers can add/edit/delete a routine task with title, icon (12 options with legacy Material Symbols fallback mapping), color, star value (1-10), and days-of-week selector (`source: src/components/reward-chart/dialogs/task-dialog.tsx`)
- [ ] Footer shows "Today's Stars" completed/total count and a hint to tap cells (`source: src/components/reward-chart/weekly-grid/grid-footer.tsx`)
- [ ] "Next Reward" card shows the active goal with emoji, title, progress bar/percentage toward star target; managers can edit, mark achieved, or mark cancelled (each with confirm dialog) (`source: src/components/reward-chart/bottom-cards/next-reward-card.tsx`)
- [ ] Set/edit a goal via dialog: title, emoji picker (12 emojis), star target slider (5-100), optional description (`source: src/components/reward-chart/dialogs/goal-dialog.tsx`)
- [ ] Goal progress ring showing current stars vs target as a circular SVG progress indicator plus linear progress bar (`source: src/components/reward-chart/chart-header/goal-progress-ring.tsx`)
- [ ] "Parent Message" card lets managers send an encouragement message to the chart (max 500 chars, live char counter), displayed with relative "time ago" (`source: src/components/reward-chart/dialogs/message-dialog.tsx`)
- [ ] Multi-child households: person filter chips let managers/devices switch which child's chart is shown via `?child=` query param (`source: src/components/reward-chart/reward-chart-page.tsx`)
- [ ] Creating a chart for a child without one (auto-provision on selection or explicit "Create Chart" button) (`source: src/components/reward-chart/empty-chart-state.tsx`)
- [ ] "Select Member" empty state when no child is chosen yet (`source: src/components/reward-chart/select-member-state.tsx`)
- [ ] Star balance card on Reward Store shows current balance and weekly delta (up/down trend arrow) (`source: src/components/reward-store/star-balance-card.tsx`)
- [ ] Reward Store lists rewards in tabs: "Available" (grid of reward cards) and "Redeemed" (redemption history with date and cost) (`source: src/components/reward-store/reward-store-page.tsx`)
- [ ] Reward card shows redeem button state based on affordability (need X more stars) or limit-reached (available again in X time), a "Primary Goal" badge, and a limit-type badge (daily/weekly/monthly/once) (`source: src/components/reward-store/reward-card.tsx`)
- [ ] Managers can create/edit a reward with title, emoji (grid picker), star cost slider (1-500), redemption limit type, and description (`source: src/components/reward-store/dialogs/reward-dialog.tsx`)
- [ ] Managers can delete a reward and can set/unset a reward as a member's "primary goal" (target icon action) (`source: src/components/reward-store/reward-card.tsx`)
- [ ] Redeeming a reward opens a confirmation dialog showing cost, emoji, and resulting balance after redemption (`source: src/components/reward-store/dialogs/redemption-confirm-dialog.tsx`)
- [ ] Server: redemption is blocked and reason returned when reward inactive, insufficient stars, or per-period limit already used (daily/weekly/monthly/once), with next-available time computed (`source: src/server/services/reward-store-service.ts`)
- [ ] Server: star balance and transaction history retrieval, adding/removing stars with typed transactions (chore, reward_chart, bonus, redemption, timer) (`source: src/server/services/star-service.ts`)
- [ ] "Select Member" state for choosing which child's reward store to view when multiple children exist (`source: src/components/reward-store/select-member-for-rewards.tsx`)
- [ ] Dashboard "Weekly Stars" leaderboard ranks family members by weekly star count, showing level/level title per member (`source: src/components/dashboard/weekly-stars/weekly-stars.tsx`)
- [ ] Confetti celebration system: intensity (small/medium/large) scales with stars earned, random animation style each time (cannon, fireworks, stars, side-cannons, burst) (`source: src/components/confetti/confetti-provider.tsx`)
- [ ] REST endpoints for reward charts (CRUD, weekly data, tasks CRUD + reorder, task complete/undo, goals CRUD, messages), rewards (CRUD, redeem), and member stars (history, bonus) and primary-goal (`source: src/app/api/v1/families/[familyId]/reward-charts/[chartId]/route.ts`)

## Hub/Display

- [ ] Wall-Hub header with tab navigation between Today / Week / Full Calendar views (Full Calendar tab hidden on mobile) (`source: src/components/wall-hub/wall-hub-header.tsx`)
- [ ] Today view: per-person columns showing that user's today events (sorted by start time, with a "NOW" badge on the active event) and assigned chores as checkboxes; mobile uses horizontal swipe/snap columns, desktop uses a grid (`source: src/components/wall-hub/today/today-view.tsx`)
- [ ] Week view: 7-day columns (Mon-start week) with navigation (prev/next week, "Today" jump), auto-scroll to today's column on mobile, per-day events and chores due that day, past days shown dimmed (`source: src/components/wall-hub/week/week-view.tsx`)
- [ ] Person filter chips shared across Chores/Reward Chart/Reward Store/Wall-Hub to filter by family member, with avatar and color-coded selection state (`source: src/components/wall-hub/shared/person-filter-chips.tsx`)
- [ ] Schedule cards color-coded by first participant's avatar color, showing time range (12h/24h based on preference) and stacked participant avatars; only managers can tap to edit the event (`source: src/components/wall-hub/shared/schedule-card.tsx`)
- [ ] Read-only display behavior for non-managers: event editing and chore edit/delete are gated behind `isManager`/`isDevice` checks throughout wall-hub and chores views (`source: src/components/wall-hub/shared/schedule-card.tsx`)
- [ ] "No events" empty state shown per person/day column when nothing is scheduled (`source: src/components/wall-hub/today/person-column.tsx`)

## Notifications

- [ ] Toast notifications (success/error) on chore create/update/delete/take, reward chart task/goal/message actions, reward store create/update/delete/redeem/set-goal, timer/device actions (`source: src/components/chores/dialogs/chore-dialog.tsx`)
- [ ] Active timer alert modes configurable per template: none / completion / escalating (`source: src/components/timers/timer-template-form.tsx`)
- [ ] Timer "missed"/cooldown-expired state visually flags a destructive-styled card requiring dismissal when the confirmation window lapses (`source: src/components/dashboard/active-timers/timer-card.tsx`)
- [ ] Cache/connectivity status indicator surfaces Live / Updating / Offline states with animated pulse dot and tooltip description (`source: src/components/status/cache-status-indicator.tsx`)
- [ ] Global unhandled error boundary and route-level error boundary display a friendly error message with retry/go-home actions; logs error to console (`source: src/app/global-error.tsx`)
- [ ] Custom localized 404 not-found page with a "go home" action (`source: src/app/(main)/[locale]/not-found.tsx`)

## i18n

- [ ] Two supported locales, Dutch (default) and English, with locale-prefixed routing as-needed (`source: src/i18n/routing.ts`)
- [ ] Locale messages loaded per-request from `messages/{locale}.json` (`source: src/i18n/request.ts`)
- [ ] Language switcher dropdown (flag + name for nl/en) that replaces the current route with the new locale (`source: src/components/language-switcher.tsx`)
- [ ] Date-locale-aware relative time formatting (e.g. device last-active) using date-fns nl/enUS locales based on current locale (`source: src/components/settings/devices-section.tsx`)
- [ ] Localized error/not-found/help pages and translated navigation, header, and greeting strings via next-intl namespaces (chores, rewardChart, rewardStore, WallHub, DashboardPage, SettingsPage, Header, Menu, LanguageSwitcher) (`source: messages/nl.json`)

## Settings

- [ ] Settings page with tabbed sections: Family, Linked Accounts, and Devices (Devices tab manager-only) (`source: src/components/settings/settings-page-client.tsx`)
- [ ] Devices section: list paired devices with paired-date, last-active relative time (locale-aware), and an Active/Inactive status dot (active = seen within last hour) (`source: src/components/settings/devices-section.tsx`)
- [ ] Pair a new device: name it, generate a pairing code that expires (shown with a 5-minute expiry note), copy code to clipboard with a checkmark confirmation (`source: src/components/settings/devices-section.tsx`)
- [ ] Rename a device via dialog and remove a device via confirmation alert dialog (`source: src/components/settings/devices-section.tsx`)
- [ ] User preferences endpoint backing 24-hour vs 12-hour time format display used across the app (dashboard flow, current-time, schedule cards) (`source: src/app/api/v1/preferences/route.ts`)
- [ ] Timer templates management: create/edit/delete templates with title, category (screen/chore/activity, each with emoji), duration in minutes, star reward, control mode (parents-only/anyone), alert mode, and a "show as quick action on dashboard" toggle (`source: src/components/timers/timer-template-form.tsx`)
- [ ] Timers page lists templates as cards with duration/star/alert/control badges, Start/Edit/Delete actions (Edit/Delete manager-only); FAB to add a template (manager-only) (`source: src/components/timers/timers-page.tsx`)
- [ ] Desktop sidebar collapse/expand toggle (always starts collapsed, no persistence across sessions) with tooltips when collapsed (`source: src/components/layout/sidebar-context.tsx`)
- [ ] Navigation items filtered by manager role (Chores, Timers, Settings restricted to managers) (`source: src/components/layout/desktop-sidebar.tsx`)
- [ ] Mobile slide-out navigation drawer with the same nav items and a help link (`source: src/components/layout/mobile-navigation.tsx`)

## PWA

- [ ] Web app manifest defines installable app metadata: name "Kynite", standalone display mode, start URL `/dashboard`, theme/background colors, and maskable icons (`source: public/manifest.json`)
- [ ] Manifest is linked in document head and exposed via Next.js metadata config, enabling "Add to Home Screen" install prompts (`source: src/app/(main)/layout.tsx`)
- [ ] Network status detection hook drives offline-aware UI (no service worker/offline asset caching found; PWA support is limited to manifest + install) (`source: src/components/status/cache-status-context.tsx`)

## Misc

- [ ] Dashboard composed of Greeting, Today's Flow (events), Today's Chores, Active Timers, Weekly Stars, plus a Quick Actions floating button (`source: src/components/dashboard/dashboard.tsx`)
- [ ] Time-of-day greeting text (morning/afternoon/evening) driven by a live clock (`source: src/components/dashboard/greeting/greeting.tsx`)
- [ ] "Today's Flow" section categorizes today's calendar events into Now / Next / Later with a remaining-events count badge (`source: src/components/dashboard/todays-flow/todays-flow.tsx`)
- [ ] Active Timers section on dashboard renders live countdown cards per timer with state machine: running → paused/expired(cooldown) → needs-acknowledge/cooldown-expired, each with distinct action buttons (Extend, Pause, Done, Claim reward, Dismiss) (`source: src/components/dashboard/active-timers/timer-card.tsx`)
- [ ] Timer extend durations scale dynamically based on total timer length (+1m/+5m/+10m/+15m/+30m tiers) (`source: src/components/dashboard/active-timers/timer-card.tsx`)
- [ ] Claiming a completed timer with cooldown awards stars and fires confetti; early "Done" acknowledgement also fires confetti only if time remained (`source: src/components/dashboard/active-timers/timer-card.tsx`)
- [ ] Quick Actions FAB: popover of quick-start action buttons (icon + label) plus a manual "Refresh" (invalidates all queries); selecting an action opens a member picker to assign/start it (e.g., starting a timer) (`source: src/components/dashboard/quick-actions/quick-actions-fab.tsx`)
- [ ] Real-time family sync via Pusher channel updates active timers, star balances, and chore completion across devices without manual refresh (`source: src/components/dashboard/contexts/dashboard-context.tsx`)
- [ ] Timer control ownership model: only the "owner device" that started a timer can pause/resume/sync it; orphaned timers (no sync in 60s) can be claimed by another device (`source: src/server/services/active-timer-service.ts`)
- [ ] Timer server-side lifecycle: start from template or one-off, pause/resume/extend/cancel, sync remaining time, auto-transition to "expired" (awaiting confirmation) or "completed" based on cooldown configuration, confirm within cooldown window to award stars (`source: src/server/services/active-timer-service.ts`)
- [ ] App shell layout: persistent desktop sidebar + top header with centered live clock, mobile hamburger menu, manager-only user avatar/menu, and a help link (`source: src/components/layout/app-shell.tsx`)
- [ ] Brand area displays the Kynite logo, brand name, and tagline (localized) (`source: src/components/layout/brand-area.tsx`)
