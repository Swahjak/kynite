---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - "_bmad-output/analysis/product-brief-family-planner-2025-12-21.md"
  - "docs/legacy/ARCHITECTURE.md"
  - "docs/legacy/PROJECT_BRIEF.md"
documentCounts:
  briefs: 1
  research: 2
  brainstorming: 0
  projectDocs: 0
workflowType: "prd"
lastStep: 11
project_name: "Family planner"
user_name: "Peep"
date: "2025-12-21"
---

# Product Requirements Document - Family planner

**Author:** Peep
**Date:** 2025-12-21

## Executive Summary

Family planner is a proactive "Family Operating System" designed to reduce the mental load of household management and eliminate parental "nagging." By bridging the gap between adult-focused logistics (Google Calendar) and child-friendly behavioral motivation, the system creates a centralized source of truth that actively facilitates daily routines. It comprises a dedicated, always-on Family Planner for kids and a frictionless Mobile App for parents, ensuring that the entire family stays synchronized, motivated, and on schedule.

### What Makes This Special

- **Proactive Facilitation:** Unlike passive calendars, the system proactively prompts routines (e.g., "Potty time in 15 mins") using "Timer Prescriptions" that reduce the need for verbal parental instructions.
- **Integrated Motivation Engine:** It merges high-utility logistics with a gamified reward system (Stars & Stickers), providing immediate, high-impact visual feedback (confetti, animations) to reinforce positive behaviors instantly.
- **Cross-Device Synchronization:** Seamlessly connects the parent's mobile "command center" with the child's wall-mounted "execution hub," ensuring real-time state sync across all interactions.
- **ADHD-Friendly Design:** Prioritizes visual structure, predictability, and low-friction interactions (single-tap completion) to support families managing neurodiversity.

## Project Classification

**Technical Type:** web_app (PWA Optimized)
**Domain:** general (Household / Productivity)
**Complexity:** medium
**Project Context:** Greenfield - new project

This classification reflects the multi-platform nature of the solution (Next.js/PWA) and the need for real-time synchronization between the mobile controller and the central hub.

## Success Criteria

### User Success

- **The "Calm Morning" Outcome:** Households experience a measurable reduction in verbal "nagging," with participants successfully departing for school/work on time by following automated Family Planner routines.
- **Conflict Reduction:** A decrease in friction regarding daily chores, shifted from parental pressure to system-driven prompts.
- **Positive Reinforcement:** Children/Participants demonstrate a sense of ownership and pride, evidenced by active engagement with the "Star Count" and reward redemption.

### Business & Engagement Success

- **Single Source of Truth:** Establishing the Family Planner as the definitive household reference point, aimed at 100% Daily Active Usage (DAU) within the home.
- **System Trust:** Building unwavering user confidence through 99.9% system reliability and data integrity between external (Google) and internal (Planner) systems.

### Technical Success

- **High-Fidelity Sync:** Maintaining a <5-second average latency for Google Calendar sync and a <2-second latency for internal state changes (e.g., Task Complete -> Parent Notification).
- **Always-On Reliability:** Ensuring the Family Planner remains responsive and synchronized 24/7, handling intermittent connectivity gracefully.

### Measurable Outcomes (KPIs)

- **Interaction Rate:** Average of >5 physical touch interactions per day on the Family Planner.
- **Task Velocity:** >80% of assigned chores marked "Done" through the system.
- **Reward Velocity:** Consistent weekly "Star" accumulation per participant, indicating sustained behavioral engagement.

## User Journeys

**Journey 1: The "Morning Rush" Rescue**
_Persona: Sarah (Manager) & Leo (Participant)_
At 7:15 AM, Sarah is packing lunches, dreading the daily battle of getting 6-year-old Leo to put on his shoes. Usually, she has to ask five times, ending in a shout. Today, the Family Planner chimes. Instead of Mom nagging, the "Shoes On" timer begins a big, friendly countdown. Leo sees he has 4 minutes to "beat the timer." He gets his shoes on and taps the big "DONE" button. The screen explodes with confetti and victory sounds. Sarah gets a buzz on her phone: "Leo completed 'Shoes On'!" She approves the reward from her phone, adding a star to his tally. They walk out the door high-fiving—no conflict, just teamwork.

**Journey 2: The "Invisible" Coordination**
_Persona: Sarah (Manager) & Grandpa Joe (Caregiver)_
At 2:00 PM, Sarah gets stuck in a meeting and needs to change the pickup plan to "After-School Care." She opens the Parent Controller app and updates the event, adding a note to "Pack Swim Gear." Instantaneously, the Family Planner at home updates. When Grandpa Joe glances at the Hub to check the plan, he sees the new block and the note. He didn't need a text or a call; the "Source of Truth" was updated in real-time. He picks up the gear and the child flawlessly, and the system manages the logistics so the humans don't have to.

**Journey 3: The "Reward Store" Motivation**
_Persona: Leo (Participant)_
On Sunday morning, Leo runs to the Family Planner to check his total Star Count. He navigates to the "My Progress" screen and sees he has earned enough stars for the "Pizza Night" reward. He taps "Redeem," triggering a special animation on the Hub and sending a request to Sarah's phone. Sarah approves the request, and "Pizza Night" is automatically added to the family calendar for that evening. Leo feels a tangible connection between his consistent positive behavior and a real-world reward.

### Journey Requirements Summary

These journeys reveal critical capabilities for the system:

- **Real-Time Sync:** Immediate state changes between Mobile and Hub (Websockets).
- **Active Prompting:** Visual and audio cues for "Timer Prescriptions" on the Hub.
- **Verification Loop:** Parent notification and approval workflow for completed tasks.
- **Multi-User Visibility:** Simplified "at-a-glance" views (List/Month) for non-technical users (Caregivers).
- **Gamification Logic:** Integrated reward redemption that modifies the external calendar.

## Web App Specific Requirements

### Project-Type Overview

Family planner is a modern Web Application optimized as a Progressive Web App (PWA). It leverages Next.js for its core framework, providing a high-performance, responsive experience across both the dedicated Family Planner (Android Tablet) and the mobile "Parent Controller."

### Technical Architecture Considerations

- **Platform & Browser Support:**
  - **Primary Target:** Chrome on Android (optimized for tablet form factors).
  - **PWA Optimization:** The application will be fully PWA-ready, supporting "Add to Home Screen" with a standalone display mode to provide a full-screen, native-app feel on the Family Planner.
- **Real-Time Synchronization:**
  - **Implementation:** A real-time communication layer (Websockets or similar) will be utilized to ensure that state changes (e.g., Parent adds a task, Child completes a timer) are pushed to all devices in <2 seconds.
- **Offline Strategy:**
  - **Resilience:** The application will implement service workers to cache the current day's schedule and task state locally.
  - **UI Feedback:** In the event of a connection loss, the Hub will continue to display the cached "Source of Truth" while presenting a subtle, non-disruptive "Offline Mode" indicator.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** **Experience MVP with Foundational Sync**
The priority is to deliver the "Calm Morning" outcome through a high-fidelity, polished "Family Planner" experience. Users must feel the system is "alive" and proactive. While the visual experience (confetti, real-time updates) is paramount, the **Google Calendar Sync** is a hard requirement to ensure the system is useful as a "Single Source of Truth" from Day 1.

**Resource Requirements:** Small Team (Solo/Pair) - Full-stack capabilities (Next.js, Websockets) and strong frontend UI/UX skills are critical.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**

- **Morning Rush:** Active timers and visual rewards.
- **Invisible Coordination:** Real-time calendar updates from Parent App to Family Planner.

**Must-Have Capabilities:**

- **Google Calendar Sync:** Full 2-way read/write sync.
- **Real-Time State:** Websocket-based updates for instant multi-device consistency.
- **Visual Timers:** "Prescription" display and countdown logic on the Hub.
- **Gamification UI:** "Star Count" and "Confetti" animations.
- **Views:** Day, Week, Month, and List views on the Family Planner.

### Post-MVP Features

**Phase 2 (Growth):**

- **Digital Reward Store:** In-app catalog for redeeming stars (replacing manual "Pizza Night" entry).
- **WhatsApp/Chat:** Natural language interface for adding events/chores via messaging apps.

**Phase 3 (Expansion):**

- **Smart Suggestions:** AI proposing timers based on learned routine patterns.
- **Multi-Family/Caregiver Access:** Granular permission controls for extended family.

### Risk Mitigation Strategy

**Technical Risks:**

- **Sync Latency:** Mitigated by prioritizing a robust Websocket layer early in development.
- **PWA "Always-On" Stability:** Mitigated by choosing Chrome on Android as the primary target and rigorous long-running session testing.

**Market/Adoption Risks:**

- **Hardware Setup Friction:** Mitigated by focusing on standard tablets (Android) rather than custom hardware.
- **"Novelty Wear-Off":** Mitigated by ensuring the "utility" (Calendar) is just as strong as the "fun" (Timers), giving the device staying power beyond the initial excitement.

## Functional Requirements

### 1. Calendar Orchestration

- **FR1:** The system can synchronize 2-way with **multiple Google Calendars across multiple linked Google accounts** simultaneously.
- **FR2:** The system can **aggregate and display events from disparate sources** (e.g., individual parent calendars, shared family calendars) into a unified Hub view.
- **FR3:** Users can view family events in Day, Week, Month, and List layouts on the Family Planner.
- **FR4:** Parents can create, edit, and delete events in any linked Google Calendar via the mobile app.

### 2. Routine & Task Management

- **FR5:** Parents can define "Routines" composed of multiple sequential tasks.
- **FR6:** The system can trigger "Timer Prescriptions" (proactive countdowns) for specific routines.
- **FR7:** Participants can mark individual tasks and routines as "Complete" via single-tap interaction on the Family Planner.

### 3. Motivation Engine

- **FR8:** The system can track "Star" totals for individual participants.
- **FR9:** The Family Planner can provide immediate visual feedback (animations) upon task completion.
- **FR10:** **The system provides a library of at least 10 distinct reward animations** (e.g., confetti, fireworks, rocket launches, etc.) to maintain variety and engagement.
- **FR11:** **The animation system is extensible**, allowing new visual rewards to be added to the library as independent modules.
- **FR12:** Participants can request "Reward Redemptions" once star thresholds are met.
- **FR13:** Parents can approve or deny reward requests and manually adjust star totals.

### 4. Real-Time Hub Ecosystem

- **FR14:** The system can synchronize state between the Parent App and Family Planner in real-time (<2 seconds).
- **FR15:** The Family Planner can display a "Cached Mode" with an offline indicator when connectivity is lost.
- **FR16:** Parents can receive push notifications for significant participant actions (e.g., Routine Complete).

### 5. Multi-User Experience

- **FR17:** The system can support multiple Participant profiles with individualized tracking.
- **FR18:** Caregivers can view the consolidated family schedule on the Family Planner without authentication.

### 6. Administration & Setup

- **FR19:** **Parents can securely link and manage multiple external Google accounts** to the family ecosystem through OAuth.
- **FR20:** Parents can configure Family Planner display preferences (e.g., default view, color-coding per calendar source) via the mobile app.
- **FR21:** The system can manage the initial setup and device-to-account pairing through a mobile-first flow.

## Non-Functional Requirements

### Performance (Critical for "Calm Morning")

- **Sync Latency:** Internal state changes (e.g., Task Complete -> Parent Notification) must synchronize in <2 seconds.
- **Touch Response:** The Family Planner UI must respond to physical taps (e.g., "Task Done") in <100ms to provide immediate tactile feedback.
- **Mobile Web Load Time:** The Parent Controller (Mobile Web PWA) must load its primary dashboard in <1.5s on a 4G connection to ensure frictionless "in-the-moment" usage.

### Reliability & Availability (Critical for "Trust")

- **Hub Uptime:** The Family Planner (Chrome on Android) must maintain 99.9% availability during active hours.
- **Offline Resilience:** The system must successfully render the last-cached schedule state indefinitely during connectivity loss, utilizing service workers.
- **Auto-Recovery:** The application must automatically attempt to re-establish Websocket connections every 30 seconds upon signal loss without requiring a manual refresh.

### Usability & Accessibility (Critical for Neurodiversity)

- **Cognitive Load:** Family Planner typography and layout must be legible from a distance of at least 6 feet ("Glanceable Design").
- **Target Size:** All interactive touch targets on the Hub must be a minimum of 48x48px to accommodate rushed or developing motor skills.
- **Sensory Safety:** All reward animations must be photosensitive epilepsy safe (no strobe effects) and include configurable volume/intensity settings.

### Security (Critical for Family Data)

- **Authentication:** The Parent Controller must utilize secure Google OAuth for all account linking and administrative actions.
- **Kiosk Safety:** The Family Planner frontend must be optimized for "Full Screen" PWA mode, minimizing the risk of accidental navigation away from the application.
- **Data Integrity:** The system must utilize "Last Write Wins" conflict resolution for simultaneous edits between the Mobile Web App and the Family Planner.
