# One route tree for the app and the hub

Since the hub-equals-app work (plan `docs/plans/2026-09-15-hub-equals-app.md`, D9-D22) a
family member and a paired wall tablet use the **same pages**. The principal decides which
controls render; there is no second `/hub` tree. `docs/architecture.md` §2 still shows the
older `(app)`/`(hub)` split and is superseded by this page for routing.

## Route groups (`apps/web/src/app/[locale]/`)

| Group | URLs | Gate |
|---|---|---|
| `(main)` | `/today`, `/calendar`, `/routines[/<memberId>]`, `/tasks`, `/store`, `/stars/<memberId>`, `/timers`, `/timer` | member **or** device: `requireMemberOrDevice()` at the top of each page |
| `(main)/pair` | `/pair` | the inverse: no device principal. A paired device is sent to `/today` |
| `(clock)` | `/clock` | device only: `requireHubDevice()` in the page (the screensaver has its own bare layout) |
| `(app)` | `/account`, `/account/notifications`, `/oauth/consent`, `/manage/*` | member: `(app)/layout.tsx` (a device is sent to `/today`, nobody to `/sign-in`) |
| `(app)/manage` | `/manage` (index), `/manage/{routines,rewards,family,settings}` | member who `can(principal, 'routine:write')`: `manage/layout.tsx` gates every sub-page |
| `(auth)`, `(marketing)`, `(share)` | sign-in/up, onboarding, `/invite/<token>`; landing; `/s/<token>` | unchanged. `(share)` is read-only and the proxy refuses non-GET |

Auth lives in pages, not in `(main)/layout.tsx`: layouts do not re-render on client-side
navigation, so a layout gate would run once per full page load. The layout only resolves the
principal to pick the shell. `src/proxy.ts` adds a cheap early bounce (`MEMBER_SECTIONS`,
`SHARED_SECTIONS`); the page gate is authoritative. Exact rule: a member section without a session
cookie goes to `/sign-in?callbackUrl=…` (a stale device cookie changes nothing); a shared section with
neither cookie goes to `/sign-in?callbackUrl=…`, except the device-only `/clock`, which goes to `/pair`
(kiosk cold boot); `/pair` itself needs nothing. A stale device cookie on a shared page is caught by
`requireMemberOrDevice`: `/pair`.

## Surface resolver (D17)

`src/modules/surface/resolve.ts`, called via `getSurface()`; the locale root layout writes
`data-surface="app|desktop|hub"` on `<html>`, and `packages/ui/src/styles/tokens.css` turns it
into the `app:`/`desktop:`/`hub:` Tailwind variants. First match wins:

1. device principal: `hub` (not overridable)
2. `kynite.surface` cookie (`app` or `desktop` only; "Weergave in deze browser"): that value
3. `Sec-CH-UA-Mobile: ?1` or a phone User-Agent: `app`; otherwise `desktop`

Tablets and iPadOS Safari (Mac UA) resolve to `desktop`.

## What the device principal switches on (D9)

One responsive shell (`components/shell/app-shell.tsx`), one destination list
(`components/app-nav/nav-items.ts`). A member gets the rail (`desktop`) or the bottom bar plus
overflow sheet (`app`), the account menu and the Google re-auth banner. A device (or the `/pair`
screen) gets `KioskFrame` inside the same `AppShell`: pre-paint hub theme and `useHubTheme`,
`DeviceSessionWatcher`, `SettingsWatcher`, `IdleReturn` (back to the clock), `HubReloadController`,
the rail timer tile, chime settings and the offline indicator. `generateMetadata` in the layout
picks the manifest: `/manifest.webmanifest` for a member, `/hub.webmanifest` for a device.

## `/hub/*` redirects (D12)

The Fully Kiosk start URL and any bookmark still point at `/hub`. `proxy.ts` answers every
`/hub[/...]` with a **308** to its twin (`HUB_REDIRECTS`: `kalender` to `calendar`, `taken` to
`tasks`, the rest same name; `/hub` itself to `/today`; `routines`/`stars` keep their `[memberId]`
tail; an unknown `/hub/<x>` also lands on `/today`). It runs before the shared-section cookie
rule, so a tablet with only its device cookie lands on `/today` untouched. Same mechanism (`legacyAppRedirect`) for the pre-Beheer paths: `/family/**` and
`/rewards/**` to `/manage/...`, `/settings/notifications` to `/account/notifications`, other
`/settings/**` to `/manage/settings`.

## Service worker

One worker, scope `/`. It cannot read the principal, so `sw-strategy.ts` matches by path:
`HUB_SECTIONS` (the `(main)` sections, `/clock`, `/pair`, legacy `/hub`) use the hub shell
strategy (`NetworkFirst`, 2s fuse, cached board on a dead network) for members and tablets
alike; `/manage`, `/account`, `/oauth` stay `app-pages` (3s). Keep `HUB_SECTIONS` in step with
`SHARED_SECTIONS` in `proxy.ts` when adding a section. Share and invite URLs stay network-only.

## Beheer (D10, D16)

Everything a device must not do (routine builder, rewards and approvals, family, settings,
calendars, devices, sharing) sits under `/manage/*`, shown in the nav only when
`can(principal, 'routine:write')`. A member's own settings live outside it at `/account`. The
everyday pages in `(main)` are read/tap surfaces for everyone.

## Adding a route

Pick the group by gate. Anything under `(main)` or `(app)` that adds, moves or deletes a route
runs `pnpm build`: two groups resolving to one URL pass typecheck and only the App Router
catches it (D21).
