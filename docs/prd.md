---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - "_bmad-output/analysis/product-brief-family-planner-2025-12-21.md"
  - "docs/legacy/ARCHITECTURE.md"
  - "docs/legacy/PROJECT_BRIEF.md"
  - "docs/research/psychology-and-product-principles.md"
documentCounts:
  briefs: 1
  research: 2
  brainstorming: 0
  projectDocs: 0
workflowType: "prd"
lastStep: 11
project_name: "Kynite"
user_name: "Peep"
date: "2026-08-06"
version: "2.0"
---

# Product Requirements Document - Kynite

**Author:** Peep
**Version:** 2.0
**Date:** 2026-08-06

## Executive Summary

Kynite is a "Family Operating System" designed to reduce the mental load of household management and eliminate parental nagging. It bridges adult-focused logistics (Google Calendar) with a child-friendly routine and motivation layer, giving the household a single, always-current source of truth. It comprises an always-on Hub display for kids and a frictionless mobile Controller for parents, keeping the family synchronized without turning coordination itself into another chore.

Version 2.0 is a research-driven rewrite. Both the reward mechanics and the household-coordination model were previously designed on intuition; this revision replaces those assumptions with findings from child-motivation psychology and household-dynamics research (see `docs/research/psychology-and-product-principles.md`). The most consequential change: the gamification layer is no longer a generic "star chart" bolted onto a calendar. It is a carefully bounded reward system — praise-first, reward-only (no penalties), scoped to tedious chores rather than fun events, age-tiered, and designed to make itself unnecessary over time. The second most consequential change: the product now treats "who becomes the permanent admin" and "how does the second parent get value with zero setup" as first-class problems, not afterthoughts.

### What Makes This Special

- **Proactive facilitation.** The system prompts routines (e.g., "Shoes on in 5 minutes") with visual countdowns that reduce the need for verbal parental instructions.
- **A bounded, evidence-based reward system.** Praise leads, stars follow; no negative marking; no sibling comparison; rewards apply to chores and routines only, never to fun calendar events; each routine has a path to graduate off the reward system entirely.
- **Cross-device synchronization.** The parent's mobile Controller and the child's wall-mounted Hub stay in sync in real time, with sub-second optimistic feedback on the Hub so taps never feel laggy.
- **Zero-friction second-parent onboarding.** The partner who didn't set the system up gets their own calendar merged and sees value before entering a single piece of data.
- **Calm, glanceable design.** High-contrast, large-target, non-strobing — usable at a glance from across the room, by kids and rushed adults alike.

## Project Classification

**Technical Type:** web_app (PWA Optimized)
**Domain:** general (Household / Productivity)
**Complexity:** medium
**Project Context:** Greenfield rebuild (v2 — supersedes the original Family Planner design)

This classification reflects the multi-platform nature of the solution (Next.js PWA) and the need for real-time synchronization between the mobile Controller and the wall-mounted Hub.

## Success Criteria

### User Success

- **The "Calm Morning" outcome.** Households experience a measurable reduction in verbal nagging, with routines completing on time via Hub-driven prompts instead of parental repetition.
- **Conflict reduction.** Friction around chores shifts from parental pressure to neutral, system-driven prompts.
- **Durable positive reinforcement.** Children build a sense of ownership and mastery, evidenced by engagement with routines and reward redemption — without anxiety around missed days or comparison to siblings.
- **Shared ownership, not single-admin lock-in.** Both parents actively use the system; the second parent is not permanently relegated to a passive bystander because setup funneled through the first.

### Business & Engagement Success

- **Single source of truth.** Kynite is the household's definitive reference point, targeting near-daily usage by every family member.
- **System trust.** High reliability and data integrity between external systems (Google Calendar/Tasks) and Kynite's internal state.
- **Retention beyond novelty.** Passive glanceable value (today's schedule, who's doing what) keeps the Hub relevant well past the first two weeks, independent of gamification.

### Technical Success

- **High-fidelity sync.** Low-latency Google Calendar sync and near-instant internal state propagation (task complete → parent notified).
- **Always-on reliability.** The Hub stays responsive and synchronized continuously, degrading gracefully during connectivity loss.

### Measurable Outcomes (KPIs)

- **Interaction rate:** multiple glance/touch interactions per day on the Hub.
- **Task velocity:** high completion rate of assigned routines/chores through the system.
- **Second-parent activation:** the non-admin parent completes onboarding and links their own calendar without the admin parent doing it for them.
- **Reward-system fade:** a nonzero share of routines reach "graduated" status over time (evidence the system is working itself out of a job, not creating dependency).

## User Journeys

**Journey 1: The "Morning Rush" Rescue**
_Persona: Sarah (Manager) & Leo (Participant, age 6)_
At 7:15 AM, Sarah is packing lunches, dreading the daily battle of getting Leo into his shoes. The Hub chimes and a "Shoes On" timer begins a friendly countdown — no verbal nagging required. Leo taps the big "Done" button; the tap registers instantly with a burst of confetti and specific praise text ("You got those on all by yourself!"). A star lands quietly a beat later — the celebration, not the star, is the headline. Sarah's phone buzzes: "Leo finished Shoes On." No approval gate, no friction — they walk out the door on time.

**Journey 2: The "Invisible" Coordination**
_Persona: Sarah (Manager) & Grandpa Joe (Caregiver)_
At 2:00 PM, Sarah is stuck in a meeting and needs to change the pickup plan. She opens the Controller and reassigns the pickup to "After-School Care," noting "Pack Swim Gear." The change propagates instantly. Grandpa Joe opens the read-only, no-account link Sarah sent him weeks ago and sees the updated plan immediately — no text, no call, no app install. The plan itself is the source of truth.

**Journey 3: The Second Parent, Week One**
_Persona: Mark, Sarah's partner_
Sarah set up Kynite two weeks ago. Mark has never opened it. Sarah sends him an invite link. Mark taps it, picks an avatar and color, and grants calendar access — that's the entire flow. His own Google Calendar events now show up merged into the family view immediately, with zero manual entry. He didn't have to build anything or learn a system; the value was just there. A week later he's the one setting timers for bedtime.

**Journey 4: The Reward That Fades**
_Persona: Leo (Participant, age 6), then age 9_
At 6, Leo earns a star and picks an instant reward — an extra bedtime story — the moment he hits his threshold, because waiting for a savings goal means nothing to him yet. By 9, the "Shoes On" routine has quietly graduated: Leo does it unprompted every day, and the Hub retired stars for that routine with a small "you've got this" badge, weeks ago. He's now saving toward a bigger self-chosen reward — a trip to the zoo — tracked with a progress bar instead of instant redemption, because at 9 he can hold a goal in mind for weeks.

### Journey Requirements Summary

These journeys reveal critical capabilities for the system:

- **Real-time sync** between mobile Controller and Hub, with sub-second optimistic feedback on the Hub itself.
- **Active prompting** — visual/audio cues for routine transitions.
- **Neutral device voice** — the Hub speaks as itself ("3 of 4 morning tasks done"), never as a parent's mouthpiece.
- **Zero-setup caregiver and second-parent access** — link-shareable read-only views, and a claim-and-merge onboarding flow for the second parent.
- **Bounded, age-aware reward logic** — praise-first feedback, instant vs. savings-goal redemption by age, graduation off the reward system per routine.
- **Explicit task ownership** so reminders route to the person actually responsible, not whoever created the event.

## Tech Constraints

Kynite is a Next.js 16 (App Router) application using React 19 and TypeScript, self-hosted on a VPS. These are binding technical constraints, not implementation detail to be revisited per-feature:

- **Framework:** Next.js 16, React 19, TypeScript (strict mode). TypeScript pinned to 5.9.x, not 7.x: the TS 7 Go binary exposes no JS compiler API, which typescript-eslint requires (decided M01, 2026-08-06).
- **Data layer:** Drizzle ORM over PostgreSQL.
- **Auth:** better-auth (email/password), with a separate no-account link-based flow for caregiver views.
- **i18n:** next-intl, Dutch (`nl`) as default locale, English (`en`) supported.
- **UI:** Tailwind CSS 4 with shadcn/ui (new-york style) built on Base UI primitives.
- **Realtime:** Server-Sent Events (SSE) backed by PostgreSQL `LISTEN`/`NOTIFY` — no separate message broker.
- **Offline/PWA:** Serwist-based service worker; VAPID web push for notifications.
- **Background jobs:** pg-boss (Postgres-backed queue) for scheduled/async work (channel renewal, reminder dispatch, etc.).
- **Server logic:** Next.js server actions and route handlers — no separate backend service.
- **Celebration effects:** canvas-confetti for completion animations.
- **Deployment:** self-hosted VPS (no managed serverless platform dependency).

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP approach: Experience MVP with foundational sync, bounded reward system included.**
The priority is the "Calm Morning" outcome delivered through a polished, trustworthy Hub + Controller experience. Google Calendar sync is a hard Day-1 requirement — without it, the Hub isn't a credible source of truth. The reward system ships in its bounded, research-informed form from the start (praise-first, no negative marking, age-tiered) rather than as a naive star chart to be fixed later — retrofitting the psychology after launch risks establishing bad habits (comparison, penalty framing) that are hard to undo with users already attached to them.

**Resource requirements:** small team (solo/pair); full-stack Next.js capability plus real-time and UI/UX craft are both critical.

### MVP Feature Set (Phase 1)

**Core user journeys supported:** Morning Rush, Invisible Coordination, Second Parent Week One.

**Must-have capabilities:**

- Google Calendar two-way sync (multi-account).
- Real-time state propagation (SSE + Postgres `LISTEN`/`NOTIFY`).
- Visual routine timers on the Hub.
- Bounded reward system: praise-first feedback, no negative marking, soft streaks with grace misses, no sibling comparison, age-tiered redemption, experience/privilege presets.
- Explicit task ownership with owner-routed reminders.
- Second-parent onboarding (claim avatar/color, merge own calendar, zero data entry).
- Role-based, link-shareable, no-account caregiver view.
- Day, Week, Month, and List views on the Hub.

### Post-MVP Features

**Phase 2 (Growth):**

- Digital reward-redemption catalog with richer presets and per-family customization.
- Natural-language event/chore entry via chat interface.
- Per-routine graduation analytics (surfacing which routines are ready to fade).

**Phase 3 (Expansion):**

- Smart suggestions for timers based on learned routine patterns.
- Finer-grained multi-caregiver permission tiers beyond Owner/Contributor/Viewer.

### Risk Mitigation Strategy

**Technical risks:**

- **Sync latency undermining trust:** mitigated by SSE + Postgres `LISTEN`/`NOTIFY` as a first-class architectural commitment, not a bolt-on.
- **Optimistic-UI/server-state divergence:** the <100ms optimistic tap feedback must reconcile cleanly with eventual server confirmation; mitigated by clear, tested reconciliation and conflict-resolution rules.
- **Always-on Hub stability:** mitigated by targeting standard Android tablets (Chrome) and rigorous long-running session testing.

**Product/adoption risks:**

- **Reward-mechanic misfire (novelty wear-off, gamification backfire):** mitigated by the researched design — praise-first, reward-only, fade path — rather than a naive point system that risks the failure modes documented in Part 1 of the research (streak anxiety, overjustification, sibling rivalry).
- **Single-admin trap:** mitigated by making second-parent onboarding a first-class, measured flow rather than an afterthought.
- **Hardware setup friction:** mitigated by targeting standard Android tablets rather than custom hardware.
- **"Bait and switch" perception (cf. Cozi):** the hooking feature (calendar sync, core routines) must never be paywalled after adoption.

## Functional Requirements

### 1. Calendar Orchestration

- **FR1:** The system can synchronize two-way with multiple Google Calendars across multiple linked Google accounts simultaneously.
- **FR2:** The system can aggregate and display events from disparate sources (individual parent calendars, shared family calendars) into a unified Hub view.
- **FR3:** Users can view family events in Day, Week, Month, and List layouts on the Hub.
- **FR4:** Parents can create, edit, and delete events in any linked Google Calendar via the mobile Controller.
- **FR5:** The recurrence model supports custody-week-flexible patterns (e.g., "every other week," alternating-week schedules) as a first-class recurrence type, not a workaround.

### 2. Task Ownership & Routine Management

- **FR6:** Parents can define routines composed of multiple sequential tasks.
- **FR7:** The system can trigger proactive countdown prompts for specific routines on the Hub.
- **FR8:** Participants can mark individual tasks and routines as complete via single-tap interaction on the Hub.
- **FR9:** Every task and event carries an explicit owner (the person responsible for it), distinct from its creator.
- **FR10:** Reminders and notifications route to the task's owner, not to whoever created the task.

### 3. Motivation & Reward System

- **FR11:** The system tracks a cumulative star/point total per participant that only grows — no deductions, ever. Missed tasks render dimmed or absent, never as a penalty mark (no red X, no negative balance).
- **FR12:** Streak tracking, where shown, is soft: it includes built-in grace misses and never displays a broken-chain or "streak lost" state. For young children, the cumulative total — not the streak — is the primary progress indicator.
- **FR13:** No UI surface anywhere in the product ranks, compares, or displays one child's progress against a sibling's. All progress views are personal to the participant viewing them.
- **FR14:** Reward mechanics (stars, redemption) attach only to chores and routines the child does not find inherently enjoyable. Fun calendar events (parties, outings, playdates) never carry reward mechanics.
- **FR15:** Task-completion feedback leads with specific, competence-signaling praise text and a celebration animation; the star/point award is visually secondary to the praise.
- **FR16:** Reward redemption behavior is age-tiered per participant: ages ~4–7 get instant, concrete, high-frequency small redemptions with an icon-heavy, low-text UI; ages ~8–12 get savings-goal tracking toward larger, self-chosen rewards with progress bars and weekly totals.
- **FR17:** Each routine supports an independent "fade"/graduation path: once a routine is reliably self-sustained, a parent (or the system, with parent confirmation) can retire its reward mechanic in favor of a graduation badge, without affecting other routines' reward status.
- **FR18:** Reward-redemption presets default to experiences and privileges (e.g., choose dinner, extra story, a special outing) rather than money or allowance. The system provides no money/allowance-banking scope.
- **FR19:** Participants can request reward redemptions once thresholds are met; parents can approve, deny, or manually adjust totals (upward only — no deduction mechanic).

### 4. Real-Time Hub Ecosystem

- **FR20:** The system synchronizes state between the Controller and the Hub in real time via SSE.
- **FR21:** The Hub displays a cached/offline mode with a non-disruptive indicator when connectivity is lost, continuing to show the last-known schedule.
- **FR22:** Parents receive push notifications for significant participant actions (e.g., routine complete), routed per FR10's ownership model.

### 5. Multi-User & Household Experience

- **FR23:** The system supports multiple participant profiles with individualized tracking and individualized reward-tier settings (FR16).
- **FR24:** Caregivers can view the consolidated family schedule via a role-based, link-shareable view that requires no account or authentication.
- **FR25:** Access roles (Owner, Contributor, Viewer) govern what each linked person — parent, second parent, or caregiver — can see and change.

### 6. Onboarding & Administration

- **FR26:** The system provides a dedicated second-parent onboarding flow: accept invite, claim an avatar and color, link a Google account. Their own calendar appears merged into the shared view immediately, with no further data entry required to get value.
- **FR27:** Parents can securely link and manage multiple external Google accounts through OAuth.
- **FR28:** Parents can configure Hub display preferences (default view, per-calendar color-coding) via the Controller.
- **FR29:** The system manages initial setup and device-to-account pairing through a mobile-first flow.

### 7. Voice & Tone

- **FR30:** All Hub-facing copy is written and reviewed as a neutral board speaking for itself (e.g., "3 of 4 morning tasks done"), never phrased as a parent's command or attributed to a specific parent. This applies to task prompts, reminders, and completion feedback alike.

## Non-Functional Requirements

### Performance

- **Optimistic completion feedback (hard NFR):** the Hub must render visual feedback for a task-completion tap in under 100ms, using optimistic UI ahead of server confirmation. This is the single most important performance requirement in the product — competitor research shows even a 5-second lag kills kid engagement with the device.
- **Sync latency:** internal state changes (e.g., task complete → parent notification) must propagate in under 2 seconds via SSE.
- **Mobile Controller load time:** primary dashboard loads in under 1.5s on a 4G connection.

### Reliability & Availability

- **Hub uptime:** the Hub (Chrome on Android) maintains 99.9% availability during active hours.
- **Offline resilience:** the system renders the last-cached schedule state indefinitely during connectivity loss, via the Serwist service worker.
- **Auto-recovery:** the application automatically attempts to re-establish its realtime (SSE) connection on signal loss without requiring a manual refresh.

### Usability & Accessibility

These are plain, concrete usability requirements — not framed around any diagnosis or condition. They exist because a wall-mounted family display must be legible at a glance, under time pressure, to users ranging from a 4-year-old to a rushed adult.

- **Glanceable design:** Hub typography and layout must be legible from at least 6 feet away.
- **High contrast:** text and interactive elements meet WCAG AA contrast minimums against the Hub's background at all times of day.
- **Target size:** all interactive touch targets on the Hub are a minimum of 48×48px.
- **Non-strobing animation:** all celebration/reward animations are photosensitive-epilepsy safe (no strobe effects), with configurable volume and intensity.
- **Minimal-text mode:** the youngest participants' UI (per FR16's age tiers) relies on icons over text.

### Security

- **Authentication:** the Controller uses secure Google OAuth for account linking and administrative actions; better-auth governs primary account authentication.
- **Caregiver link scope:** no-account caregiver links (FR24) are read-only by default and scoped to the role granted, never granting write access without an upgrade to a full account.
- **Kiosk safety:** the Hub frontend runs in full-screen PWA mode, minimizing accidental navigation away from the application.
- **Data integrity:** the system uses last-write-wins conflict resolution for simultaneous edits between the Controller and the Hub, with the <100ms optimistic tap (see Performance) reconciled against this rule rather than exempted from it.

## Changelog (v1 → v2)

This revision is driven by `docs/research/psychology-and-product-principles.md` (child motivation psychology + household coordination research). Key changes:

- **Reward system redesigned from evidence, not intuition.** Added: no negative marking (FR11), soft streaks with grace misses (FR12), no sibling comparison surfaces (FR13), rewards scoped to chores/routines only — never fun events (FR14), praise-first completion feedback (FR15), age-tiered redemption — instant (4–7) vs. savings goals (8–12) (FR16), per-routine fade/graduation path (FR17), experience/privilege reward presets with no money/allowance scope (FR18).
- **Household-dynamics fixes.** Added second-parent onboarding as a first-class, zero-data-entry flow (FR26) to counter the "single-admin trap"; added explicit task ownership with owner-routed reminders (FR9, FR10) to counter mental-load-without-redistribution.
- **New hard performance NFR.** Sub-second (<100ms) optimistic completion feedback promoted to the top-priority performance requirement, replacing the softer "<100ms touch response" framing in v1 — directly informed by competitor evidence that lag kills kid engagement.
- **Voice and tone formalized.** New FR30 and design principle: the Hub is a neutral board, never a parent's mouthpiece — this was implicit in v1's "no nagging" framing and is now explicit and testable.
- **ADHD framing removed.** "ADHD-Friendly Design" is no longer used as positioning. The underlying usability outcomes (glanceable, high contrast, 48px targets, non-strobing animation) are retained as plain accessibility/usability NFRs, justified on their own terms.
- **Added new scope.** Role-based, link-shareable, no-account caregiver view (FR24) and custody-week-flexible recurrence (FR5) — both carried forward from research as explicitly supported patterns rather than left implicit.
- **Added Tech Constraints section.** Documents the binding stack (Next.js 16 / React 19 / Drizzle + PostgreSQL / better-auth / next-intl / Tailwind 4 + shadcn on Base UI / SSE + Postgres LISTEN/NOTIFY / Serwist + VAPID push / pg-boss / server actions & route handlers / canvas-confetti), self-hosted on a VPS — reflecting the actual greenfield rebuild's foundation rather than v1's more speculative "Websockets or similar."
- **Journeys updated.** Replaced the v1 "Reward Store" journey with journeys illustrating second-parent onboarding and reward-system fade over time, since those are now core differentiators rather than v1's generic redemption flow.
- **Risk section updated.** Added reward-mechanic misfire and single-admin-trap as named product risks with their mitigations tied directly to the new requirements.
