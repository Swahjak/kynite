# Hub calendar renders `CalendarShell` — tracking

Owner decision (2026-09-14): the hub (`/hub/kalender`, device principal) is the same calendar as the app (`/calendar`), with lesser permissions — a different role, not a different UI. `TodayTabPersonen` on that route is replaced by `CalendarShell` in read-only mode.

## Decisions

- **Write gating stays on `can(principal,'event:write')`** (`canWrite`, resolved in `modules/calendar/page-data.ts`). No `isHub` boolean guards permissions; `surface: 'app'|'hub'` on `CalendarShell` is presentation only (precedent: `modules/today/ui/today-header.tsx`).
- **No view switcher on hub.** `loadCalendarPage` fetches `viewWindow(view)` for hub, so client-side switching would draw agenda over a one-day window. `hubDefaultView` (`day|agenda`) remains the selector.
- **Member filter faces stay** (same as app).
- **Hour range stays 06–23** (same content as app); hub metrics: hour row 84px, sticky header 64px, scroll-to-now on mount (gated on `now` so snapshots stay deterministic).
- **Offline mirror scoped to fallback**: `hub-board.tsx` cached branch keeps `PersonColumns`/`AgendaView` (shared with `/hub`, already announces itself as degraded).
- **Realtime**: `TodayLive` stays mounted on the route; `router.refresh()` reseeds shell props.
- `today-tab-personen.tsx` / `person-columns.tsx` stay (used by `/today`, `/hub`, `day-board.tsx`).
- Known gaps found, out of scope: `(app)/calendar` has no realtime subscription; `MemberDayGrid` never passed `hub` to `EventChip` sizing.

## Milestones

- [x] M1 — surface + route swap (sonnet). `calendar-shell.tsx` (`surface`, `basePath` for the three hard-coded `/calendar` pushes ~:145/:158/:187, suppress header + view switcher on hub), `modules/calendar/index.ts`, `(hub)/hub/kalender/page.tsx` (mount `CalendarShell` inside `HubBoard`, keep `TodayLive` + `TodayHeader`). AC: `/nl/hub/kalender` renders `calendar-view-day` with one column per member; no `event-create`/`event-dialog`; typecheck + lint clean.
- [x] M2 — read-only gating (sonnet). `time-grid.tsx`, `member-day-grid.tsx` get `canWrite`; when false no `onPointerDown`/`suppressClick`/`cursor-grab` (drag is gated on `event.editable` today, `queries.ts:311` leaves it true for device principals). `MemberDayGrid` threads `hub` to `EventChip`. Unit tests. AC: app calendar behaviour unchanged.
- [ ] M3 — kiosk metrics (sonnet). `ui/tokens.ts` hub constants; `layout`/`verticalSpan` take `metrics`; `MemberDayGrid`/`TimeGrid` accept `metrics` (default app); `HEADER_HEIGHT` in metrics; scroll-to-now effect. Metrics unit test.
- [ ] M4 — tests & baselines (sonnet). `calendar-shell-hub.test.tsx`; hub visual spec baseline for `/nl/hub/kalender`; `kiosk-audit.spec.ts` green at both viewports.
- [ ] R — review → fix → merge → deploy.

## Agent log

| id | unit | model | subagent_tokens | tool_uses | status |
|---|---|---|---|---|---|
| inv | hub vs app investigation | sonnet | 48k | 20 | done |
| plan | plan | opus | 106k | 31 | done |
| m1m2 | M1 + M2 | sonnet | ~90k | ~45 | done |
