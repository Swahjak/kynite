# Market research — family organisers, family hubs and chore/reward apps

Compiled **16 August 2026**. A snapshot of the products a Dutch, self-hosted,
wall-mounted family hub competes with or borrows from, plus the evidence base
under the reward mechanics Kynite already ships.

**Coverage.** Wall-display hardware (Skylight, Hearth, Cozyla, Qudoo,
Apolosign, DAKboard, Mango, MagicMirror², Echo Show, Nest Hub); organiser apps
(Cozi, FamilyWall, TimeTree, Maple, Picniic, Klender, Famanice, SHUBiDU, Jam);
chore/allowance/gamification apps (OurHome, S'moresUp, Homey, BusyKid,
Greenlight, GoHenry/Acorns Early, RoosterMoney, Tody, Sweepy, Nipto,
Flatastic, Habitica, Finch, Goally, Brili, Choiceworks); the 2025–26 AI-first
wave (Sense, Calendara, Plannie, KIN, Homsy, Ohai); platform products (Apple
Family Sharing, Google Family Link, Microsoft Family Safety); and the Dutch /
Belgian cluster (Qudoo, Klender, Heitje voor een Karweitje, Growly,
Tasks 'n Chores, Chore Boss, Koiny, NeatKid, MissionZebra).

> **Staleness warning.** This is a snapshot of a market that moves fast.
> Prices, tiers, paywall lines and even product existence change within months —
> three funded products in this exact space died or were absorbed in the 18
> months before this survey. **Re-verify every price, tier and feature claim
> against the vendor's own page before acting on it.** Treat anything here as
> older than a quarter with suspicion.

---

## How to read this

### Source grading

Two grading schemes were used by the underlying research and both are preserved
on every claim carried across.

**Competitor survey:**

- **[VERIFIED-PRIMARY]** — read off the product's own site, docs, help centre,
  pricing page or app-store listing.
- **[SECONDARY]** — review sites, press, forums, app-store user reviews.
  Sub-tagged **[SECONDARY-COMPETITOR]** where the source is a rival vendor's
  content marketing.
- **[UNCONFIRMED]** — could not be nailed down; a lead, not a fact.

**Chore/reward and evidence research:**

- 🟢 **Primary** — the product's own docs/UI, or a peer-reviewed study.
- 🟡 **User report** — reviews, blogs, forum posts. Anecdotal, directional only.
- 🔴 **Marketing / SEO content** — a competing app's blog. Unsourced advertising.
- ⚠️ **Unverifiable** — a statistic quoted with no traceable source.

For the psychology section specifically: **[A]** peer-reviewed research,
**[B]** practitioner/clinical guidance from a credible body, **[C]** opinion,
advocacy or anecdote.

**A vendor's marketing page is evidence that a feature is advertised, not that
it works.** Several of the loudest claims in this category — "ChoreAI saves
parents 8 hours a week", "AI-verified photo proof" — are vendor assertions with
no methodology and no independent testing behind them.

### Limits of this survey — read before drawing conclusions

- **Reddit was completely unreachable** during the research (direct fetch,
  `old.reddit.com`, the `.json` endpoints and a proxy all refused; the search
  tool refuses `reddit.com` outright). Reddit is the richest source of family-app
  complaints in existence, so **complaint *rankings* below are indicative, not
  measured.** They lean on Apple App Store review feeds, Capterra, Hacker News,
  the Home Assistant forum and vendor help-centre docs.
- **Trustpilot, Amazon, Google Play review sections, justuseapp and Slickdeals
  were also blocked** (403 / CAPTCHA). Every star-rating figure sourced from
  those is second-hand.
- **A `?` in the feature matrix means unknown, not "probably no."** Absence of a
  `✓` is not evidence of absence. Only cells corroborated by a
  [VERIFIED-PRIMARY] entry should be treated as verified.
- A large share of "best family calendar app 2026" articles are written by
  competitors in this exact cluster. Their claims about rivals' weaknesses pick
  real sore points but are adversarial.
- The market is US-centric and so is the source base. Dutch coverage rests on a
  handful of primary vendor pages, iCulture, oudersvannu and Dutch press.

---

## Part 1 — The landscape

### 1.1 Display hardware (the direct format competitors)

| Product | Form | Price | Subscription |
|---|---|---|---|
| **Skylight** Calendar 2 / Calendar Max | 15" / 27" appliance | $279–$629 [VERIFIED-PRIMARY] | Calendar Plus **$79/yr** |
| **Hearth Display** | 27" portrait | $599–$699 [VERIFIED-PRIMARY] | **$5.76–$9/mo, required even to set up** |
| **Cozyla Calendar+ 2** | 15.6"–32", Android + Play Store | $349–$899 | **none** |
| **Qudoo (NL)** | 24" | **€599** | free tier, €5,99/mnd, or **€99 eenmalig (lifetime)** |
| **Apolosign** | 15.6"–21.5", Amazon tier | ~$200–400 | **none**; "Dual-Mode" kiosk↔Android toggle |
| DAKboard / Mango / FamDisplay | BYO screen, software | $0–$80 hardware | $5.99–$9.99/mo |
| MagicMirror² | DIY, Raspberry Pi, ~23.5k GitHub stars | hardware only | none |
| Echo Show / Nest Hub | smart display | $90–$400 | none |

Category leader is Skylight (claims 1.3M+ families [SECONDARY]). The appliance
tier is locked-down single-purpose hardware; Cozyla and Apolosign are general
Android tablets with a calendar skin, which is a genuine architectural fork —
flexibility versus a kid opening YouTube.

**Google's Nest Hub is the cautionary tale**: Hub Max discontinued from direct
sale May 2025, unrefreshed since 2019, and Google has progressively deleted apps
until Calendar and Reminders are gone [SECONDARY]
(https://9to5google.com/2026/01/30/google-nest-hub-apps-have-mostly-disappeared-over-the-years/).
Platform abandonment is now something families price in.

### 1.2 Organiser apps

**Cozi** is the incumbent (4.8★ from ~396K iOS ratings [VERIFIED-PRIMARY]);
free/ad-supported, Gold $39/yr, Max $79/yr. **FamilyWall** ($44.99/yr) bundles
messaging, location, budget and a document vault. **TimeTree** is very large in
DE/NL (~93.5k German ratings) with per-event chat threads as its signature.
**Jam** is app-only despite the hardware-sounding name — `jamfamily.com` is a
parked for-sale domain [VERIFIED-PRIMARY].

Three products in this cluster died or were absorbed within ~18 months, which is
the single most important fact in the survey:

- **Maple sunsets 31 December 2026** — team acqui-hired by Wander, all data
  deleted on that date [VERIFIED-PRIMARY, growmaple.com]. Its migration cohort is
  actively being fought over by Sense, Plannie and Calendara.
- **Picniic** effectively abandoned; last Android update March 2021; users report
  losing data stored in its "Info Locker" [SECONDARY].
- **Milo** dead (domain parked, for sale at $4,700 [VERIFIED-PRIMARY]);
  **Yohana (Panasonic)** shut down 30 September 2025 [SECONDARY].

### 1.3 Chores, allowance and gamification

- **OurHome** was the reference free chores+points+calendar app and is the
  template most competitors copied. Unmaintained since ~2020, unpublished from
  Google Play ~Sept 2023, servers unreliable, years of family data stranded
  🟢/[SECONDARY]. Its installed base is the largest unserved cohort in the cluster.
- **S'moresUp** — points ("S'mores"), penalty deductions, charity redirection,
  a "ChoreAI" auto-assigner ⚠️, and a family social feed. $4.99/mo.
- **Homey** — the most opinionated economy design: explicit
  **"responsibilities" (unpaid, expected) vs "jobs" (paid)**, real bank
  transfers, interest, fines, IOUs, photo-proof-before-payment.
- **Fintech tier** — Greenlight ($5.99–$19.98/mo), GoHenry/Acorns Early
  (Barclays acquiring the UK business late 2026), BusyKid, NatWest RoosterMoney
  (whose **Star Chart from age 3** is the clearest example of age-tiered
  currency: stars → pocket money → card). Once real money enters, the complaint
  profile flips from motivation to fintech reliability and fees.
- **Household cleaning** — **Tody** (decay model: tasks age toward dirty, nothing
  is ever guilt-inducing "overdue"), **Sweepy** (task weight 1–3, effort score,
  leaderboard, automatic workload distribution, "give me an easy win" filter),
  **Nipto** (weekly competition with a season reset), **Flatastic** (rotation
  algorithm).
- **Habitica** — the deepest gamification model in existence: HP damage, death,
  XP/levels/classes, party quests where your misses damage teammates, and
  uniquely a **hidden per-task value that decays as you stay consistent**, so a
  reliably-done task pays progressively less. That anti-inflation damper is the
  most under-copied mechanic in the category.
- **Finch** — the anti-Habitica, stating as policy that the pet never dies and
  missing a day costs nothing 🟢.
- **Neurodivergent-focused** — Goally (locked-down device, visual schedules,
  per-step timers, video modelling), Brili, Choiceworks ($12.99 one-time; schedule
  / waiting / feelings boards).

### 1.4 The 2026 AI wave

A dense cohort — Sense, Calendara, Plannie, KIN, Homsy, Nori, OurCal, Ohai —
converging on one thesis: the bottleneck is manual entry, so ingest school
flyers, emails and PDFs with AI. Skylight (Sidekick/Magic Import), Hearth
(Helper, SMS-based), Cozi Max and Maple all shipped a version of it.

Two reads: **photo/email ingestion is now table-stakes messaging rather than a
differentiator**, and **"true two-way Google sync" is being used as an attack
weapon against Cozi** — which confirms it is the market's recognised sore point.

The cautionary case is **Ohai.ai**, where an assistant that *claims to have
completed tasks it hasn't* destroyed trust faster than any missing feature could
[SECONDARY]. In a household tool a silent failure is worse than a gap.

### 1.5 EU / NL specifics

- **Qudoo (qudoo.nl)** is the direct Dutch competitor and owns the local moat:
  **Magister, Parro, Social Schools and SomToday** import alongside
  Google/Outlook/Apple [VERIFIED-PRIMARY]. Also: profiles typed Adult / Child /
  **Pet**, mandatory profile photos, Qudoo-points tasks and routines, a reward
  system, multiple timers, and a privacy mode that turns the screen into a photo
  frame. Hardware-gated at €599 with only ~28 App Store ratings (4.5★), though
  Trustpilot/Google sit at 4.7 [SECONDARY] — praised specifically for children
  with autism.
- **Klender (NL)** — the local app-tier incumbent, €29,99/jaar, Dutch-only UI,
  explicitly "geen datahonger, geen tracking". Its **"brengen/halen"** field on a
  child's event is a genuinely local idea seen nowhere else. Google import only,
  no chores, no stars.
- **Heitje voor een Karweitje** — the closest NL chore competitor: chores,
  zakgeld, screen time earned as redeemable minutes, parent approval on
  everything, EU servers, GDPR, **no ads for accounts aged 16 and under**, free
  or €9,99/jaar [VERIFIED-PRIMARY].
- **Growly** (€4,99 eenmalig, spaarpot met wekelijkse rente), **Tasks 'n Chores**
  (NL UI, parent-chosen reward currency, tablet mode), **Chore Boss: Zakgeld
  Tracker**, **Koiny** ("missies"), **NeatKid**.
- **Skylight does not speak Dutch** [VERIFIED-PRIMARY,
  https://skylight.zendesk.com/hc/en-us/articles/35783081774619-Supported-Languages]:
  "The Skylight Calendar and Skylight App support English as the language for
  user interfaces" and "the onscreen keyboard on the Calendar device only
  supports English text entry" — on a device whose premise is a child walking up
  and tapping it. It also does not ship to NL (US/CA/AU/UK storefronts only), and
  the Dutch App Store review feed for the Skylight app returns **zero entries**
  [VERIFIED-PRIMARY].
- **Parro publishes an iCal feed** [VERIFIED-PRIMARY, parnassysouders.zendesk.com],
  so a plain ICS-subscribe field delivers most of Qudoo's school moat with no
  partnership required. Parents explicitly ask for *subscribe*, not *import* —
  imported ICS files never update [SECONDARY].
- **No vendor in this survey makes an EU data-residency claim** for family
  organiser data. That is an unoccupied position rather than a documented
  complaint.

---

## Part 2 — Table stakes

Present in essentially every product. Shipping them buys nothing; missing them
gets noticed.

1. Shared multi-member calendar with **per-member colour coding**. Products are
   judged on how many members/colours, not whether the feature exists.
2. Day / week / month / agenda views, month being the family default on displays.
3. **Import** from Google / Apple / Outlook. (Import is table stakes; write-back
   is not — see differentiators.)
4. Recurring events and recurring chores.
5. Task/chore assignment to a named member.
6. A shared shopping/grocery list — the second-most-used surface after the
   calendar in most reviews.
7. A companion mobile app, and the near-universal pattern that **the phone is for
   input, the wall is for reading**.
8. Push/email reminders.
9. Photo screensaver / ambient mode on every wall display without exception.
10. Weather widget on every wall display.
11. Some points-or-stars chore layer. No longer differentiating; only its
    *mechanics* are.
12. Meal planning + recipe box in the app tier.
13. Celebration feedback on completion (confetti, animation, sound).
14. Scheduled sleep / screen-off hours on hardware.

---

## Part 3 — Differentiators

Ordered roughly by how load-bearing the evidence suggests they are.

1. **NL school-system import (Magister / Parro / Social Schools / SomToday) —
   only Qudoo.** The strongest moat in the Dutch market; no international player
   touches it. Largely reachable through plain ICS subscription.
2. **True two-way calendar write-back.** Far rarer than the marketing implies.
   **Cozi verifiably has none, by design** — two independent read-only ICS feeds,
   inbound latency ~1 hour, outbound up to 24–48 hours to Google
   [VERIFIED-PRIMARY, cozi.com/using-cozi-with-other-calendars]. Skylight has it
   **for Google only**, it must be chosen at setup, and the documented remedy for
   getting it wrong is to delete the calendar and re-sync [VERIFIED-PRIMARY].
   Qudoo is read-only inbound, write-out for its own events.
3. **Step-level routines** — a routine decomposed into ordered, individually
   checkable steps. Only the neurodivergent-focused apps (Goally, Brili,
   Choiceworks) and partially Skylight/Hearth.
4. **Per-step visual countdown timers.** Goally and Brili own this; Skylight has a
   weaker version; absent from the mainstream organisers.
5. **Anti-inflation damper on reward value** — only Habitica. Point inflation is a
   named failure mode of every star economy and nobody else addresses it.
6. **Decay / aging task model** instead of a fixed schedule — only Tody, partially
   Sweepy. Solves the "recurring task guilt-tripping you at 6am" complaint.
7. **Automatic fair workload distribution / rotating roster** — OurHome, Nipto,
   Flatastic, Sweepy. Absent from every wall display; Greenlight users explicitly
   ask for it.
8. **"Up for grabs" unassigned chore pool** kids claim from — essentially only
   Skylight. Repeatedly requested elsewhere; a Greenlight parent asks in as many
   words for "one large list of chores and let kids pick and choose, instead of
   divvying out chores for four kids 7 days a week" [SECONDARY].
9. **Real-money payout** — only the fintechs. No organiser bridges to one.
10. **Penalties / negative points (response cost)** — Habitica, OurHome,
    S'moresUp, ClassDojo. Clinically evidenced for ADHD, commercially avoided,
    and explicitly advised against by the AAP for home charts.
11. **Kiosk ↔ full Android toggle** — Cozyla and Apolosign. Directly addresses
    "I paid €600 for a locked-down tablet".
12. **Privacy mode / hidden events** — keeping surprises off a screen the whole
    household reads. Only Skylight clearly, plus Qudoo's photo-frame mode. A
    wall-display-specific need pure apps never encounter.
13. **Emotional check-in / feelings board** — Skylight, Hearth, Goally,
    Choiceworks.
14. **One-time / lifetime purchase instead of a subscription** — Qudoo (€99),
    Cozyla, Apolosign, Growly (€4,99), Choiceworks ($12.99), Tody. Subscription
    resentment is the #1 complaint theme in the entire category, so this is a
    positioning differentiator as much as a feature.

### The absences — what nobody has

The most interesting part of the survey is what no surveyed product ships.

- **Offline / local-first operation — nobody.** Every commercial product is fully
  Wi-Fi-dependent, with a cached display at best. Verbatim [VERIFIED-PRIMARY,
  App Store, "TXKowboy", 31 Dec 2025]: *"The app is useless without cellular or
  WiFi because there is no local storing of data for offline viewing."* Reinforced
  by *"The wifi connection died after 2 years, and this calendar was a lifeline
  for a functioning household"* [SECONDARY]. This is the #2 unmet need in the
  complaint data and the loudest failure mode of a wall panel.
- **Self-hosting / no vendor cloud — effectively nobody** (DAKboard partially;
  MagicMirror² and Skylite UX in the DIY scene). The entire r/selfhosted and Home
  Assistant response to this category is "build it yourself", motivated by data
  ownership plus vendor-abandonment risk. The DIY reference build — 15" HP Engage
  touchscreen plus a spare mini-PC — treats **two-way Google Calendar sync and
  event creation from the touchscreen** as its headline achievements
  [VERIFIED-PRIMARY, community.home-assistant.io/t/diy-family-calendar-skylight/844830].
- **A "what changed since I looked" surface — nobody.** No product surveyed has a
  change feed, badge or counter. Google's own documentation states it outright
  [VERIFIED-PRIMARY]: *"You won't get notifications when a family member creates,
  edits, or deletes an event."* FamilyWall users get a push and then cannot find
  what it referred to. Named independently as a gap by two research clusters.
- **A real kid role with scoped permissions — effectively nobody in the organiser
  tier.** Cozi states outright it has none [VERIFIED-PRIMARY, cozi.com/faq]: no
  restricted-access option exists, all 12 members share one password and every one
  of them can view/add/edit/**delete** anything. Google's family calendar is flat
  all-editors. Skylight substitutes a **device** PIN for a permission model — a kid
  "profile" there is a colour and an avatar, not a role. Maple could not give a
  member their own tasks without full household membership. Famanice demands an
  email per child and rejects duplicates. Picniic's babysitter share was the only
  genuinely scoped role found, and Picniic is dead. The structural argument
  [SECONDARY, mynestboard.com]: *"Google Calendar assumes everyone has an email
  address and a Google account. A seven year old does not… so the 'family'
  calendar quietly becomes the parents' calendar."*
- **Fair rotation as a first-class primitive — barely anywhere.** Rotation is
  discussed constantly in parenting content and implemented on paper chore wheels,
  but among the big consumer apps only S'moresUp's premium auto-allocation and the
  flatshare apps do it. (Note: the two research files disagree on how widespread
  this is — see the contradictions note at the end.)
- **Any implementation of reward *fading*.** Every practitioner body prescribes a
  planned exit from a reward chart. No surveyed app implements one.
- **EU data residency.** No vendor claims it.

---

## Part 4 — Gap analysis against Kynite

Baseline is the read-only capability inventory of branch `greenfield`: 14 slices,
two-way Google Calendar sync, ICS subscriptions, event taxonomy, routines with
ordered steps and per-step timers, an append-only star ledger, a reward catalogue
with a redemption approval flow, savings goals, one-off tasks, ad-hoc and
routine-bound timers, a hub kiosk with device pairing, caregiver share links, SSE
realtime, a PWA with an IndexedDB schedule cache and a completion outbox, web
push, Dutch holidays, and a 21-capability permission matrix.

### 4.1 Real gaps — they have it, we do not, and it plausibly matters

| Gap | Who has it | Why it might matter here |
|---|---|---|
| **"What changed?" feed** | nobody | The category's blank space, and Kynite already writes an `event_log`. |
| **Weather on the hub** | every wall display, without exception | Table stakes for the format; the hub is the one surface where it is expected. |
| **Guided NL school-feed setup** | Qudoo | The generic ICS machinery exists; what is missing is Parro/Magister/Social Schools presets and copy. |
| **Push when a participant acts** | most organisers | FR22 is unimplemented and "no milestone owns it" — a known carry-forward, not a new idea. |
| **Shared shopping list** | essentially everything | The second-most-used surface in the category after the calendar. Needs a new table. |
| **Ambient photo / screensaver mode** | every wall display | On hardware this is what justifies the screen when nobody is reading it. |
| **Unassigned / claimable chore pool** | Skylight | `routine.ownerMemberId` is currently required, so this is a schema change. |
| **Fair rotation with a visible cycle** | OurHome, Nipto, Flatastic, Sweepy | Absent from every display product; procedural fairness matters more than equal outcomes. |
| **Decay-state household chores** | Tody, partly Sweepy | Child routines want daily recurrence; *household maintenance* wants decay. Probably a different object. |
| **Quota recurrence ("3× per week")** | OurHome | The `schedule` jsonb can absorb it. |
| **Photo/email/PDF → event ingestion** | Skylight, Hearth, Cozi Max, Jam, and the whole 2026 wave | Likely table stakes within a year. Already on the PRD's Phase 2 as natural-language entry. |
| **Meal planning + recipes** | Cozi, FamilyWall, Skylight, Hearth, Qudoo, Maple | Genuinely universal in the app tier. Heavy; needs new tables. |
| **Data export** | DAKboard, Greenlight, Habitica, the platforms | Self-hosting moots the *lock-in* argument but not the "give me my data as a file" one. |
| **Feelings / emotional check-in board** | Skylight, Hearth, Goally, Choiceworks | Rare and differentiating; uncertain value for this household. New table. |
| **Anti-inflation damper on star value** | Habitica only | Point inflation is a named failure mode. Kynite's graduation is a *manual* answer to the same problem. |

Two things that are **not** features but block a fair comparison, and should be
read alongside this table:

- **`completion:write` and `redemption:request` are family-wide.** Any child tap
  or hub tap can credit *any* member, and a child can request a redemption that
  drains a sibling's balance. Both were flagged for own-scoping in milestone
  reviews; neither is done. This directly undercuts the "we have a real kid role,
  nobody else does" claim in §4.3 — the role exists and is enforced at the top of
  every Server Action, but two of its cells are wrong.
- **Prod Google sign-in is blocked**: `https://kynite.app/api/auth/callback/google`
  is not yet an authorised redirect URI.

Also worth correcting: the root `CLAUDE.md` says the project integrates **Google
Tasks**. It does not — there is no code, schema or OAuth scope for it, and the
`tasks` slice is a native table. No surveyed competitor has Google Tasks sync
either, so this is a documentation defect rather than a gap.

### 4.2 Deliberately not ours — a competitor having it is not a gap

`docs/rebuild-parity.md` records 21 dropped items with owner sign-off, several
refused *on evidence* via `docs/research/psychology-and-product-principles.md`.
Re-proposing these is re-litigating a decision.

| Competitor feature | Who has it | Kynite's refusal |
|---|---|---|
| **Streaks** | Skylight, Hearth, Habitica, OurHome, S'moresUp, most habit apps | Refused: streaks exploit loss aversion, with documented anxiety and compulsive checking from all-or-nothing breaks. Enforced in code — a savings goal bar "only ever fills". |
| **Levels / XP / avatar progression** | Habitica, partly S'moresUp, Sweepy | Refused in the same cut. |
| **Negative marking, penalties, response cost** | Habitica (HP loss), OurHome, S'moresUp, Homey (fines), ClassDojo | Refused: no red X, no "missed"/"overdue" state, no negative balance. `grace` is deliberately not called "missed". Pinned by `tests/unit/no-negative-marking.test.ts`. Independently the AAP position (§5). |
| **Star removal** | OurHome, Homey, S'moresUp | Refused structurally: `stars:remove` is `deny` in every column and `CHECK (amount > 0)` at the database. |
| **Sibling leaderboards / weekly-stars ranking** | OurHome, S'moresUp, Habitica, Sweepy, Nipto | Refused: PRD FR13 — no surface anywhere ranks or compares one child against a sibling. |
| **Money rewards, allowance, banking, financial-literacy lessons** | Greenlight, GoHenry, BusyKid, Homey, Bling, RoosterMoney, Growly, Heitje | Refused: ~1/3 of parents deliberately avoid money rewards; paying for household contribution reframes family membership as a labour transaction. Presets are privileges and experiences; nothing on the savings card converts to money. |
| **Parent-attributed messages on the display** | Hearth, FamilyWall, S'moresUp | Refused: PRD FR30 — the hub is a neutral board, "never a parent's mouthpiece". Pinned by `tests/unit/i18n/hub-voice.test.ts`. |
| **Child logins / per-member kid accounts** | Famanice, the fintechs, the platforms | Dropped deliberately; children never log in, members are decoupled from users. |
| **Month grid / 7-day week board on the wall** | most displays | Dropped: "a seven-column grid at six feet is unreadable". `hub_view` is limited to `day` and `agenda` on purpose. |
| **High-conflict co-parenting** | OurFamilyWizard | Explicitly out of scope. |
| **Manual refresh, quick-action FAB, help route** | various | Dropped: "manual refresh has no meaning on a surface fed by SSE". |

Note the tension worth being honest about: several of these refusals are backed
by evidence that is real but *narrower* than the refusal implies. Response cost,
for example, is genuinely effective in the clinical literature and merely
disliked and discouraged in home settings — the refusal is defensible on
practitioner guidance plus product values, not on a finding that it does not work.

### 4.3 Looks like a gap, is not

- **Subscription pricing.** The #1 complaint theme in the entire category, and
  specifically that *the chores/rewards layer the children touch* is the paywalled
  one (Skylight Plus, Hearth's entire mobile app). Self-hosting structurally
  eliminates the top complaint in the market. Not something to build; something to
  not undo.
- **Vendor abandonment and data lock-in.** ChoreMonster dead 2018, OurHome rotting
  since 2020, Picniic abandoned, Maple sunsetting, Milo parked, Yohana closed,
  Google deleting Nest Hub calendar features. Self-hosting is the strongest
  possible answer. (A data *export* is still worth having — §4.1.)
- **Offline operation.** The category's #2 unmet need; nobody has it. Kynite has a
  Serwist service worker with hub-scoped precache, an IndexedDB schedule cache and
  hub state mirror, an offline indicator derived from the SSE connection rather
  than `navigator.onLine`, and a completion outbox that survives a closed tab.
  Caveat: the outbox covers **completions only** — timers, tasks and events have no
  offline queue, and the `offline` i18n namespace has exactly one key.
- **A real kid role.** Kynite has a 21-capability matrix over six principal
  columns with `allow`/`deny`/`own`/`scoped`/`busy-only` grades, failing closed,
  enforced by `assertCan()` at the top of every Server Action and pinned by tests.
  Nobody in the organiser tier has anything comparable. **Subject to the two
  family-wide defects in §4.1.**
- **Privacy mode / hidden events.** Skylight's differentiator; Kynite renders
  events on a `private` calendar as busy-only ("bezet") to principals without
  `calendar:view_private`, and the device principal's grade for that capability is
  `busy-only` by design.
- **Step-level routines and per-step timers.** Only Goally/Brili/Choiceworks have
  these, and they are the strongest-evidenced designs for ADHD/autism. Kynite has
  ordered steps with icons, optional per-step `timerSeconds`, and a
  server-authoritative timer clock.
- **True two-way Google sync.** The market's #1 unmet need. Kynite has incremental
  pull with sync tokens and 410 recovery, local writes pushed back, LWW conflict
  resolution, echo suppression, tombstones and push channels. Honest caveat:
  `pendingSyncAt` is advisory, `upsertEvent` overwrites unconditionally on incoming
  Google changes, and a queued local edit can be clobbered before its push lands.
  That is a narrower bug than Cozi's architectural absence, but it is not nothing.
- **A "graduation"/fading mechanic.** No app in the category implements fading;
  every practitioner body prescribes it. Kynite's per-routine graduation stops
  paying stars while keeping the ones already earned, and wears a badge rather than
  reading as a downgrade.
- **Caregiver / babysitter scoped access.** Picniic's only-of-its-kind feature,
  dead with the product. Kynite has hashed share tokens, viewer/contributor roles,
  scope by member and calendar, expiry, revocation and usage counters.
- **Birthday tracker** — Cozi paywalls it behind Gold; Kynite computes birthdays in
  the holidays module.
- **Sub-second completion feedback.** Hearth's documented ~5-second post-celebration
  lag is cited as the reason children disengage. Kynite treats <100ms optimistic
  tap as a hard NFR.
- **Photo proof of completion.** OurHome, S'moresUp, Homey, ChoreSplit and a whole
  new generation ship it. It is a poor fit here and arguably already solved: there
  is no per-child camera at a shared wall display, it imports a surveillance
  dynamic, and photographing "bed made" is trivially gamed. The wall display's
  **visibility** is the accountability mechanism — everyone can see what was
  claimed — which is the third regime Skylight, Tody and most successful households
  actually rely on.
- **Sleep hours, ambient brightness, PIN lock, kiosk toggle.** Hardware/OS
  concerns on a BYO-screen product; Fully Kiosk Browser and the tablet's own
  settings own them. (Burn-in and battery swelling are real: prefer LCD over OLED
  for always-on, and design for a mains-powered or charge-managed device.)
- **Dutch UI.** The single biggest structural gap in the NL market for the
  category leader; the default here.

---

## Part 5 — Evidence on rewards and children

This section states the evidence and its limits. It is **not** an argument to
change anything: the per-step payout model is a deliberate owner decision, and
the evidence below neither vindicates nor condemns it.

### 5.1 What token economies actually have behind them

Token economies come out of operant conditioning and applied behaviour analysis:
a conditioned generalised reinforcer bridges the delay between the behaviour and
the back-up reinforcer the child wants. Eight components matter and are usually
under-reported: target behaviours, token type, **token production rate**,
**exchange production rate**, back-up menu, exchange schedule, response cost
(optional), and a **fading plan**.

- **Soares, Harrison, Vannest & McClelland (2016)** [A], *School Psychology
  Review* 45(4) — meta-analysis of single-case classroom research: 28 studies, 88
  phase contrasts, weighted mean effect ≈ **0.82** (a single-case metric — do not
  compare to group-design *d*). Larger for ages 6–15 than 3–5, larger for
  behavioural than academic targets. https://eric.ed.gov/?id=EJ1141302
- **Kim, Fienup, Oh & Wang (2022)** [A], *Behavior Modification* — 24 K-5
  studies, large effects, with token production rate and exchange production rate
  varying systematically by setting. https://pubmed.ncbi.nlm.nih.gov/34784784/
- **Maggin, Chafouleas, Goddard & Johnson (2011)** [A], *Journal of School
  Psychology* — the counterweight: this literature **does not meet What Works
  Clearinghouse criteria** for an evidence-based practice, on design-quality
  grounds; only ~19% of articles described all primary components replicably.
  https://www.sciencedirect.com/science/article/abs/pii/S0022440511000495

**The caveat that matters more than the numbers:** this is overwhelmingly
single-case design, run in classrooms and clinics by trained implementers, often
with children who have diagnosed behaviour difficulties. Single-case effect sizes
are inflated relative to group designs and publication bias is severe. **A
home-based, parent-run, app-mediated star chart for typically developing children
is essentially unstudied.**

Two known limits [A/B]: **generalisation** (gains rarely transfer to settings
where the tokens are not running) and **maintenance after withdrawal** (unfaded
systems extinguish; every recommended mitigation is a *fading* technique).

### 5.2 The undermining effect

**Deci, Koestner & Ryan (1999)** [A — strong], *Psychological Bulletin* 125(6),
627–668; **128 experiments**.
https://home.ubalt.edu/tmitch/642/articles%20syllabus/Deci%20Koestner%20Ryan%20meta%20IM%20psy%20bull%2099.pdf

| Reward type | Free-choice intrinsic motivation, *d* |
|---|---|
| Engagement-contingent tangible | **−0.40** |
| Completion-contingent tangible | **−0.36** |
| Performance-contingent tangible | **−0.28** |
| Unexpected tangible | ~null |
| Task-non-contingent | ~null |
| **Verbal praise / positive feedback** | **positive** |

Two moderators are directly load-bearing for a children's app: tangible rewards
were **more detrimental for children than for college students**, and verbal
rewards were **less enhancing for children than for college students** (praise is
not a free lunch either — plausibly because children read adult praise as
controlling).

So the effect is **conditional, not universal**: it needs the reward to be
expected, tangible, and contingent on doing the activity. That is precisely the
shape of a star-per-chore economy.

**The rebuttal** [A]. Cameron & Pierce (1994) and Eisenberger & Cameron (1996),
"Detrimental effects of reward: reality or myth?", argued undermining is a narrow,
avoidable artefact. Eisenberger, Pierce & Cameron (1999) found reward for a
**vague** standard reduced free-choice behaviour, reward for meeting an
**absolute** standard did not and raised self-reported interest, and reward for
**exceeding others** raised both. https://pubmed.ncbi.nlm.nih.gov/10589299/
The 2001 exchange in *Review of Educational Research* 71(1) is the canonical
round two. Fair reading of where it landed: **both camps agree the effect is real
and conditional**; they disagree how wide the conditions are. Nobody credible now
claims all rewards always destroy motivation, and nobody credible claims expected
tangible rewards are risk-free for already-interesting tasks.

**Cerasoli, Nicklin & Ford (2014)** [A], *Psychological Bulletin* 140(4), 40-year
meta-analysis, k=183, N=212,468: intrinsic motivation is a medium-to-strong
predictor of performance (ρ ≈ .21–.45) **and remains predictive when incentives
are present**. Incentives that are directly performance-salient weaken intrinsic
motivation's role for **quantity**; intrinsic motivation dominates for
**quality**. Read: the two operate **jointly**, not zero-sum — with a
quantity/quality split that maps neatly onto "chores done" versus "chores done
well". https://pubmed.ncbi.nlm.nih.gov/24491020/

**Warneken & Tomasello (2008)** [A], *Developmental Psychology* — 20-month-olds
given a **material** reward for helping helped less afterwards than those given
**social praise** or **nothing**. The most directly relevant experiment in the
review, since helping/contributing is exactly the behaviour class — but small-N,
lab-based, single-session, narrow age band.
https://pubmed.ncbi.nlm.nih.gov/18999339/

**Kohn** [C]. *Punished by Rewards* (1993/2018) is advocacy synthesis, not primary
research. He is directionally supported by DKR-1999 for the specific case of
expected tangible rewards on already-interesting tasks and **over-generalises
everywhere else**: he does not distinguish reward types, treats the free-choice
measure as decisive, and offers no account of the strong applied results with
children who need scaffolding. The formal critique — "Punished by
Misunderstanding", *The Behavior Analyst* — documents five misrepresentations of
behaviour analysis. https://link.springer.com/article/10.1007/BF03392789
He is a useful challenge, not a citation.

### 5.3 Per-step versus per-task payout

**Direct evidence: none.** No study compares "star per step" with "star per
completed task" in a family chore context, in either direction. Everything below
is extrapolation from the behaviour-analytic literature and is labelled as such.

1. **Density and immediacy help acquisition.** Continuous reinforcement produces
   the fastest acquisition of a new behaviour. Finer granularity ≈ denser, more
   immediate reinforcement ⇒ better for a routine the child *cannot yet do*.
2. **Intermittent reinforcement produces resistance to extinction.** The
   partial-reinforcement extinction effect is among the most replicated findings
   in the operant literature. A behaviour trained on continuous reinforcement
   collapses fast when reinforcement stops ⇒ worse for long-run maintenance **if
   you never thin**.
3. **Therefore ABA implies a trajectory, not a setting**: dense/per-step at
   acquisition → thin to per-task → thin to intermittent/variable → fade to
   natural consequences. Triple P prescribes the same in plainer words — make
   rewards less predictable, then phase the chart out.
4. **Ratio strain** is the failure mode of thinning too fast: too much behaviour
   per token collapses responding. Thinning must be gradual.
5. **Task analysis and chaining** are why per-step is attractive at all: a
   multi-step routine is taught by breaking it into a chain and reinforcing links.
   Per-step payout is the *teaching* configuration.

**And the honest counterweight:** the more a star is tied to *engagement* rather
than completion or quality, the closer it sits to DKR-1999's
**engagement-contingent** cell — the one with the **largest** undermining effect
(*d* = −0.40). Per-step payout maximises teaching efficiency and overjustification
exposure at the same time. That trade-off is real and the literature does not
resolve it.

Market context, for completeness: Skylight pays **per task**, and its own guidance
suggests 5–10 stars for a daily routine and up to 100 for a big one-off 🟢.
Per-step payout is an outlier in this market.

### 5.4 App-mediated reward systems

- **Sailer & Homner (2020)** [A], *Educational Psychology Review* 32 — gamification
  meta-analysis: **g = .49 cognitive** (k=19), **g = .36 motivational** (k=16),
  **g = .25 behavioural** (k=9). The behavioural effect — the one a chore app cares
  about — is the weakest and rests on nine studies.
  https://link.springer.com/content/pdf/10.1007/s10648-019-09498-w.pdf
- **Children's health-behaviour RCTs** [A]: 16 RCTs, 7,472 children 6–18 —
  gamification raised moderate-to-vigorous activity **SMD 0.15 (CI 0.01–0.29)**.
  Statistically significant, practically tiny. https://games.jmir.org/2025/1/e68151
- **Hamari, Koivisto & Sarsa (2014)**: 24 of 28 studies positive, but weak designs
  and short durations. Widely over-cited as "gamification works".

Four reasoned-but-unevidenced [C] hypotheses about digitising a paper chart, worth
stating as hypotheses: salience and expectedness go **up** (the exact DKR
moderators); leaderboards add sibling comparison, where the Eisenberger and SDT
lines predict **opposite** outcomes; automated tracking removes the parent from the
loop, trading the one reward type with a positive effect (praise) for the risky
one; and **fading is easy to build and easy to never build** — an app is unusually
good at keeping a token economy running past the point it should have been faded.
That last one is the sharpest ethical tension in the category.

### 5.5 Practitioner guidance [B]

Six credible bodies converge:

- **AAP / HealthyChildren** — rewards for when praise alone is not enough; stars
  for early school-age, points/contracts for older children; the child helps choose
  the rewards. Two explicit cautions: **"avoid penalties and demerits — these can
  be humiliating or discourage your child from even trying"**, and **phase the
  programme out** as the behaviour internalises (a sign it worked is that the child
  forgets to ask for points).
- **AAP on ADHD** — parent training in behaviour management, including token
  systems, is **first-line treatment**, recommended before medication for under-6s.
  The strongest endorsement anywhere, and population-specific.
- **NHS (Betsi Cadwaladr)** — charts work best **ages 3–8**, one behaviour at a
  time, specific never vague; inconsistency is the main failure mode.
- **Triple P** — charts are explicitly short-term scaffolding, phased out by making
  rewards less predictable.
- **Incredible Years** — praise/attention primary, tangible rewards secondary and
  time-limited.
- **Raising Children Network** — same phase-out advice; fade by increasing the
  interval between rewards.

**Convergence:** rewards are legitimate *time-limited* scaffolding for specific,
currently-difficult behaviours; praise is the primary reinforcer; a planned exit is
part of the intervention; penalties are discouraged at home; charts are age-bounded.

**Tension to be honest about:** a permanent household star economy running on a
wall display is a different object from what that guidance endorses. Kynite's
per-routine graduation is the closest thing in the category to the prescribed exit
— and it is the only one.

### 5.6 Two zombie citations, debunked in place

- **"A Harvard study proves kids who do chores succeed."** [C — unsupported].
  **There is no Harvard study on chores.** The claim traces to Julie
  Lythcott-Haims' 2016 TED talk and *How to Raise an Adult*, which invokes the
  Harvard Study of Adult Development (1938–) rhetorically; the Grant Study did not
  measure childhood chores as a predictor and the talk cites no chores-specific
  analysis. Untangled at
  https://piccalio.com/blogs/journal/harvard-study-on-chores-untangling-the-research
  and https://raisinghealthyfamilies.com/harvard-study-hoax/ — despite which it is
  repeated verbatim by Inc., Motherly and dozens of parenting sites. **Do not use
  it, in product copy or anywhere else.**
- **"Gamified apps show 41% higher engagement in the first two weeks but 67%
  abandonment by week four (Stanford Persuasive Technology Lab)."**
  ⚠️ **Untraceable.** No such study could be found; it circulates via chore-app
  blogs (e.g. https://calmevo.com/does-habitica-work/). The cousin claim "most
  chore apps get abandoned by week two" is a vendor assertion with no source.
  **Do not repeat either number.**

Two adjacent claims worth handling carefully rather than discarding: **Rossmann
(2002, Minnesota)** — n=84, correlational, grey literature, and the load-bearing
citation under nearly every "chores → success" article; and **Tepper, Howell &
Gray (2022)**, a cross-sectional parent-report survey of ~207 parents that the
press ran as "children's chores improve brain function". No brains were measured
and reverse causation is fully live.

---

## Part 6 — Failure modes of this category

1. **The app becomes one adult's second job.** The best single source is MIT
   Technology Review, *"Chore apps were meant to make mothers' lives easier. They
   often don't."* (2022)
   https://www.technologyreview.com/2022/05/10/1051954/chore-apps/ —
   **86% of Cozi's users are women.** Sociologist Allison Daminger's point is the
   mechanism: much household labour is *cognitive* — anticipating, deciding,
   delegating — and task apps digitise only the **execution** layer, so the
   invisible half stays exactly where it was. Kate Mangino: apps become management
   tools rather than partnership tools. One subject abandoned Cozi in a week:
   *"It doesn't solve the problem: that you're nagging someone else or parenting
   your partner."* **Every configuration surface, approval queue and star price is
   work assigned to one adult.**
2. **Retroactive batch check-off.** The canonical honour-system failure. A parent's
   six-month Skylight review reports her daughters doing things anyway, forgetting
   to tick them, then marking a week's worth complete **when they wanted to cash
   in** 🟡. The same household had pegged 1 star = $0.25, which is what made
   retrospective invoicing worth the effort. Brili's equivalent, and the sharpest
   version of it [SECONDARY, Common Sense Media]: *"there is nothing built in to
   keep a kid from just swiping swiftly through tasks they haven't even completed
   in real life."* Per-step granularity makes a week of back-claiming more taps but
   more stars.
3. **Novelty decay — real, but not the way folklore says.** Rodrigues et al.
   (2022) [A], *International Journal of Educational Technology in Higher
   Education*, **N = 756 over 14 weeks**: the effect of gamification is U-shaped —
   positive at first, **declining from about week 4** for two to six weeks, then
   **recovering between weeks 6 and 10** as users familiarise.
   https://eric.ed.gov/?id=EJ1325797 So "the novelty wears off and it's over" is
   wrong; there is a trough and systems that survive it recover. Two implications:
   **judge retention at week 8+**, and the intervention that matters is whatever
   carries a family through weeks 4–10, not the onboarding delight.
4. **Reward fatigue / transactional children.** Parents report children beginning
   to ask "what do I get?" for every small request, including things previously
   done for free. 🔴/🟡 on prevalence (it recurs across vendor blogs, which is weak
   evidence), 🟢 on mechanism — it is exactly the overjustification prediction.
5. **Penalty mechanics backfire.** Habitica's HP loss converts a missed habit into
   an anxiety trigger, worse in a party where your misses damage others; users
   report social pressure and dropping out 🟡. The durable products have converged
   on non-punitive design (Finch states as policy that the pet never dies).
6. **Point inflation with no sink.** Balances grow past any reward a parent will
   honour. Only Habitica has an automatic damper; only Nipto has a periodic reset.
7. **Vendor abandonment.** ChoreMonster (2012–2018, Disney Accelerator alumnus,
   dead), OurHome, Picniic, Maple, Milo, Yohana. *"When it shut down, a lot of
   families lost their system."* The two most-loved products in this category both
   died. Longevity and export are trust levers.
8. **Never fading.** Every practitioner body treats a reward chart as time-limited
   scaffolding with a planned exit. **No app in this category implements fading.**
   Paper charts die naturally through parental neglect; an app is unusually good at
   keeping a token economy alive past its usefulness, and a subscription vendor has
   a commercial incentive to. Kynite's per-routine graduation is the exception in
   the surveyed set.
9. **Adjacent, and worth knowing:** adoption beats features (the most-upvoted take
   on Hearth is *"if your husband won't use a free shared calendar, why would he use
   the expensive shared calendar?"*); IA churn is punished hard (Cozi's month-view
   redesign, Maple's calendar-first navigation); notifications fail in **both**
   directions and both end with the user muting the app; on-device text entry is
   universally bad, so the wall surface must be optimised for read + one-tap; and
   the ClassDojo literature [A, Manolev, Sullivan & Slee 2019] warns that fixating
   on narrow countable metrics **skews the adult's own practice** — a display that
   counts steps pulls the household's attention toward step counts.

---

## Part 7 — Candidate features

Drawn **only** from the "real gaps" bucket in §4.1. Nothing here is a commitment,
a roadmap or a date. **The ordering is my judgement of value-to-effort, not a
finding** — reasonable people would reorder it, and the value half in particular
is a guess about one household.

### 1. A "what changed since I looked" surface

What it is: a feed or badge answering "what moved since I last looked at this?" —
new events, reschedules, completions, redemption requests.
Who does it: **nobody**, in any tier. Google documents the absence outright;
FamilyWall users get a push and cannot then find what it referred to.
Why here: it is the category's clearest blank space and it targets the exact
failure mode (notifications that under- or over-deliver, then get muted).
Data model: **cheap-ish**. `event_log` already carries 16 typed events with
actor/entity/patch payloads, and SSE already streams them. The obstacles are a
per-member "last seen" cursor and the nightly 7-day trim, which caps how far back
a feed can reach.

### 2. Weather on the hub

What it is: current conditions plus a short forecast on the wall surface.
Who does it: every wall display without exception.
Why here: the only genuinely universal display feature Kynite lacks, and the hub
is the surface where its absence is visible.
Data model: **no new tables** — an external API call plus a settings key. The work
is caching, failure behaviour and not breaking the offline story.

### 3. Guided Dutch school-feed setup

What it is: Parro / Magister / Social Schools / SomToday presets on top of the
existing ICS subscription flow, with instructions for finding the feed URL.
Who does it: **only Qudoo**, and it is their entire local moat.
Why here: Parro publishes an iCal feed, so no partnership is required; parents
explicitly ask for *subscribe*, not *import*, because imported files never update.
Data model: **cheap**. `icsSubscription` is 1:1 with a `calendar` and already does
ETag/Last-Modified conditional fetch, error surfacing and scheduled refresh. This
is presets, validation copy and possibly a `defaultType` mapping.

### 4. Push when a participant acts

What it is: notify the people attached to an event or routine when something is
created, moved or completed by someone else.
Who does it: most organisers, badly — Skylight has **no push at all**, which is
the loudest complaint in the display category; Google's family calendar sends no
change notifications; Cozi only notifies attendees.
Why here: FR22 is unimplemented and explicitly unowned by any milestone.
Data model: **no new tables** — VAPID push, `pushSubscription`,
`notificationPreference` and the pg-boss queues all exist; this is a fourth
notification kind plus a preference toggle. The design risk is over-delivery,
which is half the category's notification failure.

### 5. Shared shopping list

What it is: one or more shared lists with add/tick/clear, visible on the hub.
Who does it: essentially every organiser and every display.
Why here: the most-used surface after the calendar, and the loudest hole against
every competitor. Dutch caveat: a shared list here is judged against the Albert
Heijn and Picnic apps, not against Cozi.
Data model: **new tables** (list + item), but small and self-contained — arguably
a new slice following the `tasks` pattern.

### 6. Ambient photo / screensaver mode on the hub

What it is: family photos when the hub is idle.
Who does it: every wall display; paywalled on Skylight and Hearth.
Why here: it is what justifies an always-on screen when nobody is reading it, and
it doubles as a privacy mode (Qudoo turns the screen into a photo frame for
exactly that reason).
Data model: **new storage** — the repository has no attachment/blob concept at
all today, which is the real cost. A first cut pointing at a local directory or an
existing album URL would be much cheaper than building media management.

### 7. Unassigned / claimable chore pool

What it is: routines or chores with no owner that any child can claim for stars.
Who does it: essentially only Skylight ("Up For Grabs"); repeatedly requested
elsewhere, most sharply by a Greenlight parent with four children.
Why here: it converts assignment (parent work) into selection (child autonomy),
which is the mental-load argument and the SDT argument at once.
Data model: **schema change** — `routine.ownerMemberId` is currently required
precisely because a routine belongs to one person. Nullable owner plus a claim
transaction, and a decision about what "claimed" means across an occurrence.

### 8. Fair rotation with a visible cycle

What it is: a chore that passes to the next member automatically, with the
upcoming order shown.
Who does it: OurHome, Nipto, Flatastic, Sweepy; **absent from every display
product**.
Why here: a genuine market gap. The design point is that **visible fairness of
the mechanism matters more than equality of outcome** — showing "you, then Sanne,
then Tom" is as important as the algorithm. Four shapes exist in the wild:
per-occurrence, weekly ownership, a single household-wide order every chore walks
at an offset, and time-weighted.
Data model: **schema change**, and the more interesting design risk is what
happens when someone misses their turn — OurHome's rotation reportedly breaks the
whole schedule when a child misses their day [SECONDARY].

### 9. Decay-state household chores

What it is: a second chore object that ages toward "needs doing" since it was last
done, rather than being due on a date.
Who does it: **Tody**, partly Sweepy.
Why here: the strongest anti-guilt mechanic in the category, and it fits a real
distinction — child routines want daily recurrence and grace; *household
maintenance* (vacuum, bathroom) wants decay, so one bad week does not produce a
wall of red. It also composes with the no-negative-marking rule rather than
fighting it.
Data model: **new object**. Not absorbable by `routine.schedule`, which is
occurrence-based. Higher effort than its position here suggests; it is ranked on
conceptual fit.

### 10. Quota recurrence ("3× per week")

What it is: a chore due N times within a window rather than on specific days.
Who does it: OurHome, distinctively.
Why here: matches how several real household chores actually work, and removes
the false precision of picking days.
Data model: **cheap** — `routine.schedule` is jsonb and already carries two
variants (`rrule` and `kind: 'once'`). The cost is in occurrence expansion and in
what "done" means for a partially-satisfied quota.

### 11. Photo / email / PDF → event ingestion

What it is: turn a school letter into events without typing.
Who does it: Skylight (the single most-loved feature in its reviews), Hearth, Cozi
Max, Jam, Maple and the entire 2026 wave.
Why here: likely table stakes within a year, and it attacks the real bottleneck.
Already on the PRD's Phase 2 as natural-language entry.
Data model: **no new tables** for the output — events exist — but it is by far the
heaviest item here: an external dependency, a review/confirm UI, and the Ohai
lesson that a silent wrong answer is worse than no feature.

### 12. Data export

What it is: a household's calendar, routines, ledger and redemptions as files.
Who does it: DAKboard, Greenlight, Habitica, the platforms.
Why here: self-hosting already answers lock-in, so the value is lower than for a
cloud vendor — but "give me my data" is cheap to honour and the category's history
makes it a real trust lever.
Data model: **no new tables**; a read path plus a format decision (ICS for events,
CSV/JSON for the rest).

### 13. Meal planning and recipes

What it is: a weekly plan, a recipe box, ingredients pushed to a shopping list.
Who does it: Cozi, FamilyWall, Skylight, Hearth, Qudoo, Maple — universal in the
app tier.
Why here: genuine breadth gap. Against it: FamilyWall's lesson is that breadth
dilutes depth, and one primary complaint worth heeding is that meal entries
**pollute the shared calendar** — *"My family thinks it muddies up the calendar
information they need to see"* [VERIFIED-PRIMARY, App Store].
Data model: **new tables**, several, plus a dependency on the shopping list.

### 14. Feelings / emotional check-in board

What it is: each member picks how they are doing today.
Who does it: Hearth ("Today's Feelings", 16 emoji), Skylight, Goally, Choiceworks.
Why here: rare and genuinely differentiating, and it is the one competitor feature
that is about relatedness rather than compliance.
Data model: **new table**, tiny. Ranked last on uncertainty of value, not cost.

**Deliberately not listed as candidates**, though the market has them: anything in
§4.2 (refused), and anything in §4.3 (already present under another name). Fixing
the two family-wide permission cells from §4.1 is not a candidate feature either —
it is a defect.

---

## Appendix A — Consolidated feature matrix

**Legend:** `✓` present · `~` partial / paywalled / awkward · `✗` verified absent
(notable) · `–` not applicable to the product's category · `?` **unknown — not
"probably no"**.

Do not treat a `✓` as verified unless the corresponding claim in this document is
tagged [VERIFIED-PRIMARY]. Jam and Maple are omitted from the grid (Jam has no
display surface; Maple sunsets 31 December 2026); see §1.2.

| Code | Product |
|---|---|
| SKY | Skylight Calendar / Cal Max (+ Plus) |
| HRT | Hearth Display |
| CZY | Cozyla Calendar+ 2 |
| QDO | **Qudoo (NL)** |
| DAK | DAKboard |
| COZ | Cozi Family Organizer |
| FWL | FamilyWall |
| OUR | OurHome *(unmaintained)* |
| SMO | S'moresUp |
| GRL | Greenlight / GoHenry / BusyKid |
| HAB | Habitica |
| TDY | Tody / Sweepy / Nipto |
| GOA | Goally / Brili / Choiceworks |
| PLT | Apple Family Sharing / Google Family Link |
| **KYN** | **Kynite (branch `greenfield`)** |

### A. Calendar & sync

| Feature | SKY | HRT | CZY | QDO | DAK | COZ | FWL | OUR | SMO | GRL | HAB | TDY | GOA | PLT | **KYN** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Shared multi-member calendar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – | ~ | ✓ | **✓** |
| Per-member colour coding | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | – | – | – | – | ~ | **✓** |
| Per-member **column** layout | ✓ | ✓ | ✓ | ✓ | ? | ✗ | ✗ | ✗ | ✗ | – | – | – | – | ✗ | **✓** |
| Day / week / month / agenda views | ✓ | ✓ | ✓ | ✓ | ~ | ~ | ✓ | ✓ | ~ | – | – | – | – | ✓ | **✓** |
| Import from Google Calendar | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ? | – | – | – | – | ✓ | **✓** |
| **True two-way write-back** | ✓ | ? | ? | ~ | ✗ | ✗ | ~ | ~ | ? | – | – | – | – | ✓ | **✓** |
| Apple / iCloud calendar | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | ? | ? | – | – | – | – | ✓ | ~ |
| Outlook / Microsoft calendar | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | ? | ? | – | – | – | – | ~ | ~ |
| Public **ICS URL subscribe** | ✓ | ? | ✓ | ✓ | ✓ | ✗ | ? | ✗ | ✗ | – | – | – | – | ✓ | **✓** |
| Outbound ICS feed | ? | ? | ? | ? | – | ✓ | ? | ? | ? | – | – | – | – | ✓ | ✗ |
| **NL school import (Magister/Parro/Social Schools)** | ✗ | ✗ | ✗ | **✓** | ✗ | ✗ | ✗ | ✗ | ✗ | – | – | – | – | ✗ | ~ |
| Google Tasks sync | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | – | – | – | – | ~ | ✗ |
| Birthday tracker | ? | ? | ? | ? | ? | ~ | ✓ | ✗ | ✗ | – | – | – | – | ✗ | **✓** |
| Recurring events | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – | – | ✓ | **✓** |
| **Private / hidden events** | ✓ | ? | ? | ~ | ✗ | ✗ | ? | ✗ | ✗ | – | – | – | – | ~ | **✓** |
| Photo / PDF / email → event | ✓ | ✓ | ? | ? | ✗ | ~ | ~ | ✗ | ✗ | – | – | – | – | ✗ | ✗ |

### B. Chores, routines & the reward economy

| Feature | SKY | HRT | CZY | QDO | DAK | COZ | FWL | OUR | SMO | GRL | HAB | TDY | GOA | PLT | **KYN** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Task assignment to a member | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | ✗ | **✓** |
| Recurring chores / routines | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | **✓** |
| One-off tasks (nullable date) | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ~ | ✗ | **✓** |
| **Step-level routines** | ✓ | ✓ | ? | ? | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | **✓** | ✗ | **✓** |
| Points / stars economy | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ~ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | **✓** |
| **Stars paid per step** vs per task | ~ | ? | ? | ? | – | – | – | ✗ | ✗ | ✗ | ~ | ✗ | ✗ | – | **✓** |
| Parent-authored **reward store** | ✓ | ✓ | ? | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ~ | ✓ | ✗ | ✓ | ✗ | **✓** |
| **Savings goals / spaarpot** | ~ | ? | ? | ~ | ✗ | ✗ | ✗ | ✓ | ? | ✓ | ✓ | ✗ | ✗ | ✗ | **✓** |
| Parent **approval** before payout | ~ | ? | ? | ? | – | – | – | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | – | **✓** |
| Photo proof of completion | ✗ | ✗ | ✗ | ✗ | – | ✗ | ✗ | ✓ | ✓ | ~ | ✗ | ✗ | ✓ | – | ✗ |
| **Real-money payout** | ✗ | ✗ | ✗ | ✗ | – | ✗ | ✗ | ✗ | ✗ | **✓** | ✗ | ✗ | ✗ | ✗ | ✗ *(refused)* |
| Streaks | ✓ | ✓ | ? | ? | ✗ | ✗ | ✗ | ✓ | ✓ | ~ | ✓ | ✓ | ✓ | ✗ | ✗ *(refused)* |
| Penalties / negative points | ✗ | ✗ | ✗ | ✗ | – | ✗ | ✗ | ✓ | ✓ | ~ | **✓** | ✗ | ✗ | – | ✗ *(refused)* |
| Levels / XP / avatar progression | ✗ | ✗ | ✗ | ✗ | – | ✗ | ✗ | ✗ | ~ | ✗ | **✓** | ~ | ✗ | – | ✗ *(refused)* |
| Leaderboard between members | ✗ | ✗ | ✗ | ✗ | – | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | **✓** | ✗ | – | ✗ *(refused)* |
| **Auto-rotation / fair split** | ✗ | ✗ | ✗ | ✗ | – | ✗ | ✗ | ✓ | ~ | ✗ | ✗ | **✓** | ✗ | – | ✗ |
| **"Up for grabs" chore pool** | **✓** | ? | ✗ | ✗ | – | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | – | ✗ |
| Per-task difficulty / weight | ✗ | ✗ | ✗ | ✗ | – | ✗ | ✗ | ~ | ✓ | ✗ | ✓ | ✓ | ✗ | – | ~ |
| **Decay model** (task ages) | ✗ | ✗ | ✗ | ✗ | – | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | **✓** | ✗ | – | ✗ |
| **Anti-inflation damper** | ✗ | ✗ | ✗ | ✗ | – | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** | ✗ | ✗ | – | ~ |
| **Fading / graduation off rewards** | ✗ | ✗ | ✗ | ✗ | – | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | – | **✓** |
| Picture/icon steps for pre-readers | ✓ | ✓ | ? | ? | ✗ | ✗ | ✗ | ~ | ~ | ✗ | ✗ | ✗ | **✓** | ✗ | **✓** |
| **Per-step visual timers** | ✓ | ~ | ? | ~ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** | ✗ | **✓** |
| Celebration animation / confetti | ✓ | ✓ | ? | ? | ✗ | ✗ | ✗ | ✓ | ✓ | ~ | ✓ | ✓ | ✓ | ✗ | **✓** |
| Financial-literacy lessons | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** | ✗ | ✗ | ✗ | ✗ | ✗ *(refused)* |

### C. Adjacent household features

| Feature | SKY | HRT | CZY | QDO | DAK | COZ | FWL | OUR | SMO | GRL | HAB | TDY | GOA | PLT | **KYN** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Shared shopping / grocery list | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Meal planner | ✓ | ✓ | ? | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Recipe box / import | ✓ | ✓ | ? | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Family messaging / chat | ✗ | ✗ | ? | ? | ✗ | ✗ | **✓** | ✓ | ✓ | ~ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Location sharing / geofence | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | **✓** | ✗ |
| Document vault | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Household budget | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ~ | ✗ |
| Weather widget | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Emotional check-in / feelings board | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** | ✗ | ✗ |
| Share link for sitters/grandparents | ✓ | ? | ? | ? | ✓ | ~ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |
| Screen-time as reward currency | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | **✓** | ✗ |
| Dutch public/cultural days + school holidays | ✗ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** |

### D. Wall-display form factor & platform

| Feature | SKY | HRT | CZY | QDO | DAK | COZ | FWL | OUR | SMO | GRL | HAB | TDY | GOA | PLT | **KYN** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dedicated touchscreen hardware | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | – |
| Kid checks off tasks **on the wall** | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | **✓** |
| Kid-specific home screen | ✓ | ✓ | ✓ | ? | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | **✓** |
| Scheduled sleep / screen-off | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – | – | – | – | – | ~ | – | – |
| Photo screensaver / ambient mode | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| PIN / parental lock on the display | ✓ | ? | ✓ | ? | ✗ | – | – | – | – | – | – | – | ✓ | – | ~ |
| Privacy mode (hide sensitive events) | ✓ | ✓ | ? | ✓ | ✗ | – | – | – | – | – | – | – | ✗ | – | **✓** |
| Kiosk ↔ full Android toggle | ✗ | ✗ | **✓** | ? | ~ | – | – | – | – | – | – | – | ✗ | – | – |
| **Offline / local-first operation** | ✗ | ✗ | ✗ | ? | ~ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | ✓ | ~ | ~ | **✓** |
| **Self-hostable / no vendor cloud** | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ | **✓** |
| **Real kid role / scoped permissions** | ~ | ? | ? | ~ | ✗ | ✗ | ~ | ~ | ~ | ✓ | ✗ | ✗ | ✓ | ✓ | **✓** ⚠ |
| **Change feed / "what changed?"** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ~ | ~ | ~ | ✗ | ✗ | ✗ | ✗ |
| Per-member login | ✓ | ✓ | ✓ | ✓ | – | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ *(adults only, by design)* |
| Companion mobile app | ✓ | ~ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ *(PWA)* |
| **Dutch-language UI** | ✗ | ✗ | ✗ | **✓** | ~ | ✗ | ~ | ✗ | ✗ | ✗ | ~ | ~ | ✗ | ✓ | **✓** |
| **Chores/rewards behind a paywall** | **✓** | **✓** | ✗ | ~ | – | – | ~ | ✗ | ~ | – | ✗ | ✗ | – | – | ✗ |
| Ads | ✗ | ✗ | ✗ | ✗ | ✗ | **✓** | ~ | ✗ | ~ | ✗ | ✗ | ~ | ✗ | ✗ | ✗ |
| Data export | ? | ? | ? | ? | ✓ | ~ | ? | ✗ | ? | ✓ | ✓ | ✗ | ? | ✓ | ✗ |

⚠ KYN "real kid role": the matrix exists and fails closed, but `completion:write`
and `redemption:request` are family-wide — see §4.1.

---

## Appendix B — Sources

### Wall displays and hardware

- Skylight products and pricing — https://myskylight.com/products/skylight-calendar · https://myskylight.com/calendar-max · https://myskylight.com/lp/rewards/
- Skylight support (subscription split, sleep mode, brightness, parental lock, two-way sync, supported languages, international orders) — https://skylight.zendesk.com/hc/en-us/articles/36009559376795-Does-Skylight-Calendar-require-a-subscription · .../32083925485723-Sleep-Mode · .../36835387462555-General-Settings · .../35089525796251-Parental-Lock · .../19197773155995 · .../35783081774619-Supported-Languages · .../20421533144219-Skylight-International-Orders-FAQ
- Skylight coverage and reviews — https://techcrunch.com/2026/01/07/skylight-debuts-calendar-2-to-keep-your-family-organized · https://wetried.it/skylight-calendar-max-review/ · https://www.cubbyathome.com/skylight-calendar-review-80042154 · https://cybernews.com/reviews/skylight-calendar-review/ · https://www.tasteofhome.com/article/skylight-calendar-review/ · https://getsense.ai/blog/posts/skylight-calendar-hidden-costs-paywall
- Skylight Buddy — https://www.forbes.com/sites/forbes-personal-shopper/2026/08/04/skylight-buddy-review/
- Hearth — https://hearthdisplay.com/products/hearth-display · https://techcrunch.com/2022/07/12/hearth-display-replaces-your-whiteboard-with-a-27-inch-display-for-family-task-management/ · https://www.thequalityedit.com/articles/hearth-vs-skylight-review · https://uninfluencedreview.com/2026/06/28/should-you-get-a-hearth-display-these-are-reddit-communtiy-reviews/ · https://www.themillennialsahm.com/hearth-display-review/ · https://rigorousthemes.com/blog/hearth-display-review/ · https://bybriefly.com/hearth-display-review/ · https://newmodernmom.com/blog/hearth-display-review/
- Cozyla — https://www.cozyla.com/products/calendar-plus-2-digital-calendar
- Apolosign — https://www.apolosign.com/products/21-5-digital-calendar
- DAKboard — https://dakboard.com · https://www.capterra.com/p/191381/DAKboard/reviews/
- Mango Display — https://mangodisplay.com/digital-calendar-display/
- FamDisplay — https://famdisplay.com
- MagicMirror² — https://docs.magicmirror.builders/modules/calendar.html · https://www.pistack.xyz/posts/2026-06-05-self-hosted-smart-mirror-digital-display-platforms-guide/
- Echo Show / Nest Hub — https://wetried.it/best-smart-display/ · https://gethomsy.com/blog/family-organization/chores-app-echo-show · https://9to5google.com/2026/01/30/google-nest-hub-apps-have-mostly-disappeared-over-the-years/ · https://www.googlenestcommunity.com/t5/Home-Automation/Terrible-Family-Bell-and-Reminders-make-Nest-Hub-worthless/m-p/337999
- Jam — https://jamfamilycalendar.com · https://help.jamfamilycalendar.com/article/33-where-can-i-use-jam · https://apps.apple.com/us/app/jam-family-calendar/id6449090626

### Organiser apps and platforms

- Cozi — https://www.cozi.com/ · https://www.cozi.com/compare-plans/ · https://www.cozi.com/using-cozi-with-other-calendars/ · https://www.cozi.com/faq/ · https://www.cozi.com/blog/cozi-chores/ · https://apps.apple.com/us/app/cozi-family-organizer/id407108860 · https://www.usecalendara.com/blog/cozi-review-2026 [SECONDARY-COMPETITOR] · https://ourcal.com/blog/cozi-app-review-2025 [SECONDARY-COMPETITOR]
- FamilyWall — https://www.familywall.com/ · https://www.familywall.com/premium.html · https://www.educationalappstore.com/app/familywall-family-organizer
- Maple (shutdown notice) — https://www.growmaple.com/ · https://getsense.ai/maple
- Picniic — https://www.appbrain.com/app/family-organizer-by-picniic/com.picniic.picniicapp · https://macsources.com/picniic-family-organizer-ios-app-review/
- TimeTree — https://timetreeapp.com/intl/en/premium · https://www.usecalendara.com/blog/calendara-vs-timetree [SECONDARY-COMPETITOR]
- Apple Family Sharing — https://www.apple.com/family-sharing/ · https://support.apple.com/en-sg/105124 · https://mjtsai.com/blog/2025/09/24/screen-time-brokenness/ · https://techcrunch.com/2023/07/31/apple-confirms-a-screen-time-bug-is-causing-settings-not-to-stick · https://discussions.apple.com/thread/252983797 · https://discussions.apple.com/thread/7494750 · https://discussions.apple.com/thread/255025696
- Google Family Link / Family group — https://families.google/familylink/ · https://support.google.com/families/answer/9037996 · https://support.google.com/families/answer/7157782 · https://support.google.com/calendar/thread/301564945 · https://www.aljazeera.com/economy/2026/1/14/child-rights-org-says-google-undermines-parental-control-of-child-accounts
- Microsoft Family Safety — https://www.microsoft.com/en-us/microsoft-365/family-safety · https://www.tomsguide.com/computing/windows-operating-systems/windows-parental-controls-are-crashing-chrome-heres-the-workaround
- Motion (excluded — work-only) — https://www.usemotion.com/pricing
- Ohai — https://aichief.com/ai-productivity-tools/ohai-ai/ · https://www.gbrlife.com/blog/ohai-ai-review
- Yohana closure — https://www.channelnews.com.au/panasonics-ai-ambitions-stumble-as-consumer-apps-hit-delays-and-closures/

### Chores, allowance, gamification

- OurHome — https://choresplit.com/compare/ourhome · https://www.littledayout.com/parent-review-ourhome-app-for-home-organisation-and-behaviour-management/ · https://www.app.nl/ourhome/
- S'moresUp — https://www.smoresup.com/ · https://www.commonsensemedia.org/app-reviews/smoresup-best-chores-app · https://www.educationalappstore.com/app/s-moresup-best-chores-app
- Homey — https://www.homeyapp.net/ · https://www.commonsensemedia.org/app-reviews/homey-chores-and-allowance
- BusyKid — https://wellkeptwallet.com/busykid-debit-card-review/ · https://www.finder.com/kids-banking/busykid-prepaid-card
- Greenlight — https://greenlight.com/chores-and-allowance-app-for-kids · https://kikaroo.app/blog/greenlight-debit-card-review/ · https://www.consumeraffairs.com/finance/online-banks/greenlight.html
- GoHenry / Acorns Early — https://www.gohenry.com/uk/kids-debit-card · https://www.gohenry.com/uk/earn · https://www.pennytime.app/learn/blog/what-happened-to-gohenry-gohenry-is-now-acorns-ea/
- NatWest Rooster Money — https://roostermoney.com/best-pocket-money-apps/ · https://moneytothemasses.com/banking/roostermoney-pocket-money-app-review
- Tody / Sweepy / Nipto / Flatastic — https://todyapp.com/ · https://sweepy.com/ · https://www.cubbyathome.com/sweepy-cleaning-app-review-80044734 · https://mwm.ai/apps/nipto-split-chores/1504877473 · https://plastnofy.com/articles/the-best-chore-apps-for-roommates-in-2026
- Habitica — https://habitica.fandom.com/wiki/Dailies · /Streaks · /Rewards · /Death_Mechanics · https://deepwiki.com/HabitRPG/habitica/5.2-task-scoring-and-rewards · https://www.alternativeto.net/software/habitica/about/ · https://www.choosingtherapy.com/habitica-app-review/
- Finch — https://help.finchcare.com/hc/en-us/articles/37935669335309-Our-Approach-to-Self-Care · https://habitbox.app/blog/finch-app-review · https://calmevo.com/finch-app-review/
- Goally / Brili / Choiceworks — https://www.educationalappstore.com/app/goally · https://theautismcafe.com/goally-visual-schedule-app-autism/ · https://www.commonsensemedia.org/app-reviews/brili-routines · https://www.assistivetech.com.au/products/choiceworks-app-for-ipad
- Happy Kids Timer and visual timers — https://happykidstimer.com/ · https://www.onlinetimezone.com/visual-timers.html
- ChoreMonster / FamilyTech history — https://kidscreen.com/2017/02/16/how-familytechs-apps-are-sweeping-the-chores-trend/ · https://en.wikipedia.org/wiki/ChoreMonster · https://familytechzone.com/what-happened-to-choremonster/

### Dutch / European

- Qudoo — https://qudoo.nl/ · https://qudoo.nl/pages/digitale-kalender-touchscreen · https://qudoo.nl/pages/veelgestelde-vragen · https://apps.apple.com/nl/app/qudoo-family-planner/id6514304821 · https://nl.trustpilot.com/review/qudoo.nl · https://www.bright.nl/nieuws/1177153/
- Klender — https://www.klender.nl/ · https://www.appwereld.nl/app/klender-gedeelde-gezinsagenda/898322781/reviews/ · https://all4phones.de/articles/klender-app-im-test-der-beste-familienkalender-fuers-handy.2134/
- Famanice — https://apps.apple.com/de/app/famanice-familienkalender/id806214101 · https://blog.clanfamily.de/review/famanice-der-perfekte-familienkalender/
- SHUBiDU — https://www.shubidu.com/ · https://blog.clanfamily.de/review/top-6-familienkalender-app-im-test-schubidu/
- Heitje voor een Karweitje — https://heitjevooreenkarweitje.eu/
- Growly — https://www.beargrowly.com/ · https://apps.apple.com/nl/app/growly/id6760385814
- Tasks 'n Chores — https://www.tasksnchores.com/nl/klusjes-app-voor-kinderen/
- Chore Boss — https://apps.apple.com/nl/app/chore-boss-zakgeld-tracker/id6475013233
- Koiny — https://apps.apple.com/nl/app/koiny-zakgeld-voor-kinderen/id6760566260
- Bling (DE) — https://apps.apple.com/de/app/bling-taschengeld-familie/id1575241301
- Cozi in NL/DE — https://www.multimama.nl/review-cozi-gratis-familieplanner-app/ · https://blog.clanfamily.de/review/top-6-familienkalender-app-im-test-cozi-family/
- iCulture NL round-up — https://www.iculture.nl/gids/apps-gezinstaken-iphone/
- Parro iCal sync — https://parnassysouders.zendesk.com · https://www.parnassys.nl

### Self-hosted / DIY

- Home Assistant family calendar build — https://community.home-assistant.io/t/diy-family-calendar-skylight/844830
- Skylite UX (Docker) — https://hub.docker.com/r/wetzel402/skylite-ux
- Kiosk and always-on display practice — https://joinhomeshift.com/home-assistant-tablet · https://homeautocentral.com/home-assistant-kiosk-mode/ · https://community.home-assistant.io/t/home-assistant-on-a-tablet-fully-kiosk-browser-or-app/265283

### Evidence base — token economies, motivation, gamification

- Kazdin & Bootzin (1972), *JABA* — https://onlinelibrary.wiley.com/doi/10.1901/jaba.1972.5-343
- Soares, Harrison, Vannest & McClelland (2016), *School Psychology Review* 45(4) — https://eric.ed.gov/?id=EJ1141302 · https://www.tandfonline.com/doi/full/10.17105/SPR45-4.379-399
- Kim, Fienup, Oh & Wang (2022), *Behavior Modification* — https://pubmed.ncbi.nlm.nih.gov/34784784/
- Maggin, Chafouleas, Goddard & Johnson (2011), *Journal of School Psychology* — https://www.sciencedirect.com/science/article/abs/pii/S0022440511000495
- Response cost efficacy and preference — https://www.researchgate.net/publication/296056803_Efficacy_of_and_preference_for_reinforcement_and_response_cost_in_token_economies
- Deci, Koestner & Ryan (1999), *Psychological Bulletin* 125(6) — https://home.ubalt.edu/tmitch/642/articles%20syllabus/Deci%20Koestner%20Ryan%20meta%20IM%20psy%20bull%2099.pdf
- Eisenberger, Pierce & Cameron (1999) — https://pubmed.ncbi.nlm.nih.gov/10589299/
- Cameron (2001) and Deci/Koestner/Ryan (2001), *Review of Educational Research* 71(1) — https://journals.sagepub.com/doi/10.3102/00346543071001029 · https://journals.sagepub.com/doi/10.3102/00346543071001001 · https://journals.sagepub.com/doi/10.3102/00346543071001043
- Cerasoli, Nicklin & Ford (2014), *Psychological Bulletin* 140(4) — https://pubmed.ncbi.nlm.nih.gov/24491020/ · https://selfdeterminationtheory.org/wp-content/uploads/2017/06/2014_Cerasoli_Intrinsic.pdf
- Murayama et al. (2010), *PNAS* — https://www.pnas.org/doi/10.1073/pnas.1013305107
- Warneken & Tomasello (2008), *Developmental Psychology* — https://pubmed.ncbi.nlm.nih.gov/18999339/
- Lepper, Greene & Nisbett (1973), overjustification — https://www.psychologynoteshq.com/overjustification-effect/
- Kohn, *Punished by Rewards* — https://www.alfiekohn.org/punished-rewards/ ; critique "Punished by Misunderstanding" — https://link.springer.com/article/10.1007/BF03392789 ; Dickinson (1995) — https://onlinelibrary.wiley.com/doi/10.1111/j.1937-8327.1995.tb00677.x
- Rodrigues et al. (2022), novelty and familiarization — https://eric.ed.gov/?id=EJ1325797 · https://durham-repository.worktribe.com/output/1203194/
- Tsay, Kofinas & Luo (2020), *JCAL* — https://onlinelibrary.wiley.com/doi/abs/10.1111/jcal.12385
- Sailer & Homner (2020), *Educational Psychology Review* 32 — https://link.springer.com/content/pdf/10.1007/s10648-019-09498-w.pdf
- Gamification and children's health behaviour, 16 RCTs — https://games.jmir.org/2025/1/e68151
- Gamification and SDT constructs — https://link.springer.com/article/10.1007/s11423-023-10337-7
- Tepper, Howell & Gray (2022), *Australian Occupational Therapy Journal* — https://pubmed.ncbi.nlm.nih.gov/35640882/ ; press overclaim — https://neurosciencenews.com/child-chores-brain-function-20827/
- "Harvard chores study" debunk — https://piccalio.com/blogs/journal/harvard-study-on-chores-untangling-the-research · https://raisinghealthyfamilies.com/harvard-study-hoax/
- Manolev, Sullivan & Slee (2019), ClassDojo — https://www.tandfonline.com/doi/abs/10.1080/17439884.2018.1558237 ; 2025 follow-up — https://www.tandfonline.com/doi/full/10.1080/17439884.2025.2553184
- Surveillance/datafication of child finance apps (2024), *Young Consumers* 25(6) — https://www.emerald.com/yc/article-abstract/25/6/953/1230501/The-surveillance-gamification-and-datafication-of
- MIT Technology Review (2022), chore apps and mothers — https://www.technologyreview.com/2022/05/10/1051954/chore-apps/
- AAP / HealthyChildren, positive reinforcement — https://www.healthychildren.org/English/family-life/family-dynamics/Pages/Positive-Reinforcement-Through-Rewards.aspx ; ADHD behaviour therapy — https://www.healthychildren.org/English/health-issues/conditions/adhd/Pages/Behavior-Therapy-Parent-Training.aspx
- NHS Betsi Cadwaladr, reward systems — https://bcuhb.nhs.wales/services/hospital-services/neurodevelopmental/documents/positive-behaviour-reward-systems/
- Triple P — https://www.triplep.net/glo-en/find-out-about-triple-p/triple-p-in-a-nutshell/
- Incredible Years — https://www.incredibleyears.com/research
- Raising Children Network, reward charts — https://raisingchildren.net.au/preschoolers/behaviour/encouraging-good-behaviour/reward-charts
- Token-economy evidence for ADHD/autism — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4659172/ · https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12561863/

### Internal documents this builds on

- `docs/research/psychology-and-product-principles.md` — the source of the refusals in §4.2
- `docs/rebuild-parity.md` — the 21 dropped items
- `docs/prd.md` — FR11, FR13, FR22, FR28, FR30 and the phase roadmap
- `docs/architecture.md` — §5 sync, §6 offline, §7 the permission matrix
