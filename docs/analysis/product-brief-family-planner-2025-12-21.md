---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - "docs/legacy/ARCHITECTURE.md"
  - "docs/legacy/PROJECT_BRIEF.md"
workflowType: "product-brief"
lastStep: 5
project_name: "Family planner"
user_name: "Peep"
date: "2025-12-21"
---

# Product Brief: Family planner

**Date:** 2025-12-21
**Author:** Peep

---

## Executive Summary

**Family planner** is a comprehensive household management system designed to turn daily chaos into calm, productive routines. It moves beyond passive organization to active facilitation of family life. By combining a central "Command Center" (Family Planner) with a mobile "Parent Controller," it synchronizes logistics with behavioral motivation. It features a "Motivation Engine" that gamifies daily struggles (potty training, chores) with proactive prompts and delightful visual rewards, turning routine tasks into engaging moments.

---

## Core Vision

### Problem Statement

Managing a multi-generational household requires juggling logistics (calendars), focus (timers), and motivation (behavior). Parents are often forced to be "human alarms," constantly nagging to maintain routines. Existing tools are fragmented: effective reward systems (sticker charts) are manual and disconnected from the digital schedule, while digital tools are hidden in personal phones, leading to an invisible mental load.

### Problem Impact

- **Parental Burnout:** The exhaustion of constant micro-management and memory burden.
- **Inconsistent Routines:** Good habits fail without persistent, proactive reminders.
- **Delayed Feedback:** Rewards given hours later lose their clear association with the positive behavior.

### Why Existing Solutions Fall Short

- **Passive:** Calendars wait to be checked; they don't proactively prompt action.
- **Siloed:** Behavior tools (charts) and Logistics tools (calendars) don't talk to each other.
- **High Friction:** Awarding a "star" on a mobile app often takes too many clicks to be practical in the moment.

### Proposed Solution

A **Proactive Family Operating System** spanning a dedicated Family Planner and Mobile App.

- **Logistics Core:** 2-way sync with Google Calendar & Tasks for the "what and when."
- **Motivation Engine:** A gamified reward system ("Stars & Stickers") for milestones.
- **Active Prompting:** "Timer Prescriptions" (e.g., "Potty time in 15 mins") that prompt for confirmation and reward upon completion.
- **Visual Delight:** High-impact visual feedback (confetti, sounds, animations) to instantly reinforce positive behavior and goal completion.

### Key Differentiators

- **Proactive vs. Passive:** The system prompts the family (timers/questions), reducing the need for parental nagging.
- **Multi-Modal Access:** "Quick Actions" on the Family Planner for kids; Frictionless control via Mobile App for parents.
- **Tangible Digital Rewards:** Bridging the gap between digital convenience and the tactile satisfaction of a physical sticker chart through rich visual feedback.

## Target Users

### Primary Users

#### 1. The Household Manager (Parent/Admin)

- **Role:** The organizer who keeps the family running.
- **Motivation:** Reducing the "mental load" of remembering everything and the emotional toll of nagging.
- **Goals:** Consistent routines, peaceful execution of daily tasks, and visibility into "what's next."
- **Frustrations:** Repeating instructions, lack of follow-through from others, managing disconnected sticker charts.
- **Interaction:** Primarily uses the **Mobile App** to set schedules, configure timers ("Potty Prescriptions"), and approve rewards remotely. Uses the **Family Planner** for big-picture visibility.

#### 2. The Participant (Child/Teen/Partner)

- **Role:** The family member who needs structure to succeed.
- **Motivation:** Immediate feedback, gamified rewards (stars/confetti), and clear, non-verbal cues.
- **Goals:** Knowing exactly what is expected without being told, earning rewards for independence.
- **Frustrations:** Being surprised by events, forgetting tasks and getting in trouble, unclear expectations.
- **Interaction:** Exclusively uses the **Family Planner**. Relies on visual timers, big touch targets for checking off tasks, and the "Motivation Engine" for positive reinforcement.

### Secondary Users

#### The Extended Support Network (Grandparents/Caregivers)

- **Role:** Occasional contributors to the household flow.
- **Goals:** Seamlessly fitting into the routine without needing a tutorial.
- **Interaction:** Passive consumption of the Family Planner to answer "When is dinner?" or "Is soccer today?"

### User Journey

#### The "Morning Rush" Flow

1.  **Trigger:** Family Planner displays "School Mode" with a countdown timer.
2.  **Action:** **Participant** sees visual timer for "Shoes On."
3.  **Completion:** Participant taps "Done" on Family Planner -> Screen explodes with confetti.
4.  **Verification:** **Manager** gets a push notification: "Timmy is ready!" while packing lunch.
5.  **Reward:** Manager taps "Approve" on phone -> Family Planner adds a Star to Timmy's tally.
6.  **Result:** No yelling, timely departure, shared feeling of success.

## Success Metrics

### User Success Outcomes

- **"The Calm Morning":** Participants leave for school/work on time without repeated "nagging," indicated by successful adherence to "School Mode" timers.
- **"Conflict Reduction":** A noticeable decrease in friction around daily chores, measured by a high rate of proactive task completion.
- **"Positive Reinforcement":** Children feel pride and accomplishment, evidenced by engagement with the "Star Count" and reward redemption.

### Business Objectives

- **Adoption & Trust:** Establish the Family Planner as the single source of truth for the family, achieving 100% Daily Active Usage (DAU) among household members.
- **System Reliability:** Build unwavering trust in the system through 99.9% uptime and reliable sync, ensuring families never miss an event due to technical failure.
- **Habit Formation:** Evolve user behavior from passive checking to active interaction (timers, rewards), creating sticky retention.

### Key Performance Indicators (KPIs)

- **Interaction Rate:** Average of >5 physical touch interactions per day on the Family Planner (validating active usage vs. passive display).
- **Task Completion:** >80% of assigned chores marked "Done" directly on the Hub or Mobile App.
- **Sync Latency:** <5 seconds average time from "Mobile Input" to "Wall Display" (Critical Trust Metric).
- **Reward Velocity:** Average of X stars earned per participant per week (proxy for positive behavior reinforcement).

## MVP Scope

### Core Features

#### 1. Family Planner App (The Command Center)

- **Calendar:** Read-only "Day/Week" view of the Family **Google Calendar**.
- **Chores & Routines:** Display of internally managed tasks. Single-tap completion.
- **Timers:** "Quick Start" buttons for custom routines (stored locally).
- **Motivation Engine:** Custom reward logic (Stars/Confetti) managed by our internal API.

#### 2. Mobile App (The Parent Controller)

- **Calendar:** **Full Read/Write access** to Google Calendar events.
- **Task Management:** Create/Edit chores and routines in the **Family Planner System** (Internal API).
- **Remote Control:** Approve rewards and monitor timer status real-time.

#### 3. Backend & Infrastructure

- **Hybrid Data Model:**
  - **External:** 2-way sync with Google Calendar.
  - **Internal:** PostgreSQL DB for Users, Chores, Rewards, and Timers.
- **Real-Time Layer:** Websockets/Push for instant "App <-> Hub" state sync.

### Out of Scope for MVP

- **Google Tasks Sync:** (Removed) Managing tasks entirely within our own optimized system.
- **WhatsApp/Chat:** Phase 2.
- **Complex Reward Store:** Manual redemption in V1.

### MVP Success Criteria

- **Data Integrity:** Reliable separate handling of external (Calendar) vs. internal (Chores) data.
- **Latency:** < 2 seconds for internal state changes (Task Complete -> App Notification).
- **Adoption:** Daily usage of the internal Chore system by participants.

### Future Vision

A fully proactive "Family Operating System" where the house helps run itself. Future versions will include a conversational agent (WhatsApp) to add tasks via natural language, a fully digital reward redemption store, and "Smart Suggestions" that propose timers based on routine patterns (e.g., "It's 7 PM, start 'Bedtime Routine'?").

<!-- Content will be appended sequentially through collaborative workflow steps -->
