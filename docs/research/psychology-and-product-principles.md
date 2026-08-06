# Psychology & Product Principles

Research synthesis for the Kynite greenfield rebuild (August 2026). Two research
tracks: (1) child motivation psychology, (2) household coordination dynamics and
competitor product evidence. Ends with the design decisions that differ from the
original project.

---

## Part 1 — Child motivation psychology (ages 4–12)

### Token economies / star charts

The most heavily tested behavior-change tool in applied psychology (operant
conditioning / ABA). Reliable short-term increases in target behavior for ages
4–14. Failure modes: effects don't maintain once tokens are withdrawn without a
fading plan; can suppress intrinsic motivation for behaviors the child already
found rewarding; penalty components (removing tokens) trigger anxiety and
aggression — reward-only systems perform equal or better on outcomes with fewer
emotional side effects.

**Implication:** use stars for effortful/tedious tasks only; build a graduation
mechanic; never subtract earned stars.

### Overjustification effect

Deci, Koestner & Ryan meta-analysis (128 experiments): tangible, expected,
engagement-contingent rewards reliably decrease intrinsic motivation (r ≈ −0.24).
Verbal praise shows no such effect. Effect strongest when the reward is expected
in advance, tangible, and tied to mere engagement rather than a competence
standard. Stronger in children than adults. Surprise rewards and
competence-signaling feedback do not undermine — and can boost — intrinsic
motivation.

**Implication:** guaranteed stars only for chores/hygiene kids don't enjoy;
surprise bonus stars over bigger guaranteed payouts; pair every star with
specific praise ("You did that all by yourself!") — praise is risk-free.

### Self-Determination Theory

Sustained motivation needs autonomy, competence, and relatedness. Points/badges
used as controlling mechanics undermine developing interest; meaningful choice,
mastery feedback, and social/narrative connection sustain it. No single mechanic
covers all three needs.

**Implication:** kids choose task order where safe (autonomy); show mastery
progress, not just totals (competence); celebrations are family-visible moments,
not private tallies (relatedness).

### Habit formation, visual schedules, transitions

Visual schedules reduce transition-related problem behavior by letting children
anticipate what's next, and scaffold self-regulation over time. Timer-based
advance warnings outperform verbal-only warnings (Dettmer, Simpson & Myles).

**Implication:** hub shows the next 1–2 items, not just the current one; visible
countdown before routine transitions ("5 min until bedtime routine"); consistent
day-to-day icon sequences.

### Streaks and loss-framing

Streaks exploit loss aversion — powerful and risky. Documented anxiety and
compulsive checking from all-or-nothing streak breaks (Duolingo case studies),
worsening as streaks grow. Standard mitigation: bounded grace misses.

**Implication:** no hard streak resets, no broken-chain imagery; weekly grace
misses; for the youngest, prefer cumulative star total (only grows) as the
primary progress metric.

### Sibling comparison

Rivalry driven by comparison for parental approval is linked to lower
self-esteem and reduced sense of competence. Leaderboards demotivate lower
performers.

**Implication:** personal-progress views only; no cross-sibling ranking
anywhere in the child-facing UI; never "who did fewer chores" framing.

### Age differentiation

Ages 3–5 struggle to wait beyond minutes; by 10, delay tolerance and
future-oriented reward understanding are markedly better. Reward sensitivity
peaks in middle childhood (7–11) with still-weak inhibitory control.

**Implication:** per-child reward horizon setting. Ages 4–7: immediate,
concrete, high-frequency small redemptions, icon-heavy UI, minimal text.
Ages 8–12: savings goals toward self-chosen larger rewards, progress bars,
weekly totals.

### Negative marking

Response-cost components (removing tokens, failure marks) trigger anxiety and
aggression without improving outcomes. Self-monitoring add-ons help more safely.

**Implication:** no red X, no star removal, no negative balances. Missed =
dimmed/absent, neutral. Consequences are a parent conversation, not an app
mechanic.

---

## Part 2 — Household dynamics & product evidence

### Mental load

Shared calendars make labor visible but don't redistribute it — "Mom now
maintains both the household and the app tracking the household." Fair Play's
core insight: labor is ownership (conception → planning → execution), not
execution. Its failure mode: setup ritual becomes another task for the
overloaded partner.

**Implication:** explicit task ownership with reminder routing to the owner;
value must arrive passively (Google Calendar sync) with zero setup from the
second partner.

### Nagging / device as messenger

70–90% of parents report habitual nagging; it breeds resistance. SDT:
autonomy-supportive framing beats controlling commands. Hearth users report the
display was "a game changer in the nag department" — the device became the
reminder source.

**Implication:** hub speaks as a neutral board ("3 of 4 morning tasks done"),
never as a parent-attributed command. Kid UI reads as the child's own
dashboard.

### Competitor lessons

| Product | Lesson |
|---|---|
| Skylight | 4.7★ but resentment over star-rewards behind subscription; only Google sync is truly 2-way |
| Hearth | 5-second lag after task tap killed kid engagement; top adoption critique: "if your husband won't use a free shared calendar, why the expensive one?" — buy-in precedes the tool |
| Cozi | Retroactively capped free calendar to 30 days → Trustpilot 2.1★, "bait and switch". Never paywall the hooking feature after adoption |
| OurHome | Best-loved chore/points system, died of free-forever/no-revenue + Android neglect. Business model and platform parity from day one |
| FamilyWall | Breadth diluted depth — poor fit for users whose primary need is chores |
| Yoto/Tonies | Screen-minimal, single-gesture interaction → independent kid use with zero training. Kid interactions should be one large tap, no menus |

### Ambient display retention

~50% of tracked-device users stop within two weeks when daily passive value
fades. Calm-technology goal: glanceable via pre-attentive processing, no active
querying required.

**Implication:** the hub must be worth glancing at with zero interaction (today,
who's doing what, kid status). Sub-second interaction response is a hard NFR.

### Rewards economy

~1/3 of parents deliberately avoid money rewards. Paying for household
contribution reframes family membership as a labor transaction — fragile
long-term.

**Implication:** reward-store presets default to privileges/experiences (choose
dinner, extra story, zoo trip). No allowance/banking scope. System must be
gracefully removable per routine.

### Caregivers & multi-household

Grandparent access works best as link/QR read-only view without account
friction, with Owner/Contributor/Viewer roles. Low-conflict co-parenting fits a
general planner; high-conflict co-parenting (OurFamilyWizard territory) is out
of scope.

**Implication:** keep the PRD's no-auth caregiver view; role-based shareable
links from day one; recurring-event model flexible enough for custody-week
patterns.

### Single-admin trap

The purchasing parent becomes permanent admin because setup and accounts funnel
through them. The highest-leverage feature is second-partner onboarding:
claim avatar/color, see own calendar merged in, immediate passive win, zero
data entry.

---

## Decisions — what the rebuild does differently

1. **No negative marking.** Missed tasks render dimmed/absent. No red X, no
   star deduction, ever.
2. **Soft streaks.** Built-in grace misses, no broken-chain imagery; cumulative
   star total is the primary metric for young children.
3. **No sibling comparison.** Per-child reward chart only; no combined ranking
   surface exists.
4. **Reward tedium only.** Stars attach to chores/hygiene routines. Fun
   calendar events carry no reward mechanics. Surprise bonus stars over bigger
   guaranteed payouts.
5. **Praise layer.** Completion feedback leads with specific praise text +
   celebration animation; the star is secondary. Animations stay non-strobing.
6. **Age-tiered redemption.** Per-child setting: instant small rewards (4–7) vs
   savings goals (8–12).
7. **Fade path.** Per-routine graduation off stars ("you do this on your own
   now" badge). The system is designed to become unnecessary.
8. **Experience-based reward presets.** Privileges and experiences, not money.
9. **Second-parent onboarding as first-class flow.** Invite → claim
   avatar/color → own Google Calendar merged, zero manual entry.
10. **Task ownership.** Events/tasks have an explicit owner; reminders route to
    the owner, not the creator.
11. **Sub-second completion feedback.** Optimistic UI (<100ms visual) on task
    tap; SSE sync behind it. Hard NFR.
12. **Device as messenger.** Voice/tone rule: the hub is a neutral board, never
    a parent's mouthpiece.

---

## Sources

Child psychology: Deci, Koestner & Ryan (2001) meta-analysis; Tang & Hall
(1995); Lepper, Greene & Nisbett (1973); SDT literature
(selfdeterminationtheory.org); ABA token-economy reviews (Doll; PMC12156682);
visual-schedule/transition studies (Dettmer, Simpson & Myles;
challengingbehavior.org); delay-of-gratification studies (PLOS ONE 2021; Nature
Sci Rep 2021); sibling-rivalry literature (EBSCO; PMC12416125); streak-anxiety
case studies (Duolingo/ScreenWise).

Product/household: Fair Play (Rodsky) + critiques (Lyman Stone, Zawn Villines,
Tend Task); Harvard Gazette on invisible labor; Consumer Reports Hearth vs
Skylight; Reddit review roundups (uninfluencedreview.com); Cozi Trustpilot;
OurHome postmortem (ChoreSplit); The Conversation on pocket money; calm
technology / ambient device literature; smart-home abandonment analysis
(staceyoniot.com).

Note: several "why apps fail" statistics circulating in competitor blogs (e.g.
"79% of couples") are unverified marketing claims — treated as directional only.
