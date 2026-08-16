# Feelings / emotional check-in board — research

Compiled **16 August 2026** for Kynite (self-hosted Dutch family hub; wall display + phones;
children roughly **ages 4–9**). Companion to `docs/research/psychology-and-product-principles.md`
and `docs/research/market-research-2026-08.md` §14.

> **Method / limits — read first.** The session's WebSearch budget (200/200) was exhausted
> early. Nearly all of this was obtained instead by direct API work against **Europe PMC**,
> **PubMed E-utilities**, **OpenAlex**, **Crossref**, **Semantic Scholar**, **ERIC**, the
> **iTunes Search/Lookup API**, the **NJi databank**, and direct full-text fetches (including
> extracting the Lieberman 2007 PDF and Torre's UCLA dissertation locally). That is *better*
> provenance than search snippets for peer-reviewed work, and worse for grey literature.
> Consequences: **no Reddit/forum sweep**, thin app-store *user-review* coverage, no UNCRC
> General Comment 25 text, no Dutch AP/EDPB guidance, and **no app could be installed**, so
> vendor *feature* claims are verified while *tap-level interaction* mostly is not. Gaps are
> flagged inline rather than smoothed over.

### Source grading

Following the house scheme in `market-research-2026-08.md`:

- **[A]** peer-reviewed primary research or meta-analysis
- **[SR]** systematic review / meta-analysis specifically
- **[B]** practitioner or clinical guidance from a credible body
- **[V]** vendor claim — evidence a feature is *advertised*, not that it *works*
- **[C]** opinion, advocacy, blog, single practitioner
- **[U]** unverifiable / could not be confirmed this session

**A negative finding is a finding.** Several of the most useful results below are of the form
"this literature does not exist" or "no product does this." Those are marked and are load-bearing.

---

## 0. Executive summary

The intuition behind this feature — *name the feeling, and naming helps* — is the part of the
evidence base that has **collapsed most badly** since 2021. Meanwhile the objections that
survive scrutiny are not the ones usually raised. They are not "this will harm your child's
mental health." They are:

1. **A child of 4–7 cannot produce a valid multi-point self-rating.** [SR]
2. **Audience presence predictably corrupts the entry**, in exactly this age band. [A]
3. **An adult cannot read a child's internal state from one datum** — and will anyway. [A]

All three are measurement-validity arguments; all three are well-evidenced *in the right age
band*; and all three are fixable by design rather than fatal. The genuinely fatal-if-ignored
finding is the second one, because a wall display in a shared kitchen is structurally the
worst case in the entire product landscape surveyed.

And the premise that motivated the Dutch angle — "reuse the vocabulary school already
teaches" — turns out to be **mostly wrong on the facts**, in an interesting way. See §C.

---

# A. How existing products do it

## A.1 The category map

| Product | Interaction | Vocabulary | Who sees it | History | Notify | Edit/retract |
|---|---|---|---|---|---|---|
| **Hearth Display** | tap a face in a "Today's Feelings" step | 16 emoji [V] | **whole household display** | ? [U] | no [U] | ? [U] |
| **Skylight** | mood/check-in feature | ? [U] | household display | ? [U] | ? | ? [U] |
| **Goally / Choiceworks / Brili** | visual-schedule tools; emotion modules | small icon sets | parent + child | varies | no | ? [U] |
| **Closegap** (school) | multi-step check-in, pick up to two feelings | rich set | **staff only, never peers** [V] | yes | flags to staff | ? [U] |
| **Class Catalyst** (school) | kiosk-mode class check-in | 4-zone-ish | teacher; explicitly warns a *shared board suppresses honesty* [V] | yes | teacher dashboard | ? [U] |
| **ClassDojo** | behaviour points, not really mood | — | teacher/parent | yes | yes | — |
| **How We Feel** (Yale-adjacent, nonprofit) | colour matrix → **searchable word set, custom words**, + physical-sensation tags | ~large, extensible | **on-device by default**; peer-to-peer consented sharing, per-check-in "always share" vs "ask each time" [V] | yes, + HealthKit correlation | no | ? [U] |
| **BeMe** (Hazel Health, 12+) | "Mood Ball" + a reason | moderate | **"YOUR MOODS, SAFELY SHARED ONLY WITH THE PEOPLE YOU TRUST"** — a self-chosen "Mood Crew" of **peers, not parents** [V] | yes | peer emoji reactions/calls | ? [U] |
| **Daylio** | mood + activity icons | rad/good/meh/bad/awful [U — help page 404] | **nobody**; local-only, PIN-locked, no account | yes, charts | no | yes |
| **Mightier** (ages 6–12) | **no self-report** — heart-rate monitor drives game difficulty | n/a ("Gizmo", "Lavalings") | parent, in a **separate app** | yes | no | n/a |
| **Breathe Think Do** (Sesame) | child regulates **a monster's** emotion, never their own | 3–4 states | nothing is logged | none | no | n/a |
| **Bark Kids** | passive NLP surveillance of the child's messages | n/a | **parent alerts only** | yes | yes | no |
| **Exploring Emotions: The Zones** ($9.99) | log your Zone | 4 zones | **child logs → adult sees**, no alerting [V] | yes, pattern view | no | ? [U] |

## A.2 The findings that matter

**⭐ No incumbent family organiser has a mood check-in.** Verified absent from Cozi
(4.81★ / 396,235 ratings), Life360, Greenlight, Gabb, FamilyWall, TimeTree. **The gap in
`market-research-2026-08.md` §14 is real** [A — negative finding, verified via iTunes
Lookup API]. Whether it is a gap or a graveyard is what §A.3 should make you ask.

**⭐ Nobody ships role-split visibility, a visibility delay, or an amend/retract window.**
Verified negative across the whole survey. Visibility is fixed by the product in every case;
the only products offering *any* audience control (How We Feel, BeMe) give it to the
*child*, per-entry, and both are teen/adult products. **This is the clearest differentiation
opportunity found, and it is exactly where the owner's instincts were pointing.**

**⭐ Nobody offers a configurable emotion vocabulary or alignment to a school's system.**
Every product ships one fixed set. Confirmed negative. (How We Feel's "add custom words" is
the nearest thing, and it is additive to a fixed matrix, not a swappable scheme.)

**⭐ Classroom tools are private-to-adult by design, and sell that as the feature.**
Closegap scopes to staff and never to peers. Class Catalyst's own material argues a *shared*
board suppresses honesty [V]. Practitioner guidance converges: UC Berkeley's Greater Good in
Education [Check-in Circle](https://ggie.berkeley.edu/practice/check-in-circle-for-community-building/)
(PreK up) builds in an explicit **right to pass**, framed as reducing "fear and stress that may
block higher brain functioning" [B]. Their private alternative is the
[Self Check-In Journal](https://ggie.berkeley.edu/practice/self-check-in-journal/).
*Caveat, and it is a telling one: GGIE's own evidence citation is misattributed — it points at
a restorative-practices district evaluation, not a check-in-circle study.*

> **The single most important sentence in section A:** a wall-mounted family display is not a
> variant of the classroom practice. **It is the thing the classroom practice is engineered to
> avoid.**

**⭐ Hearth attaches a star value to its feelings step** [V]. This is the direct precedent for
the reward question, and the qualitative face of it is a Finch user: *"I just do the 😐 option
so I can get in the game"* [C — single user report, but see §B.5 and §D.4].

**⭐ The Yale Mood Meter app is dead.** `itunes.apple.com/lookup?id=890392005` returns
`resultCount: 0`; the store page 404s; `moodmeterapp.com` now serves casino affiliate content;
the Android build was unpublished 30 Apr 2024. A **clone survives carrying the verbatim
original marketing copy**. No primary retirement announcement found [U]. Note the knock-on:
**the Mood Meter's canonical description (4 quadrants, ~100 words, axis labels, colours) could
not be verified from any Yale/RULER primary source** — `rulerapproach.org` 404'd, and the only
corroboration comes from *imitator apps*. Treat the canonical description as unverified.

**Woebot's consumer app shut down April 2025** — 1.5M users, 18 trials, 4.64★, App Store App
of the Day, and still not viable as a consumer product [A/press, multiply sourced]. A
partner-gated build persists.

**Clean negatives worth knowing:** Moshi has no mood check-in (a third-party review describing
content "sorted by mood" is a *content filter* — beware the false positive). Headspace and Calm
have none; there is no "Headspace for Kids" app, and store-listed "Calm Kids" is an unrelated
third party. Wisdo is 17+ adult peer-support, out of scope.

## A.3 Do children keep using them? — the retention numbers

**⭐ Baumel et al. 2019, *JMIR* 21(9):e14567** [A] — 93 popular mental-health apps with
≥10,000 installs, independent behavioural panel: **median DAU 4.0%; median 15-day retention
3.9%; median 30-day retention 3.3%.** One sub-finding cuts *toward* the feature: **tracker and
peer-support apps retained notably better** than breathing-exercise apps.

**⭐ Lane et al. 2026, *JMIR*** [A] — n=82, **ages 7–18**, smartwatch **single-tap** μEMA,
12 prompts/day for 8 days. Median response 68%, falling **74% on Day 1 → 40% on Day 7**
(OR per day 0.73, CI 0.64–0.83). 65% rated the experience positively but **only 33% would do
it again.** Twelve prompts/day is far more than a family app would use, so treat this as a
*lower bound on the slope*, not a forecast — but a ~46-point drop in one week, with the
lowest-friction interaction physically possible, dedicated hardware and a research team behind
it, is the number to design against.

**Wen et al. 2017, *JMIR*, 42 studies** [SR] — youth EMA compliance, weighted average **78.3%**,
"moderate but suboptimal." Prompt frequency moderates in **opposite directions by setting** —
**nonclinical: 91.7% at 2–3 prompts/day**, 77.4% at 4–5, 75.0% at 6+. (Clinical inverts.)
Study duration did *not* affect compliance. You are squarely nonclinical: **fewer prompts is
better**, and 91.7% is a research-conditions ceiling with consented, incentivised participants.

**Two counterintuitive compliance findings, both pointing the same way:** Henry et al. 2026
(130 studies, 14,400 participants, ages 8–17) [SR] found greater compliance associated with
**younger** age. Charitos et al. 2026 (systematic review, **ages 5–11**) [SR] found response
rates 48–92%, facilitators being "uncomplicated, engaging technology; reminders; caregiver
involvement" — **but 13 of 17 protocols at *critical* risk of bias**, so the evidence base for
this exact age band is weak. **Little kids are not the ones who disengage fastest.**

**Adult-in-the-loop helps adherence.** Lehtimaki et al. 2021 [SR]: interventions with an
in-person element (professional, peer, or parent) showed greater effectiveness, adherence and
lower dropout than fully automated ones.

**Grist et al. 2017, *JMIR*** [SR] — of 15 youth mental-health apps reviewed, **only 2 were
even downloadable**, and the two small RCTs **failed to show significant effects**. The
long-tail rating counts corroborate: Zones app 277 ratings, Exploring Emotions 238,
Wondergrade 37, QuadEmo 35, ZoR Tracker **3**.

> **Ambient-display context from the existing house research:** ~50% of tracked-device users
> stop within two weeks when daily passive value fades (`psychology-and-product-principles.md`).
> Nothing here contradicts that.

---

# B. The evidence base

## B.1 Affect labelling — the case has substantially collapsed

Three claims are routinely chained to justify "get the child to name the feeling." Taken in
order, they get weaker, and the third is contradicted.

### B.1.1 What Lieberman et al. 2007 actually did

**Lieberman, Eisenberger, Crockett, Tom, Pfeifer & Way (2007), "Putting Feelings Into Words,"
*Psychological Science* 18(5):421–428.**
[doi:10.1111/j.1467-9280.2007.01916.x](https://doi.org/10.1111/j.1467-9280.2007.01916.x) ·
PMID [17576282](https://pubmed.ncbi.nlm.nih.gov/17576282/) ·
[PDF](https://teams.semel.ucla.edu/sites/default/files/publications/May%202007%20-%20Putting%20Feelings%20Into%20Words.pdf)
**[A — single fMRI study, n=30 adults aged 18–36].**

Statistics extracted from the PDF. The critical contrast (affect-label vs gender-label, the
authors' own stated best control): **t(29) = 2.14, prep = .93, d = 0.79**; covarying reaction
time, d = 0.77. RVLPFC↔amygdala inverse correlation **r = −.51, n=30**.

**Five things that do not travel with the citation:**

1. **The paper measured no feelings.** There is no self-report of emotion anywhere in it.
   The foundational study for "naming your feeling makes you feel better" never asked anyone
   how they felt. The outcome is entirely BOLD signal.
2. **The amygdala was not "calmed."** *Every* labelling condition produced **increased**
   amygdala activity relative to the shape-match baseline (affect-label d=0.92, affect-match
   d=1.49, gender-label d=1.86, gender-match d=1.13). Affect labelling produced *less* than
   the others. That is a **relative contrast between two button-press tasks**, not
   downregulation of emotion.
3. **prep ≈ .92–.93** is roughly p ≈ .04–.05, at n=30, in an ROI analysis.
4. **r = −.51 at n=30** is exactly the design that
   [Marek et al. 2022, *Nature*](https://doi.org/10.1038/s41586-022-04492-9) (n ≈ 50,000)
   showed requires **thousands** of participants to reproduce.
5. **The stimuli were photographs of strangers' faces.** Not the participant's own feeling.

> ⚠️ **The clearest case of laundering in this file.** A relative BOLD contrast between two
> button-press tasks on strangers' faces, n=30, no feelings measured → "naming an emotion tames
> the amygdala" → a design principle for children's software.

### B.1.2 Replication

**No registered replication of Lieberman 2007 exists.** What exists: Brooks et al. 2017,
*SCAN* [SR, 386 studies] — emotion words present → more semantic activation; absent → more
amygdala. Strongest neural support, but coordinate-based across studies and **equally
consistent with a purely semantic/attentional account** rather than a regulation account.
Lin et al. 2026 (n=37) consistent, small. Vives et al. 2021 (n=26 bilinguals): labelling in a
*foreign* language produced **higher** amygdala activation — the effect is not about naming,
it is about *which* naming.

**Verdict: weakly supported.** Direction observed several times in small samples by overlapping
groups; no well-powered direct replication; neuroimaging power literature says n=26–37 cannot
settle it.

### B.1.3 There is no meta-analysis, and the canonical review is not one

Exhaustive Europe PMC / PubMed search found **no meta-analysis of affect labelling as an
emotion-regulation strategy** [A — negative finding]. **Torre & Lieberman (2018),
*Emotion Review* 10(2):116–124** (412 citations) is an explicitly **narrative review by the
originating lab** — no pooled effect size, no systematic search, no bias assessment.
Practitioner literature routinely cites it as though it were a meta-analysis of intervention
effects. **Do not cite it for effect magnitude.**

(The paper often half-remembered as "the affect-labelling meta-analysis" is most likely
Seah & Coifman 2022 — which is about *emotion differentiation*, r = −.15, see §B.2.)

### B.1.4 What happens to how people actually feel — the decisive evidence

**⭐ Ariely, Mokady, Reggev & Anholt (2026), *Affective Science*.**
PMID [42311801](https://pubmed.ncbi.nlm.nih.gov/42311801/) ·
[full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC13269579/)
**[A — TWO PREREGISTERED experiments, n=111 and n=115. Best-designed study in this literature.]**

| Comparison | Study 1 | Study 2 |
|---|---|---|
| **Name vs Look** (does labelling help at all?) | t(51.99)=1.53, **p=.129**, d=.42 | t(61.91)=1.62, **p=.109**, d=.39 |
| **Name condition, change from baseline** | t(23)=3.75, p=.001, d=.77 — **negative affect INCREASED** | t(34)=3.01, p=.004, d=.51 — **INCREASED** |
| Reappraise vs Name+Reappraise | t(42.94)=4.97, p<.001, **d=1.32** | t(23.7)=2.8, p=.009, **d=.86** |

**Preregistered, adequately powered: naming did not beat passive viewing in either study, and
naming *before* regulating made regulation dramatically worse** — d = 0.86–1.32, larger than
any pro-labelling effect anywhere in this literature. Authors' interpretation: labelling *"may
solidify emerging emotions and limit emotional regulation flexibility."*

This **replicates** **Nook, Satpute & Ochsner (2021), *Affective Science***
(PMID [36043172](https://pubmed.ncbi.nlm.nih.gov/36043172/)), n=80 between + n=60 within,
social desirability ruled out: *"Emotion naming's impact opposes common intuitions."*
Corroborated by Shinpei et al. 2024, *BMC Psychology*
([doi](https://doi.org/10.1186/s40359-024-02103-y)): labelling + reappraisal was **less
effective than reappraisal alone**.

**Lieberman, Inagaki, Tabibnia & Crockett (2011), *Emotion*** [A, 4 studies] — the lab's own
follow-up, more equivocal than its citation record: labelling *did* lower self-reported
distress vs passive watching. **But** "people do not believe affect labeling to be an effective
emotion regulation strategy… even after having the experience." And **Study 4: with *positive*
pictures, "affect labeling was associated with diminished self-reported pleasure."** The
authors conclude labelling *"tends to dampen affective responses in general, rather than
specifically alleviating negative affect."*

> ⚠️ **Load-bearing for a children's product and almost never mentioned: the mechanism is
> affective *blunting*, not negative-affect relief.** A daily "name how you feel" ritual, if it
> works at all, plausibly flattens good days as much as bad ones.

**Other outcome-level results:**

| Study | Design | Result |
|---|---|---|
| Niles et al. 2015, *Behav Res Ther* | RCT, public-speaking exposure ± labelling | Physiological benefit. **"No effect for self-report measures."** |
| Kircanski et al. 2012, *Psych Science* | Spider exposure, 1-week follow-up | Reduced skin conductance at 1 week — delayed, physiological only |
| **Constantinou et al. 2014**, n=61 | labelling vs **non-emotional** labelling | **"Labeling, either emotional or non-emotional, significantly reduced experienced affect."** ⚠️ **Specificity failure — the "affect" part may not be what matters** |
| Constantinou et al. 2015, IBS, n=29+26 | clinical replication | *"Labeling the pictures did not reduce these effects significantly."* **Null** |
| **McHugh et al. 2024**, *Psychol Addict Behav*, **RCT n=119** | reappraisal vs labelling vs control | **Null** on negative affect, cortisol, skin conductance; labelling produced **greater craving increases** |
| Burklund et al. 2024, PTSD veterans | open intervention | **n = 13**, no control. Cited as "promising neuroscience-based approach" |

### B.1.5 ⭐ Does it transfer to naming your OWN everyday feelings? — No, and Lieberman's own lab documented why

**This is the single most decision-relevant finding in the file.**

Jared Torre's UCLA dissertation, *How Putting Feelings into Words Reduces Our Emotional
Experiences* ([eScholarship qt2022s38d](https://escholarship.org/uc/item/2022s38d)), written
under Lieberman, contains a section headed *"Can label source explain the inconsistent timing
of effects?"* Verbatim:

> *"One feature many of these studies showing delayed effects have in common is that in most
> cases the task protocol required participants to **generate affect labels themselves** rather
> than have them be provided… In fact, **the only cases where affect labeling significantly
> increased self-reported affect or autonomic arousal during the initial exposure also adopted
> a paradigm that required participants to self-generate and verbalize their emotional
> experiences**."*

And again:

> *"…additional processes brought online by self-generating labels may **adversely impact the
> success of affect labeling**."*

**Read that as a design finding.** The paradigm producing the classic effect is *two words on a
screen, pick the matching one, about a stranger's face, within seconds* — a **forced-choice
perceptual categorisation task**. What a person does when naming their own feeling —
introspect, search the lexicon, generate, verbalise — is the condition where the immediate
effect **disappears or reverses**. Torre notes the parallel with expressive writing: benefits
appear months later, while many report *more* negative affect immediately after writing.

**Verdict on transfer: not supported, and actively contradicted by the moderator the
originating lab identified.**

There is a real design consolation here, and it is specific: **a fixed palette of provided
options is the *supported* paradigm; a free-text "describe how you feel" box is the
*contradicted* one.** See §E.6.

### B.1.6 Boundary conditions

Labelling works **better** when: the emotion is moderate-to-high intensity; labels are
**provided/constrained** rather than generated; labelling happens **early** in the emotional
stream; and in the native language. It works **worse or backfires** when: self-generated; done
*before* another regulation attempt; **on low-intensity states**; or in a second language.

**⭐ Levy-Gigi & Shamay-Tsoory (2022), *PLoS ONE***
([PMC9799301](https://pmc.ncbi.nlm.nih.gov/articles/PMC9799301/)) [A] — labelling reduced
distress under **high** intensity but **may increase it at low intensity**.

> **This is a specific, citable argument against a fixed daily cadence.** A scheduled prompt
> catches a child overwhelmingly in the low-intensity case — the side where the evidence says
> labelling may make things worse. It argues for an **always-available, child-initiated** entry
> point over a scheduled morning ritual.

Note the interaction with §B.1.5: the Dutch/native-language point is not incidental for this
household — labels must be in Dutch, not English.

### B.1.7 "Name it to tame it"

Coined by **Dan Siegel & Tina Payne Bryson, *The Whole-Brain Child* (2011)** [popularization].

⚠️ **Published academic critiques of Siegel's framing could not be verified** (search blocked)
[U]. So this is not "critics say"; it is a direct comparison of the slogan against the primary
sources:

| Slogan implies | Evidence says |
|---|---|
| Naming *calms* the amygdala | Amygdala was *elevated* in all labelling conditions vs baseline; effect is relative between tasks |
| Naming makes you feel better | Two preregistered studies: no better than passive viewing; negative affect *increased* |
| Applies to children | **Zero randomised evidence in children**; source study was adults 18–36 |
| Applies to your own feelings | The self-generation condition is where the effect fails |
| Specific to *emotion* words | Non-emotional labelling worked just as well |
| Targets negative affect | Blunts positive affect too |

## B.2 Emotional granularity — correlational, inconsistent, and possibly an artifact

**Barrett, Gross, Christensen & Benvenuto (2001), *Cognition & Emotion*** — 1,063 citations
[A, correlational]. ⚠️ **What it found is not what it is cited for.** The finding is that
higher-granularity people **used more regulation strategies** — not that they regulated
*better*, felt less distress, or had better outcomes. **N could not be verified** (paywalled,
absent from every index checked) — flag any N you see quoted [U].

**Kashdan, Barrett & McKnight (2015), *Current Directions*** — 344 citations. **[C — REVIEW /
position piece, zero new data.]** Citing it as evidence cites an opinion *about* the literature.

**The best-powered test found essentially nothing.** Kalokerinos, Erbas, Ceulemans & Kuppens
(2019), *Psychological Science* [A] — two ESM studies, **n=200 and n=101, 34,660 and 6,282
momentary observations**: *"few relationships between differentiation and the selection of
putatively adaptive or maladaptive strategies."* With ~175× the observations of Barrett 2001,
differentiation did not predict strategy choice. Corroborated by O'Toole et al. 2021 (n=90) and
**Hohensee et al. 2025, *Emotion*** (n=172 **youth**, 28-day diary, >3,500 entries):
*"Results for emotion differentiation were mostly nonsignificant."*

> ⚠️ **Clarity ("I know what I'm feeling") and differentiation (ICC of ratings) dissociate, and
> clarity is the one carrying the signal.** They are routinely conflated in popular writing and
> in product design.

**The causal arrow may point the other way.** Erbas et al. 2018, *JPSP* [A]: *"stress on 1 day
negatively predicted the level of differentiation… on a next day."* Low granularity looks more
like a **state indicator of load** than a trainable skill.

**Measurement critique — the strongest skeptical material:**

- **Two "emotion differentiation" measures don't correlate with each other.** Ottenstein &
  Lischetzke 2020 (n=111/190): specificity index vs ICC index, **r = −.03**. Zero convergent
  validity.
- **The bounded-scale artifact, proven for the sibling construct.** Kalokerinos et al. 2020,
  *PNAS* [SR, 11 studies, n=1,205, 83,411 observations] — a famous textbook association
  **vanished entirely** once the arithmetic dependency between variability and mean on bounded
  scales was corrected. **The equivalent correction has never been published for
  differentiation.** Nook concedes the point directly.
- **Circularity.** Nook: *"if participants with low motivation in fact experienced highly
  differentiated emotional experiences but provided homogenous emotion ratings due to a lack of
  task engagement, this could produce a spurious correlation."* Depressed people fill in surveys
  more lazily; that alone can generate the literature.
- **⭐ The index rises just from being measured.** Hoemann, Barrett & Quigley 2021 [A]:
  *"increases in emotional granularity over time were facilitated by methodological factors,
  such as number of experience sampling prompts responded to per day."* **An app that samples
  emotions frequently will show "granularity gains" with no underlying change.** Any
  Kynite-side "look how your emotional vocabulary is growing" metric would be measuring its own
  prompt rate.
- **Field-wide reckoning.** Dejonckheere et al. 2019, *Nature Human Behaviour* [SR, 15 studies,
  n=1,777]: affect-dynamics measures *"have little added value over mean levels of positive and
  negative affect."*

**⭐ The self-report association may not even be about differentiation.** Fugate, Gendron &
Hoemann (2025), *Affective Science* [A, six studies]: *self-reported understanding* of emotion
words related to less regulation difficulty **even controlling for self-reported granularity** —
i.e. the association may track **metacognitive confidence**, not actual differentiation. This
converges with the clarity-vs-differentiation split above.

**Meta-analysis:** Seah & Coifman 2022, *Emotion* [SR, 17 studies] — **r = −.15** (~2% of
variance). Whiting & Nook 2026 [SR, **31 studies**, preprint, **from Nook's own — sympathetic —
lab**]: findings *"highly inconsistent,"* attributed to "substantial methodological heterogeneity
in measurement practices." *Coming from that lab, this is close to dispositive: the mechanism
story is not established.*

**Causal manipulation is close to absent at any age.** The only experimental hits are Wang, Xu &
Pan 2026 [A, **RCT n=47**, alexithymia — but a **multi-modal package**: vocabulary training *plus*
expressive writing, so granularity cannot be isolated] and Leijse et al. 2026 [A, **n=22, ages
12–23, single-case design, no control group**]. **And the construct has barely been studied below
age 10** — every youth granularity study retrieved is adolescent (Lian 2025 n=407 ages 13–14;
Weissman 2025 n=80 ages 13–18; Liu 2026 n=140 M=11.9; Bragt-De Jong 2026 M=13.8).
Nook's own number: **a 40% significance rate.** Preregistered null on the core mechanism:
Schmitt et al. 2025 (n=153+218), six EF tasks, all null.

**⭐ Does teaching emotion words improve outcomes? The preregistered answer is no, possibly
backwards.** **DeLap, Vine, Santee & Starr (2025), *Emotion***
(PMID [39325393](https://pubmed.ncbi.nlm.nih.gov/39325393/)) [A — **preregistered**, n=241
adolescents 14–17, NLP-derived vocabulary]: *"larger negative EV and lower negative ED were
each uniquely associated with depression."* **Adolescents with bigger negative emotion
vocabularies were more depressed.**

**What survives:** emotion **understanding** is trainable — Sprung, Münch, Harris, Ebesutani &
Hofmann 2015, *Developmental Review* [SR, 19 studies, 749 children, mean age 7;2]: Hedges' g
**0.31–0.64**. And Izard et al. 2008 [A, Head Start, **cluster-randomised, active comparator**]
showed downstream effects **mediated by emotion knowledge** — the single strongest causal
evidence in the area. Note that both are about *understanding*, taught by adults over time —
not about a child tapping a button.

**Emotion knowledge → social competence:** Trentacosta & Fine 2010 [SR, ~116 samples, N>9,000]
— **r = .22** (~5% of variance), authors' own word *"modest"*; **weakest in young community
samples** (externalizing r = −.11 to −.15), i.e. weakest exactly where a family product
operates. Informant mattered enormously: **parent report r = −.05** vs observer −.33.

## B.3 Developmental vocabulary and self-report capacity — the hardest constraints

### B.3.1 How many response options a young child can actually use

**⭐ Coombes et al. (2021), *Quality of Life Research*** —
[doi:10.1007/s11136-021-02814-4](https://doi.org/10.1007/s11136-021-02814-4)
**[SR — PRISMA, 81 studies screened from 13,215 articles. The single most useful citation for a
4–9 product decision.]**

- **"Children < 5 years old cannot validly and reliably self-report health outcomes."**
- **Children ≤ 7 "think dichotomously so need two response options."**
- **Children > 8 "can reliably use a 3-point scale."**
- **Face scales demonstrate better psychometric properties than visual analogue or Likert scales.**
- Computerised and paper equivalent for construct validity; children *prefer* computerised.

**Tsze et al. 2013, *Pediatrics*** [A]: *"convergent validity was questionable in children <7
years old."* **Tsze et al. 2018, *Ann Emerg Med***: strong validity 6–17, *"not strong for
children aged 4 and 5."* **von Baeyer 2006** [B]: ~5 is the floor for *any* meaningful
self-report given developmentally appropriate tools.

> **~5 buys you a number; ~7 buys you a measurement.**

### B.3.2 ⭐ Fewer faces will NOT fix extreme responding

**Chambers & Johnston (2002), *J Pediatr Psychol* 27(1):27**
([doi](https://doi.org/10.1093/jpepsy/27.1.27)) [A] — 60 children in three age bands,
randomised to **3 vs 5 response options**. Younger children responded extremely **on
emotion-based tasks but not physical tasks**, and **the number of response choices did not
significantly affect extreme responding.**

If anyone proposes "just use 3 faces for the little ones," this study says it does not buy what
it appears to buy. The fix people reach for first is the one that was tested and failed.

### B.3.3 The "kids just pick the happiest face" folklore is weaker than assumed

**Read & Horton (2025), *Interacting with Computers***
([doi:10.1093/iwc/iwaf016](https://doi.org/10.1093/iwc/iwaf016)) [A] — **from the
Smileyometer's own author**, substantially walking back the folklore:

- Ages 3–4: mean ~4 of 5, but *"a skew but also… what might be considered a healthy
  distribution of the lower scores."* **Very young children did *not* rate everything
  "Brilliant."**
- Ages 8–11: only **4 of 135 children (2.96%)** gave the top rating to everything across three
  evaluations — **against the historical ~60% "Brilliant-Brilliant" pattern** from Read et al.
  2002.
- A real bias remains (top-top pairs 3–10× chance) and the age gradient is real: 6–7s mean 4.8,
  13–14s mean 4.3.

**Honest reconciliation:** these are different constructs under different stakes. Read & Horton
is children rating *games they just played*, with no adult consequence. The "always green zone"
reports are children reporting *their own internal state to an adult who may act on it*, and
the Finch quote is a user *gating a reward loop*. The degraded-input concern rests on the
second kind of evidence and survives. But **"kids just pick the happiest face, it's a known
bias" is now too strong to use as a justification on its own.**

Related design note: the **Faces Pain Scale-Revised deliberately uses neutral, non-smiling
anchors with no tears** ([von Baeyer 2007 advisory, *Pain* 130:196](https://doi.org/10.1016/j.pain.2007.04.028))
[B — advisory's existence verified via Crossref; rationale text not read this session] because
facial affect *contaminates* the rating. A mood check-in *wants* the affect — but the
underlying point holds: **your happiest and saddest faces are not neutral stimuli, and how they
are drawn biases the response.**

### B.3.4 ⭐ Which emotion words a child of 4–9 actually understands

**Sturrock & Freed (2022), *Frontiers in Psychology***
([doi:10.3389/fpsyg.2022.982676](https://doi.org/10.3389/fpsyg.2022.982676)) [A — n=171, ages
5;0–13;11, 39-item receptive test + 60-second production task].

**Receptive (39 items), mean correct:**

| Age | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
|---|---|---|---|---|---|---|---|---|---|
| Mean | 15.0 | 18.7 | 22.3 | 23.1 | 27.7 | 27.7 | 30.3 | 30.9 | 30.6 |
| SD | 5.8 | 6.9 | 5.8 | 6.8 | 3.0 | 4.7 | 3.8 | 2.4 | 3.8 |

**Words reaching ≥70% receptive accuracy at age 5:** happy, afraid, excited, worried, angry,
disgusted, **proud**. **Added at 6:** surprised, confused, gloomy.

> ⚠️ **Three words NEVER reached 70% receptive accuracy at any age through 13: *humiliated*,
> ***frustrated***, and ***embarrassed***.**

That is a direct answer to "angry vs frustrated," and it is worse than the folk assumption.
And note the trap: **embarrassed was the third most frequently *produced* word (66.7%) while
never being reliably *comprehended*.** **Children produce words they do not understand.** A
design that infers comprehension from production will be systematically wrong.

**Expressive (words generated in 60 s):** age 5 M = **6.47**; age 8 M = 8.39; age 9 M = 9.76;
age 12 M = 12.06.

> ⭐ **A five-year-old's *entire productive* emotion lexicon under time pressure is about six or
> seven words.** Any picker offering more options than that is offering options the child cannot
> generate unaided — which is fine for a *provided* set (§B.1.5 says provided is the supported
> paradigm) but fatal for anything free-form.

**Große et al. (2021), *Affective Science*** ([PMC9382957](https://pmc.ncbi.nlm.nih.gov/articles/PMC9382957/))
[A — n=123 children ages 4–11 + 27 adults, free production]: at **ages 4–5 the two most frequent
responses were not emotion words at all** — unspecific negative ("bad") **20.1%** and unspecific
positive ("good") **18.8%**; then **sad 31.1%**, **happy only 8.3%**. Convergence with adult
usage (Spearman): **4–5: .33 → 6–7: .41 → 8–9: .44 → 10–11: .55** — explicitly *"not finished
yet"* at 10–11.

**Widen (2013), *Emotion Review*** [C — narrative review, 302 citations]: *"Initially, children
divide facial expressions into two simple categories (feels good, feels bad)… gradually
differentiated… **likely in the teen years**. Children's understanding of most specific emotions
begins **not with facial expressions, but with their understanding of the emotion's antecedents
and behavioral consequences**."* → **teach differentiated emotions through situations, not
faces.** Corroborated by Weissman et al. 2025 (n=184, ages 4–25): "happy" sensitivity peaked by
**4**; "angry" plateaued ~7; **fear did not plateau until 15, sadness until 16**, and
low-intensity fear morphs were frequently mislabelled "sad" by children.

**Sad vs disappointed — the answer is ~7, and 5-year-olds get it backwards.** Disappointment is
a *counterfactual* emotion. Guttentag & Ferrell 2004, *Developmental Psychology* [A]:
participants aged 7+, **but not 5-year-olds**, took the counterfactual into account; in Exp. 2
**5-year-olds judged someone would feel *better* when the counterfactual outcome was better —
the opposite of the adult pattern.** Ferrell et al. 2009 (n=102, ages 5–8): *"Only the
8-year-olds became significantly more adult-like, and only when the counterfactual was made
highly salient."* O'Connor et al. 2014 (n=326): regret and adaptive decision-making *"both first
appearing at about 7 years."*

### B.3.5 Pons & Harris TEC — and its real numbers

**Pons, Harris & de Rosnay (2004), *EJDP* 1(2):127–152** — **906 citations, n = 100 across five
age bands ≈ 20 children per age cell.**

> ⚠️ **That N is the fact nobody quotes.** A nine-component, three-phase developmental
> architecture underpinning curricula and SEL products rests on ~20 children per age point in
> one cross-sectional sample. Worse, **sources disagree on which components belong to which
> phase**, including papers Harris himself co-authored. The broad ordering (recognition/cause →
> belief/hiding → mixed/moral) is robust; **the tidy 3×3 table is not.**

**Real per-component pass rates** — Göbel et al. 2016, *Front Psychol*, n=135:

| Component | 7 yrs | 8 yrs | 9 yrs | 10 yrs |
|---|---|---|---|---|
| I Recognition | 100% | 100% | 100% | 100% |
| II External cause | 100% | 100% | 100% | 100% |
| III Desire | 85% | 73% | 82% | 100% |
| **IV Belief** | **41%** | **55%** | **65%** | 82% |
| V Reminder | 62% | 82% | 77% | 94% |
| VI Regulation | 79% | 73% | 82% | 94% |
| VII Hiding | 79% | 97% | 85% | 97% |
| VIII Mixed emotions | 65% | 82% | 88% | 100% |
| **IX Morality** | **44%** | **42%** | **59%** | **44%** |

Three points contradicting the standard story: **recognition and external cause are at ceiling
from 7** (so anything testing "name the face" measures nothing after ~6); **belief-based emotion
is the real bottleneck at 7–8**; and **moral emotions do not develop monotonically.**

**Sobering methodological note:** Morra et al. 2010 (n=130, ages 5–11): *"The significant effect
of age on emotion comprehension was eliminated when working memory capacity was co-varied."*
And Grazzani 2018 (n=389): **language ↔ emotion understanding r = .51.** Emotion-understanding
tests are substantially verbal-ability and working-memory tests.

### B.3.6 ⭐ Emotion differentiation FALLS into adolescence — and why that deflates on reading

**Nook, Sasse, Lambert, McLaughlin & Somerville (2018), *Psychological Science***
([PMC6088506](https://pmc.ncbi.nlm.nih.gov/articles/PMC6088506/)) [A, n=143, ages 5–25]:
differentiation *"fell from childhood to adolescence and rose from adolescence to adulthood."*

⚠️ **Read the mediator.** High "differentiation" in young children was explained by their
tendency **to report feeling emotions one at a time**. **An ICC-based differentiation score
cannot distinguish "granular emotional expert" from "child who has not yet learned that
emotions co-occur."** Meanwhile the **lexicon** grows monotonically. **Vocabulary and
ICC-differentiation are different constructs moving in different directions. Do not build a
granularity score for children.**

Supporting: Fotheringham et al. 2021 (n=211, ages 4–10) — 4–5-year-olds reported a **single**
emotion 61% of the time; the *"biggest development… occurs between 4–7."* Self-reported
*experience* of mixed emotions lags recognition by years and is still incomplete at 12.

### B.3.7 Is there any evidence for affect labelling in young children?

**One correlational study and no clean trial.** **Zhu, Ip, Liu & Yan (2026), *Child
Development*** (PMID [41718720](https://pubmed.ncbi.nlm.nih.gov/41718720/)) [A —
**correlational**]: n=334 Chinese preschoolers, mean 62.3 months. Labelling ability → regulation
**β = 0.28 (parent-report), β = 0.19 (teacher-report)**; daily-diary subsample (n=181, 14 days)
found within-child daily labelling associated with faster same-day recovery. No random
assignment, no manipulation; cross-sectional βs use exactly the informant type Trentacosta found
weakest. The within-child diary effect is the strongest part but cannot rule out reverse
causation.

**Randomised evidence in under-10s: essentially one hit** — **Maeng et al. (2026)**
([doi:10.5765/jkacap.250059](https://doi.org/10.5765/jkacap.250059)), **n=43, ages 5–12**, where
affect labelling is one ingredient inside **16 sessions of manualised psychodynamic play therapy
plus 4 parent sessions**, and the outcome measured was oppositional-defiant symptoms. **Completely
confounded — it cannot isolate labelling.**

Supporting correlational work, all cross-sectional, all with **general language ability as the
obvious confound**: Nencheva, Nook, Thornton, Lew-Williams & Tamir (2024), *Affective Science*
[A, **n=904, under 5**] — larger general vocabulary co-occurred with more emotion labels and more
organised emotional transitions.

**⭐ A hard constraint on measuring any of this:** Birnie et al. 2019, *Pain* [SR, COSMIN-graded,
80 papers] — *"**no measures were recommended for children younger than 6 years**."* And von
Baeyer et al. 2017, *J Pain* [SR, 617 studies screened]: **98% of "valid for 3–4-year-olds"
claims were obtained by pooling 3–4s with older children.** Disaggregated, the claim evaporates.
**Expect the identical pattern in any "validated for ages 4–10" claim you encounter.**

**Depth beats size in exactly this age band.** Streubel et al. 2026, *Sci Rep* [A, n=197 German
preschoolers 4–6]: emotion-vocabulary **size × depth interacted**; **depth (adult-like use)
compensated for size**. Shipkova et al. 2025, *Emotion* [A, n=252, ages 4–8]: emotion word
knowledge predicted parent-reported adaptive regulation.

## B.4 Zones of Regulation and RULER — neither shipped artefact has standalone evidence

### B.4.1 Zones of Regulation — the complete evidence census

The **entire** Zones literature is roughly a dozen items. This is the corpus, not a selection:

| Study | Design | N | Result | Independent? |
|---|---|---|---|---|
| **Mason, Leaf & Gerhardt (2023/24)**, *J Special Education*, [doi](https://doi.org/10.1177/00224669231170202) **[SR]** | systematic review 2011–2021; 37 screened → **3 eligible** | — | "very little empirical evidence… **does not meet the standards for an evidence-based practice**" per APA, National Standards Project and NCAEP | **Yes** |
| **Ochocki et al. (2020)** [A] | **RCT**, Tier 2, 12 lessons/6 weeks | 63 | **NULL** — "did not result in statistically significant decreases in disruptive behavior or improve self-control" | Yes |
| **Conklin & Jairam (2021)** [A] | **Randomised**, SAEBRS | 56 | **NULL** — "no statistical difference… between the two groups" | Yes |
| Nowell et al. (2019), JSLHR [A] | RCT; self-regulation arm used Zones concepts | 17 | Concept knowledge improved; **did not generalise** | Yes |
| Peters, Gabriels et al. (2024), *OTJR* [A] | **single-arm feasibility, no control** | 14 | pre-post decreases | Yes |
| Browne et al. (2025) [A] | qualitative acceptability | 6 | children liked **the horses**; found "the Zones… **less acceptable**" | Same team |
| Öhlböck et al. (2023), *BJSE* [A] | pre/post, no control; outcome = **teacher** self-efficacy | teachers | p<0.001 | Yes — but **measures adults** |
| Love, Gibbs, Cai et al. (2024) [A] | qualitative teacher feedback | 26 teachers | "**no peer-reviewed evidence currently exists to support the use of The Zones**" | Yes (Autism CRC) |
| Dunn 2019; Munro 2017; Hoffman 2018; Ostrander 2019; Lalor 2020; Grass 2026 | dissertations | small | mixed | **Not peer reviewed** |

**Two randomised trials exist. Both are null.** Everything positive is uncontrolled pre-post, a
feasibility study, a dissertation, or measures teachers rather than children. ASAT's review
concludes: *"there is insufficient proof that Zones of Regulation has any positive effect on the
development of self-regulation skills"* [B], citing Romanowycz et al. 2021 where **five of six
studies had moderate-to-high risk of bias** and results ranged *"from no change to **increased
challenging behaviour**."*

**Vendor claim vs source** [V]: the [Zones research page](https://zonesofregulation.com/research-and-evidence/)
asserts positive outcomes and **cites nothing at all**. The
[Evidence of Effectiveness brief](https://zonesofregulation.com/wp-content/uploads/2024/09/Evidence-of-Effectiveness-Brief.pdf)
headlines **"The Zones of Regulation is evidence-based"** — the exact claim the only independent
systematic review rejects — spotlights an **unpublished doctoral dissertation** and the **n=14
single-arm feasibility study** as outcome findings, presents a **vendor-run, non-randomised,
non-baseline-equivalent** pilot (23.7% of intervention children at "Need for Instruction"
pre-test vs 10.0% of comparison — an asymmetry that can manufacture the effect through
regression to the mean), and offers **"practice-based evidence"** (testimonials) as a co-equal
evidence category. Real RCTs are underway (Emory, Colorado State, Wisconsin, Penn); **none have
reported.**

### B.4.2 The compliance critique

**The strongest evidence comes from Zones' own advocates.** Autism Inspired Academy, describing
whole-school adoption, defines Green as *"a calm, focused, **ready-to-learn** state"* and the
goal as reaching *"a state where learning and connection are possible"* [C — **a pro-Zones
page**]. **The moment "regulated" is operationally defined as "available for instruction," the
framework has become behaviour management** — regardless of the doctrine that all zones are OK.

The same slippage appears in adjacent products' scripts for 4–8s: Class Catalyst's
[K-2 lesson](https://classcatalyst.com/introduction-lessons/kiosk-mode/) has the teacher say
*"is it easy or hard to learn? … it is hard to focus and learn when feeling angry, upset,
worried… get ready to learn."* The purpose stated to a five-year-old is not "your feelings
matter"; it is **"your feelings are an obstacle to instruction."**

**Peer-reviewed versions of the critique:**

- **Bartholdsson Å, Gustafsson-Lundberg J, Hultin E (2014)**, "Cultivating the socially competent
  body," *Critical Studies in Education*, [doi](https://doi.org/10.1080/17508487.2014.889733) [A]
  — SEL "self-regulating techniques" produce **"docile bodies"** aligned to social conformity.
- **⭐ Irisdotter Aldenmyr S, Olson M (2016)**, "The inward turn in therapeutic education,"
  *Pedagogy, Culture and Society*, [doi](https://doi.org/10.1080/14681366.2016.1194312) [A] —
  emotional-formation programmes require **"sharing one's innermost"** despite collective
  framings; **the disclosure is individual and exposed even when the ritual looks communal.**
  *This is the precise critique of a visible emotion display.*
- Brunila K (2012) [A] — therapeutic interventions turn young people inward and recast structural
  problems as individual deficits.
- Cipollone, Hoffman & Sciuchetti (2022), "**Compliance and Control: The Hidden Curriculum of
  Social-Emotional Learning**," [doi](https://doi.org/10.58948/2834-8257.1005) [A] — full text
  403'd, detail [U], but the argument exists in the literature, not only on blogs.
- **Alfie Kohn**, ["Why Self-Discipline Is Overrated"](https://www.alfiekohn.org/article/self-discipline/)
  (*Phi Delta Kappan*, 2008) [C] — sharpest line, and it generalises past SEL: **"control from
  within isn't inherently more humane than control from without."** *(Kohn has no SEL-specific
  article — don't attribute one.)*

**Autistic-led critique** [C]: [Brilliant Little Gems](https://brilliantlittlegems.com.au/post/is-zones-of-regulation-neuroaffirming)
makes six charges — compliance over authentic regulation; pathologising emotion via
colour-coding; oversimplification; ignoring root causes (sensory load, unmet needs); encouraging
masking; not designed for neurodivergent people. Sharpest formulation: *"The implicit message
for Autistic folks who may tend towards black and white thinking is: **Green is good, red is
bad**."* **No named author or credentials on the page — grade accordingly.**

⚠️ **I could not confirm that the Therapist Neurodiversity Collective publishes a Zones
critique** — their site search returns nothing and their sitemaps contain no such page. **Treat
that commonly-repeated attribution as [U].**

**The masking argument in full:** praising green and hurrying children out of yellow/red teaches
that distress, frustration and **excitement** are unacceptable in a way that must be hidden. The
long-run cost is burnout, anxiety, and *worse* interoceptive self-knowledge — i.e. **the
framework degrades the very capacity it claims to build.** For 4–9s this is the most plausible
harm channel, because they are learning what emotions *are* at the same time as learning which
ones adults reward.

**⭐ The constructive autistic-led alternative: Autism Level UP's ENERGY.** Amy Laurent and
**Jacquelyn Fede (autistic)**, [autismlevelup.com](https://autismlevelup.com/tools-supports/energy-the-framework-tools-strategies-logic-to-support-regulation/)
[C/B]:

> *"Where is your energy right now? Where do you want it to be for whatever it is you are doing?
> … Are those two answers different? You might be dysregulated and need some kind of tool or
> strategy to make a match. **We find this to be a more realistic, authentic and affirming method
> for thinking about regulation than tying it to socially constructed emotions.**"*

Endorsed by Dr Mel Houser (autistic physician): *"**all energy is OK and there's no one 'right'
way to be!**"*; Kieran Rose; Sarah Selvaggi Hernandez OT.

> **The structural lesson is precise and transferable: ENERGY has no good end and no bad end.**
> Regulation is a **two-term match** — current state vs the state this activity needs — rather
> than proximity to one privileged colour. **There is no green to get back to.** That is what
> makes it resistant to becoming a compliance instrument, and it is available to any state
> display without importing a word of Zones.

**Quiet corroboration from inside the friendly literature:** Browne 2025 — autistic children
found the horses acceptable and **the Zones curriculum less acceptable**. Love 2024 — teachers
said Zones "was not suitable for all students and classrooms."

**Neurodivergence numbers worth having:** **49.9% weighted mean alexithymia prevalence in ASD
populations** (Chalghaf et al. 2026 [SR]) — use this rather than the 40–70% range that
circulates in advocacy writing. Adams, Catmur & Bird 2026, *Autism* [A, n=519, 232 autistic]:
autism associated with **more interoceptive attention, lower accuracy, and more negative
interpretation of bodily signals** — a "check in with your body and name it" prompt loads
precisely that combination. Shek et al. 2026 [A, n=208 ADOS-2-confirmed]: the node **"difficulty
describing feelings to others"** was among the most influential on depressive and anxiety
symptoms. The *harm* claim remains an advocacy inference [C], but **the capacity assumption the
prompt makes is measurably shaky**, and that is enough to design around.

### B.4.3 RULER / Mood Meter

| Study | Design | Authors | Developer-authored? |
|---|---|---|---|
| **Brackett et al. (2012)**, *Learning and Individual Differences* | **Quasi-experimental** pre/post, 30 weeks. N=273, 15 classrooms, 3 schools, grades 5–6. Outcomes: **report-card grades + teacher reports** | All four Yale | **Yes** |
| **Rivers et al. (2013)**, *Prevention Science* | **Cluster-RCT, 62 schools**, N=3,824, grades 5–6, 1 year. Outcome: observer-rated **classroom climate** (CLASS) | All five Yale | **Yes** |
| **Hagelskamp et al. (2013)**, *Am J Community Psych* | **Same 62 schools**, Year 2 + mediation/SEM | All four Yale | **Yes** |
| Reyes et al. (2012) | dosage × implementation quality | All five Yale | Yes |
| Castillo, Fernández-Berrocal & **Brackett** (2013), Spain | **n=47 teachers, not randomised**, self-selected, no no-treatment control, all outcomes self-reported | Brackett co-author | Yes |
| Baumsteiger et al. (2021), Mexico; Castillo-Gualda et al. (2023) | 37 schools; n=207 | 3–4 Yale CEI | Yes |

**(a) The best study measures classrooms, not children.** Rivers 2013 reports **no student-level
outcomes at all**. The only child-outcome study is Brackett 2012, whose outcomes are **grades
assigned by, and behaviour ratings made by, the teachers who delivered the intervention and knew
their condition.** Clustering means its effective N is nearer 15 than 273. Hagelskamp 2013 is not
a second trial — same 62 schools, mediation model tested on the dataset that generated the
hypothesis.

**(b) ⭐ No effect size is publicly retrievable anywhere.** All three core papers are paywalled
with no OA copy (verified via OpenAlex / Semantic Scholar / Unpaywall), and **CASEL's own RULER
entry prints "Effect Size: Not reported" for all three cited studies**
([pg.casel.org/ruler/](https://pg.casel.org/ruler/)). **Anyone who quotes RULER's effect size is
guessing.**

**(c) ⭐ No independent replication and no pre-registered trial exists.** Exhaustive search across
PubMed, Europe PMC, OpenAlex, ERIC and scholar.archive.org found **no RULER efficacy trial by a
team without a Yale author** — Brackett is on every single one, including both "international
replications" [A — negative finding].

**Conflict of interest.** Yale CEI both develops and sells RULER [V] and produces 100% of its
efficacy evidence. The one explicit disclosure in the entire literature exists only because a
small OA journal required it — Castillo et al. 2013, p. 270: **"The third author receives
royalties on RULER materials."** That is Brackett. That same paper is the only one readable in
full, and its results are **mixed with several nulls** (dedication p=.38, emotional exhaustion
p=.38, depersonalisation p=.09) — *the nulls are visible precisely because the full text was
readable.* The authors also disclose that the first author was trained by the developers and
personally observed and coached the lessons: **the evaluator was also the implementer.**

**Independent evaluator ratings — the sharpest finding:**

| Evaluator | Status |
|---|---|
| **CASEL** | **"SELect"** — top tier. But their own page scopes it to **"Pre-K and grades 5 and 6"** — exactly the developer trials' bands. **The badge does not cover grades K–4** (i.e. does not cover Kynite's children). And "Effect Size: Not reported" ×3. CASEL is an SEL *advocacy* organisation — grade [V]/[B], not [SR] |
| **What Works Clearinghouse (IES)** | **No intervention report on RULER** [A — negative] |
| **Blueprints for Healthy Youth Development** | **Not listed.** Site search: "Nothing Found." Blueprints requires independent replication plus sustained effects [A — negative] |
| **EEF (UK)** | No evaluation found [U] |

**⭐ The Mood Meter itself has never been evaluated** [A — negative finding, confirmed by two
independent searches: OpenAlex 48 hits, Europe PMC 36 hits, ERIC 2 hits — none evaluating it;
the ERIC hits *use* it as a data-collection instrument inside other studies]. Its entire
evidentiary standing is borrowed from trials of the whole multi-year, whole-school RULER package
— professional development for every adult in the building, a charter process, meta-moment
training, curriculum integration. **Anyone citing RULER's RCTs to justify shipping a 2×2 mood
grid is making an inference the research does not license. Exactly the same structural problem
as Zones.**

**Critiques:** Wigelsworth et al. 2016 [SR, 89 studies] establishes a developer-involvement
effect in universal school SEL (numeric moderator behind a 403 — **don't quote a figure**);
**RULER sits at the extreme end of all three axes: developer-led, efficacy-stage, home-country.**
Zhao & Sang 2025 [SR, 22 studies, 24,510 students]: SEL → academic achievement **g = 0.08**, and
**"quasi-experimental designs showed stronger effects than RCTs"** — landing directly on Brackett
2012, RULER's only child-outcome study. The CASEL meta-analyses (Durlak 2011, Taylor 2017,
Cipriano 2023) have the same developer-adjacency problem one level up.

**⭐ On the Mood Meter's geometry:** its axes are **valence and energy**. That means it
**inherently** sorts states into pleasant and unpleasant halves. Unlike ENERGY, it *cannot* be
made valence-neutral, because valence is one of its two dimensions. **So Zones' "green is good"
problem is present in the Mood Meter too — arguably more deeply, since it is axiomatic rather
than emergent from implementation.** Zones at least claims all zones are OK and fails at it in
practice; the Mood Meter builds the good/bad axis into its geometry.

Note the asymmetry worth keeping: **the emotional-granularity literature supports RULER's
vocabulary-building aim while giving no support at all to the 2×2 grid as the mechanism.** If
you want the part with research behind it, **it is the words, not the axes.**

### B.4.4 The classroom check-in ritual itself

**⭐ Across Europe PMC and ERIC there is no RCT, no quasi-experiment and no systematic review
evaluating a daily classroom emotion check-in as a discrete practice** [A — negative finding].
Everything cited in its support is one of three borrowed things: adult lab affect-labelling work,
whole-curriculum SEL trials where the check-in is one ingredient among dozens, or Check-In/
Check-Out (CICO).

**The CICO category error, with numbers.** CICO's evidence is genuinely solid — but note the
spread, which tells you how much the estimate depends on method: Drevon et al. 2019 **ḡ = 1.22**
(32 studies); Hawken et al. 2014 **median d = 0.37**; Park & Blair 2020 **g = 0.42**. *Anyone
quoting "1.22" is quoting the most flattering of four.* More important, Campbell & Anderson
(2011, *JABA*) ran a **component analysis** and found most participants sustained gains with
*reduced* components: **the active ingredient is structured adult attention and contingent
feedback — not introspection.** CICO records an *adult's rating of observable behaviour*; a
check-in records a *child's self-report of internal state*. **Different rater, different target,
different mechanism, different tier.** If anyone justifies an emotion check-in by citing CICO,
say plainly that it is a category error.

## B.5 Mood tracking, rumination, and iatrogenic risk — the case AGAINST, stated fairly

### B.5.1 The mechanism claim is real; the dose is small

**Mor & Winquist (2002), *Psychological Bulletin*** [SR, **226 effect sizes**] — self-focused
attention is associated with negative affect; **rumination shows larger effects** than other
forms of self-focus; **private** self-focus tracks depression/GAD, **public** self-focus tracks
social anxiety.

⚠️ **Read it precisely, because it partly argues the other way:** *"self-focus on positive
self-aspects and following a positive event were related to lower valence of negative affect."*
**Direction and valence determine sign.** A prompt oriented to a good thing that happened is not
the intervention this meta-analysis indicts. And it is **correlational** — it is not evidence
that inducing self-focus via an app causes depression. (Pooled r values not retrieved [U].)

**Nolen-Hoeksema, Wisco & Lyubomirsky (2008)** [SR/review] — rumination exacerbates depression,
impairs problem solving, erodes social support; predicts *onset* more consistently than duration.
Note their own distinction: **rumination and adaptive self-reflection are separable.**

### B.5.2 The HCI-specific argument

**Eikey et al. (2021), *Personal and Ubiquitous Computing*** — the canonical statement that
personal-informatics tools designed for *reflection* can instead produce *rumination*.
**[C — THEORY. No data. It does not measure harm.]** Cite it as a hypothesis to design against,
not a finding.

**Luo et al. (2025), ACM DIS** [SR, 172 personal-informatics articles] — tracking adversely
affects "cognitive load, emotional well-being, social acts, and behaviors"; identifies
**data-induced stress and obsessive tracking** as recurring documented consequences.

**⭐ Schueller, Neary, Lai & Epstein (2021), *JMIR Mental Health*** [A, n=22 interviews,
real-world mood-tracking app users] — two findings that hit the value proposition directly:

1. **"Some users reported less inclination to document their negative mood states and preferred
   to document their positive moods."** Self-censorship **in a private, adult, single-user
   context** — before you add siblings and a wall display. **The data is systematically biased
   toward the good days.**
2. The biggest gap users named was the **absence of any interpretation or "what do I do now"
   layer**. Logging without response was experienced as incomplete.

**⭐ Loerakker et al. (2023), *IMWUT*** [A — experimental] — compared positive/neutral/negative
framings of self-tracked data, with and without a reference point: **"Framing techniques have a
significant effect on reflection, rumination and self-compassion."** *The most actionable finding
in the anti-case: the harm is a design variable, not an intrinsic property of tracking.*

### B.5.3 EMA measurement reactivity — mixed, small, and NOT a harm finding

**This is where the anti-case is weakest, and it must be stated honestly.**

**Eisele et al. (2022), *Psychological Assessment*** [A — **best-designed study on this
question**; n=151 randomised to 30/60 items × 3/6/9 per day for 14 days, + 50 interviews]:
**positive affect decreased** over the period; within-person variance and completion times
decreased (habituation); behaviour change was rare; **individual characteristics and sampling
protocol had *inconsistent* effects.** And a striking dissociation: **participants *reported*
their emotional awareness had increased, while the ESM measures showed it *decreasing*.**
*Devastating for the "tracking builds emotional literacy" claim: the subjective sense of benefit
was not corroborated by the measure.* **The authors do not conclude harm.**

**Kivelä et al. (2022), *Frontiers in Digital Health*** [SR, 45 articles / 23 studies, suicide
research]: **"No evidence was found of systematic reactivity of mood or suicidal ideation to
repeated assessments."** In the highest-stakes population there is.

**⭐ Kirtley et al. (2025), *Psychological Assessment*** [A, **n≈1,507–1,788 adolescents**,
10×/day for 6 days] — **no significant differences in disturbance or compliance** by lifetime
self-harm history. **But** adolescents with **active, current, intense** self-harm thoughts rated
the questionnaires more disruptive and taxing. Authors: risk tracks **current state, not
history**.

> **The child the routine is nominally *for* is the child it burdens most.** That is not a reason
> not to build one. It is a decisive reason not to make it **mandatory**.

**Rowan et al. (2007)** [A, n=96, **true no-EMA control**]: of 20 subscales × 3 timepoints, 3
differed at time 1 and 3 *different* ones at time 3 — at or near chance. Authors: *"the
inconsistent pattern across time indicates that further research is needed."*

Where reactivity **is** found it is mostly behavioural, not affective, and sometimes beneficial
(Kalina et al. 2026, n=138 randomised: EMA **increased** protective behavioural strategy use).
Nulls: Stein & Corte 2003 (n=16); Dornonville de la Cour 2026; Lin et al. 2026 (86.8% adherence,
"no evidence of fatigue"). Qualitative counterpoint: Spangenberg et al. 2026 — some participants
reported suicidal thoughts *"occasionally intensifying/being triggered by survey prompts"*, but
**no evidence EMA triggered suicidal actions**.

> 🔴 **Verdict: the EMA reactivity literature does NOT support "asking someone daily how they
> feel makes them feel worse."** It supports: habituation and declining response variance (a
> **data-quality** problem); a small, inconsistent, domain-specific signal; a small decline in
> positive affect in one good randomised study; and elevated burden among the acutely distressed.
> **If you present reactivity as strong counter-evidence you will be overstating it and it will
> be caught.**

### B.5.4 Digital mental health: small effects, unreported adverse events

- **Goldberg et al. (2022), *PLOS Digital Health*** [SR of 14 meta-analyses, 145 RCTs, 47,940
  participants]: **"We failed to find convincing evidence of efficacy."** Best tier was
  "highly suggestive": d = 0.32–0.47 vs **inactive** controls. **"The magnitude of effects and
  strength of evidence tended to diminish as comparison conditions became more rigorous."**
  **"Adverse effects were not reported."**
- **Linardon et al. (2024), *World Psychiatry*** [SR, 176 RCTs]: depression **g=0.28** (NNT
  11.5), anxiety **g=0.26** (NNT 12.4). Small but real.
- **⭐ Linardon et al. (2024), *Health Psychology Review*** [SR, 69 RCTs, stress]: g=0.27 →
  **g=0.10** (95% CI 0.02–0.19) after publication-bias adjustment. And — directly relevant —
  **"apps with stress *monitoring* features paradoxically produced smaller efficacy estimates."**
  *Suggestive and quality-confounded, but the closest thing to direct meta-analytic evidence that
  a monitoring component adds nothing or subtracts.*
- **Linardon et al. (2024), *npj Digital Medicine*** [SR, adverse events]: **171 trials
  identified; only 55 reported adverse events.** Pooled deterioration 6.7% (95% CI 4.3–10.1,
  I²=75%) — **but deterioration did not differ significantly between app and control.** ⚠️ **Be
  scrupulous: the 6.7% is a base rate, not attributable to apps. The finding is that we cannot
  tell.**
- Linardon et al. (2025), *BMJ Mental Health*: adverse-event reporting improving (OR=1.32/year)
  but **still under 35% of trials.**

### B.5.5 Iatrogenic effects of emotion-focused interventions in children

**⭐ MYRIAD — Montero-Marín et al. (2022), *Evidence-Based Mental Health*** [A — cluster-RCT,
**84 schools, N=8,376, ages 11–13**]: school-based mindfulness **"resulted in worse scores on
risk of depression and well-being in students at risk of mental health problems"** at
post-intervention *and* 1-year follow-up. **"Higher dose and reach were associated with worse
social-emotional-behavioural functioning."** Conclusion: not recommended as universal; *"may be
contraindicated for students with existing/emerging mental health symptoms."*

⚠️ **The authors themselves state the differences were "small and not clinically relevant."**
Do not oversell it. **The part to respect is the dose-response direction**, which is the one
finding here that speaks directly to cadence.

Foulkes & Stringaris (2023), *BJPsych Bulletin* [C — narrative review]; Guzman Holst et al.
(2024) scoping review [SR — ⚠️ **preprint**, peer-review status unconfirmed].

**⭐ Sandra et al. (2025), *Psychological Medicine*** [A — **double-blind RCT, N=215,
preregistered**]: an ADHD-awareness workshop **reliably increased false self-diagnosis**
(β=0.80 immediately; β=0.50 at 1 week) **with no change in reported symptoms**. A brief "nocebo
education" component halved it immediately and eliminated it at follow-up. **Mechanism: making a
category salient makes people apply it to themselves, absent any real change in state.**
*(Adults — extrapolate with care.)* **A daily "how do you feel?" widget makes a category salient
every single day.** Haslam & Tse 2024 [C]: concept creep — *"People have become better at
recognizing the presence of mental illness but may have become worse at recognizing its
absence."*

### B.5.6 ⭐ The decisive gap, stated plainly

**No study exists of routine mood self-tracking, mood self-rating apps, or EMA reactivity in
children aged 4–9.** The EMA reactivity literature is adults and adolescents 12+. The
mood-tracking-app literature is adults, largely self-selected with existing concerns. The
iatrogenic-harm literature is secondary school, 11+.

**Every mechanism argument in §B.5 requires transfer across a developmental boundary that the
rumination literature itself says matters** — rumination as a stable response style is
characterised in adolescence and adulthood, and the metacognitive capacity it depends on is not
what a 5-year-old brings to a smiley-face button.

> **The iatrogenic anti-case for young children is an extrapolation, not a finding. Anyone
> presenting it as established evidence about 4–9 year olds is overclaiming — and note it cuts
> both ways: there is also no evidence of *safety* in this age group.**

### B.5.7 The finding that undercuts the PRO case

**Webb et al. (2025), *JMIR*** [A — secondary analysis of 4 RCTs, N=412]: conventional
self-report reliability α=0.89–0.94 vs EMA change scores ρ=0.50–0.77; conventional self-report
detected **larger** effects (d=0.37 vs 0.14 group differences; **d=0.77 vs 0.17** pre-post).

> **Repeated momentary ratings are a *less* sensitive instrument for detecting real change than a
> single well-constructed periodic check.** If the goal is "notice when a child is struggling,"
> daily micro-ratings are arguably the worse instrument, not the better one.

## B.6 Audience, siblings, and disclosure

### B.6.1 ⭐ Young children alter emotional display by audience — and this is the citation

**Zeman & Garber (1996), "Display Rules for Anger, Sadness, and Pain: It Depends on Who Is
Watching," *Child Development***
([doi](https://doi.org/10.1111/j.1467-8624.1996.tb01776.x)), 421 citations
**[A — N=192, grades 1/3/5, mean ages 7.25, 9.33, 11.75].**

- **Regardless of emotion type, children reported controlling their expression significantly more
  in the presence of peers than with mother, father, or alone.**
- Younger children expressed sadness and anger more than older.
- **"Children's primary reason for controlling their emotional expressions was the expectation of
  a negative interpersonal interaction following disclosure."**

**By age 7, children already suppress emotional expression as a function of audience, and they do
it because they anticipate a bad social consequence.** The transfer here is far shorter than any
transfer elsewhere in this file: same construct, overlapping age band, audience is the manipulated
variable.

⚠️ **Caveat: the audience categories are mother/father/peer/alone. Siblings are not tested.**
Whether a sibling functions as "peer" (suppression) or "family" (expression) is an open question.
Family-systems intuition says an older sibling behaves like a peer. **That step is inference, not
finding.**

**Corroborating, in the right age band:**
- **Ip et al. (2021), *J Experimental Child Psychology*** [A, n=150 preschoolers,
  cross-cultural]: in the disappointing-gift paradigm, preschoolers displayed **more positive
  expressions ("fake smile") in social versus nonsocial contexts.** **Preschoolers already mask
  negative emotion when observed.**
- **Riddell, Nikolić & Kret (2025), *Developmental Science*** [A, n=71 aged 3.5–5, n=71 aged
  8–10, n=73 adults]: greater embarrassment and **more blushing when performing before an
  audience versus alone**, at both child bands. Self-conscious emotion is audience-contingent
  from ~4.
- **Wu & Schulz (2020), *Child Development*** [A, n=211 aged 7.0–10.9, five experiments]: by age
  7, children understand display rules well enough to **infer others' true desires from the
  mismatch between public and private expression.** **They know publicly displayed emotion is
  strategic.**
- Harris et al. 1986 + independent Japanese replication (Gardner et al. 1988): 6-year-olds
  understand the appearance/reality emotion distinction more systematically than 4-year-olds, and
  it is *"relatively unaffected by socialisation differences."* 79% pass at 7.

### B.6.2 ⭐ A visible check-in produces systematically rosier data

**Rickwood & Coleman-Rose (2023), *Heliyon***
([PMC10559918](https://pmc.ncbi.nlm.nih.gov/articles/PMC10559918/))
**[A — ages 12–25, two national Australian samples, N=6,238 and N=4,122].**
**Interviewer-present administration produced lower reported distress and higher reported
wellbeing than private self-report. No mode effect on physical activity** — so it is
**sensitivity-specific**, not general noise.

> **Translated to a kitchen display: a visible check-in is the interviewer-present condition. It
> does not merely risk exposure — it produces a systematically rosier, biased reading, with the
> bias concentrated exactly on the child who is struggling. A visible display is *worse than no
> display* if anyone acts on it.**

*(Adolescent/young-adult sample; the mechanism is corroborated in 4–9s by §B.6.1.)* Backed by
Tourangeau & Yan 2007, *Psychological Bulletin* (3,041 citations) on mode effects for sensitive
items [SR], and Pimenta et al. 2023: higher public stigma → lower support-seeking where peers
might judge.

**Still unclosed:** no study directly compares a peer-visible classroom check-in against a
private one [U]. The conclusion is strongly supported by analogy, by unanimous vendor design, and
by Rickwood — **not directly demonstrated.**

### B.6.3 Sibling teasing — high base rates, serious associations, but the specific link is unstudied

- **Wolke & Skew (2012)** [A/review]: **up to 50% of children are involved in sibling bullying
  monthly; 16–20% several times weekly.**
- **Bowes et al. (2014), *Pediatrics*, ALSPAC, N≈6,900** [A — large prospective cohort]: frequent
  sibling bullying victimisation → at age 18, **depression OR = 2.16** (1.33–3.51), **self-harm
  OR = 2.56** (1.63–4.02; population-attributable fraction **19.3%**), **anxiety OR = 1.83**
  (1.19–2.81).
- **Dantchev et al. (2018), *Psychological Medicine*, ALSPAC, N=6,988** [A]: several times/week →
  psychotic disorder **OR = 2.74** (1.28–5.87); **sibling + peer combined OR = 4.57**
  (1.73–12.07) — superadditive.
- **van Berkel, Tucker & Finkelhor (2018), *Child Maltreatment*, N=2,053, ages 5–17** [A]:
  sibling victimisation related to more mental health problems **over and above** child abuse and
  neglect. **Age range starts at 5.**
- Dunn & Munn (1986) [A, observational, 43 sibling pairs at home]: **by 24 months, teasing of
  siblings was already observed.**

⚠️ **What this does and does not establish.** It establishes that sibling mockery is common, has
serious long-run associations, and operates in the age band of interest. It does **not** establish
that a wall display *causes* sibling teasing, or that emotional disclosure is a teasing trigger
specifically. **Searches for "sibling ridicule" and "sibling emotional invalidation" returned
nothing** [U]. **The causal link "display → teasing" is a plausible mechanism, not a documented
one — and it is the load-bearing claim, so flag it honestly.**

> **The sibling risk therefore splits into two harms, and the second is far more certain than the
> first:**
> 1. **Teasing harm** — plausible, high base rate for sibling mockery generally, specific link
>    unstudied.
> 2. **Measurement invalidation** — **near-certain** on the display-rules evidence (§B.6.1) plus
>    Rickwood (§B.6.2). **A shared-audience mood entry is a *performed* mood, not a *felt* one.
>    The feature stops measuring the thing it claims to measure the moment the audience is a
>    sibling.**

### B.6.4 Adults cannot read a child's state from one datum

- **Cremeens, Eiser & Blades (2006)** [A — **n=149 children aged 5.5–8.5**, exactly the band]:
  child–parent consistency on PedsQL **ICCs .02 to .23**; significant median differences on **all**
  subscales; and **"parents' own quality of life correlated with their proxy-reports of child
  QOL."** *Parents read their own state into the child's.*
- **Lawson et al. (2021)** [A, 46 children ages 3–7.5]: **ICC 0.33 and 0.22.** *"Caregiver report
  should not be used as a substitute for self-report."* **Any "parent logs how the kid seemed
  today" feature measures the parent.**
- Huang 2017 [SR, 169 studies]: parent–youth correlations **r = .33–.40**. Achenbach et al. 2005
  [SR, 108 studies]: mean cross-informant **.428 internalizing**.
- **von Baeyer (2006, 2009)** [B]: *"there are many sources of bias and error in self-reports of
  pain, so ratings need to be interpreted in light of information from other sources"* — direct
  observation, knowledge of circumstances, parents' reports. And the **"social communicative
  function"** point: **the child's rating is partly a message to the audience.** Change the
  audience and you change what the rating means.
- Roberts et al. 2019 [SR, 141 articles]: satisficing rises with task difficulty and falls with
  ability and motivation — **all three worst-case for a child answering the same question for the
  200th time.**

⚠️ **I could not find any study isolating acquiescence bias or satisficing specifically in young
children's *mood* scales** [U]. Its application to children is an **inference** from
Borgers/Chambers, not a demonstrated finding. **Stop citing it as one.** (Borgers, Hox & Sikkel
2003 is the canonical citation for children's response quality; the numeric findings could not be
retrieved [U].)

**Counter-evidence worth keeping:** Kurtzhals et al. 2025 [A] — children aged **6–10 *can*
self-report validly** on wellbeing/QoL **when the instrument is developmentally adapted** with
audio, illustrations and smiley-supported scales. So the answer is *yes, with substantial
instrument design work*, not *no*.

### B.6.5 Timing: does a delay hurt? — the serve-and-return argument does not survive

This section evaluates the owner's proposed **visibility delay**, and it matters that the two
mechanisms be kept apart:

- **(a)** a delay before *anyone* sees the entry;
- **(b)** immediate-to-adults, with a short window in which the child can amend or retract.

**Serve and return is a popularisation with no timing parameter.** The Harvard Center's own
[page](https://developingchild.harvard.edu/resources/5-steps-for-brain-building-serve-and-return/)
[C] says *"prompt and adequate response"* — and **"prompt" is never operationalised.** No claim of
the form "within N seconds." The framing is **infancy and dyadic face-to-face**. **It is not
itself evidence.** Citing serve-and-return in a design argument is citing a poster, not a study.

**The real literature is contingency research, and it is strong — for infants, in seconds, face
to face:** Tarabulsy et al. 1996 [SR/review]; **Goldstein & Schwade 2008, *Psych Science*** [A —
mothers responding contingently vs non-contingently to 9.5-month-olds' babbling; only the
contingent group's infants restructured their babbling]; **Roseberry et al. 2014,
*Child Development*** [A — **yoked control**: 24–30-month-olds learned novel verbs from live
interaction and contingent video chat, **not** from yoked non-contingent video]; Nadel et al.
1999; Myers et al. 2017.

**⭐ The counter-evidence that is rarely quoted, and it is the killer:**

- **Tsuji, Fiévét & Cristia (2021), *Infant Behavior and Development*** [A] — gaze-contingent
  **virtual agent** vs video chat vs in-person, **all perfectly contingent**. Only in-person
  produced above-chance word learning; the virtual agent was significantly worse. Authors:
  **"contingency is not sufficient either… more cues to social agency are required."**
  → **Even *perfect* contingency from a non-human agent failed. The active ingredient is a
  responsive human, not fast data transport. Delivering the emoji faster does not deliver a
  caregiver faster.**
- **Reeve, Reeve & Poulson (1993), *JEAB*** [A, n=6, single-subject] — unsignalled **3-second and
  5-second delayed** reinforcement successfully conditioned infant vocalisation, contradicting
  earlier researchers who failed at 3s. Small and old, but **the only paper found that
  parametrically varied delay — and delay was survivable.**
- **⭐ The most-cited "prompt response" finding did not replicate.** Bell & Ainsworth (1972),
  *Child Development* (869 citations) is the origin of "responding promptly to crying reduces
  later crying." Attacked by Gewirtz & Boyd (1977); then **Hubbard & van IJzendoorn (1991)** ran
  the naturalistic longitudinal replication and **did not reproduce it** — crying duration halved
  over the year regardless [A — **failed replication**]. **Anyone who says "responsiveness latency
  is well-established" should be handed the 1991 paper.**

**Still-face is being mis-cited if anyone reaches for it.** Still-face is **total unresponsiveness
with the caregiver physically present and looking at the infant.** A delay is *absence*.
Still-face is disturbing precisely *because* the partner is there and withholding. **Different
construct. Category error.** (Mesman et al. 2009 record verified; abstract elided [U].)

**Emotion coaching contains no latency claim.** Gottman, Katz & Hooven (1996) — note the subtitle
the field drops: **"Theoretical models and *preliminary data*."** Johnson et al. 2017 [SR, 49
studies]; Garcia et al. 2024 [SR, 26 studies — **16 of 26 cross-sectional**, r = .18–.76];
Havighurst et al. 2020 [C — narrative review **by a program developer**]. **Across the entire
emotion-coaching corpus, no study manipulates or measures *latency*.** Emotion coaching is
characterised by **what** the parent does (label, validate, problem-solve) vs doesn't (dismiss,
minimise, punish) — **not by how fast.**

Most relevant single study, and it is the right age: **Feng, Yang & Gong (2026)**
([PMC13124812](https://pmc.ncbi.nlm.nih.gov/articles/PMC13124812/)) [A — pilot, n=40 mother–child
dyads, **mean child age 5.16**, mothers doing EMA 12×/day]: maternal **emotion-dismissing**
predicted subsequent child negative expression. **The finding is about the *content* of the
parental response, not its latency.**

> **The scale mismatch should be embarrassing to anyone making the argument:** the contingency
> literature's window is roughly **1–5 seconds**. A delay of 15 minutes and a delay of 0 minutes
> are *both* infinitely outside it. **The literature cannot distinguish them. Using
> serve-and-return to argue 0 minutes over 30 minutes is using a stopwatch to settle a calendar
> dispute.**

**Verdict:** there is **no evidence** that a minutes-scale delay in an adult *seeing* an
asynchronous, self-initiated, non-urgent signal from a 4–9-year-old is harmful. **The delay
proposal cannot be refuted by this literature; it also cannot be supported by it.** It is
empirically open and must be argued on product and ethical grounds.

### B.6.6 The amend/retract window

**The only direct empirical test of *either* mechanism tested a delay, and it was equivocal.**
**Wang, Leon, Acquisti, Cranor, Forget & Sadeh (2014), CHI** [A — field trial, 6 weeks, 28
users]: *"reminders about the audience of posts can prevent unintended disclosures without major
burden; however, **introducing a time delay before publishing users' posts can be perceived as
both beneficial and annoying**."* **The audience-clarity nudge worked cleanly; the delay nudge
split users and irritated a meaningful fraction.**

**Wang et al. (2011), SOUPS, "I regretted the minute I pressed share"** [A — qualitative, adults]
— regretted posts cluster into sensitive information, **emotionally charged material posted in
heightened states**, and lies/secrets. Crucially: **deletion is an incomplete remedy because
content may already have been seen.**

> ⚠️ **A structural asymmetry the amend-window proposal must swallow: a *delay* actually delivers
> reversibility; an *amend window* only delivers it if nobody has looked.** On a kitchen wall
> display, "seen" happens fast and cannot be un-seen. **A 5-minute retract window on a shared
> display is, in practice, closer to no window at all.** That is a real point in the delay
> proposal's favour, and it does not depend on developmental psychology at all.

**Bayer et al. (2015), *Information, Communication & Society*** [A — ESM n=154 + interviews n=28,
Snapchat]: ephemeral interactions were more enjoyable, associated with more positive mood, and
involved **reduced self-presentational concerns** — **but were associated with *lower* social
support.** **Lowering the permanence stakes lowers the performance pressure *and* lowers the
support yield.** That is exactly the tension in a family check-in.

**⭐ No study shows that reversibility increases honest self-disclosure** — not in children, not
in adults [U — "not found under budget" rather than "does not exist"]. **Children's regret over
disclosures: nothing found at all** for 4–9s [U].

> **Honest position: the amend/retract window is not better-evidenced than the delay — it is
> *differently* unevidenced.** Its advantages are that (a) it does not require defending
> withholding a child's signal from their parent, and (b) the one relevant field trial found the
> *non-delay* nudge was the tolerated one. **That is an argument from least-bad adjacent
> evidence, not a demonstration.**

### B.6.7 Prompted vs unprompted

**Wen et al. (2017), *JMIR*** [SR, 42 studies of youth EMA]: **41 of 42 used time-based
(signal-contingent) sampling**; 39 of 41 prompted 2–9×/day. **The entire youth EMA field is built
on prompting, so there is essentially no comparison literature on self-initiated entries in
children — the counterfactual has barely been run** [A — negative finding].

**What can be said defensibly:** prompting reliably raises *volume* (that is the field's design
rationale). **Nobody has shown what prompting does to *honesty* in 4–9s.** The performativity
concern is theoretically well-motivated and empirically untested.

⚠️ **The most important unverified claim in this file:** young children show pronounced
acquiescence and susceptibility to **repeated/leading questioning** (the Ceci & Bruck
suggestibility tradition), which is why forensic interview protocols forbid repeated closed
questions. **If that transfers, a repeated daily prompt — "How are you feeling?" at 19:00 every
night — is closer to a repeated closed question than a voluntary tap is.** This could not be
verified this session [U] and **deserves a proper search when the budget resets.**

Note this converges independently with **Levy-Gigi (§B.1.6)**: a fixed daily cadence catches the
child in the low-intensity case, where labelling may make things worse. **Two independent
literatures point at "available, not scheduled."**

### B.6.8 Privacy — mostly de-scoped, one point retained

Per the owner's correction, the adolescent privacy/autonomy literature is **dropped**: Stattin &
Kerr (2000)'s reinterpretation (parental *knowledge* comes mainly from **child disclosure**, and
disclosure — not surveillance — is what predicts good outcomes) is about 14-year-olds and does not
transfer to a 5-year-old tapping a face. Note also that Dietvorst et al. 2018 (Dutch, n=244) found
the within-person association **reversed** — an explicit Simpson's paradox — so even the popular
"surveillance breeds secrecy" claim is not cleanly supported at the within-person level.

**What is retained:** children's own privacy concept is **interpersonal** — Stoilova, Livingstone
& Nandagiri 2020 [A, 169 UK children 11–16]: *"children primarily conceptualize privacy in
relation to interpersonal contexts, conceiving of personal information as something they have
agency and control over as regards deciding **when and with whom** to share it."* **A household
ambient display negates both the *who* and the *when*.** (Ages 11–16, so directional for 4–9.)

Also retained: **Walrave et al. 2022** [A — 30 interviews, CPM-framed, sharenting]: adolescents
accept parental sharing **"as long as they are nicely portrayed and positive events are shared."**
**A mood widget broadcasts precisely the category they object to.**

**⭐ A genuine hole:** searches found **no HCI work on emotional disclosure via a shared home
display**, and nothing on visitors or babysitters [U]. Closest adjacent: Niemantsverdriet et al.
2019, *ACM TOCHI* [C — framework] noting IoT systems are *designed for individual use* but *used
in a shared social context*. **"A wall display is different from a private app" is a
well-motivated design argument grounded in CPM and Stoilova — not an empirically demonstrated
harm. Present it as such.**

**Not verified this session** [U]: UNCRC Art. 16 text and General Comment No. 25; GDPR/AVG, EDPB
and Dutch **Autoriteit Persoonsgegevens** guidance on children's data; Petronio's foundational
2002 CPM monograph. **Do not rely on anything in this file for the legal position.**

---

# C. ⭐ Dutch school colour systems — the premise, corrected

The steer was: *the children already learn a "colour" at school, so reuse it.* The research
**substantially corrects this**, and the correction is the most decision-relevant thing in the
file after §B.6.1.

## C.1 What is actually used in Dutch basisscholen

### Het Kleurenmonster (Anna Llenas)

Dutch edition, uitgeverij **De Vier Windstreken** (2017/18); original *El Monstruo de Colores*
(2012) [primary]. The **five potjes**: **geel = blijdschap**, **blauw = verdriet**, **rood =
woede/boos**, **zwart(-grijs) = angst**, **groen = kalmte/rust**.

⚠️ **Roze = verliefd is real but structurally different** — it is **not one of the five jars**; it
is the *punchline*, where the monster turns pink at the end. Classroom adaptations promote it to a
sixth colour; **the book does not.** **Roze is the colour Dutch children will most inconsistently
recognise.**

**Status: a prentenboek that became a classroom artefact, not a method.** No publisher programme,
no licence, no training, no NJi entry — **which is exactly why it spread**: any kleuterleerkracht
can buy it and hang up five jars. Very common in **groep 1–3**. **No usage figure exists and
probably cannot** [U].

### Kanjertraining — de vier petten

**⭐ This is where the premise needs correcting most, in three ways.**

**(a) The petten are about coping/behaviour, NOT feelings.** From Stichting Kanjertraining's own
[kenniscentrum](https://kanjertraining.nl/kenniscentrum/de-kanjerpetten) [primary]:

> *"Om in gesprek te gaan over **gedrag** bij kinderen maken we bij de petten van Kanjertraining
> gebruik van petjes met vier verschillende kleuren. […] Binnen de psychologie wordt dit
> **coping** genoemd. De petten van de Kanjertraining staan voor verschillende
> **copingstijlen**."*

And: *"Kinderen zijn niet het gedrag van de pet, maar de petten staan voor de **keuzes** die de
kinderen kunnen maken."*

**(b) Each pet has two readings — a *kwaliteit* (with the white cap) and a *valkuil* (without
it).** The common gloss is the **valkuil half only**. Full scheme, verbatim from the NJi's
[*Uitgebreide beschrijving Kanjertraining*](https://www.nji.nl/document/uitgebreide-beschrijving-kanjertraining)
[primary/NJi]:

| Pet | Dier (groep 1–2) | Kwaliteit (met witte klep) | Valkuil (zonder) |
|---|---|---|---|
| **Wit** | Tijger | vertrouwen, eigenheid, te vertrouwen, behulpzaam | naïef |
| **Rood** | Aap | humor, relativeringsvermogen, blijmoedig | te jolig, uitlachen, uitsloven, meelopen |
| **Zwart** (nu vaak **blauw**) | Vogel | leiderschap, krachtig, stoer | te bazig, pesterig |
| **Geel** | Konijn | empathie, zorgzaam, vriendelijk, bescheiden | te gevoelig, bang, teruggetrokken, "onzichtbaar" |

**Correction to the common gloss: meeloopgedrag/uitsloverij sits under *rood* (aap), not geel.
Geel's valkuil is fear/withdrawal.**

**(c) ⭐ The zwarte pet is being retired in favour of a blauwe pet.** Per Kanjertraining's own news
items [primary]: marineblauwe petten went on sale **November 2020** in response to the Dutch
racism/discrimination debate; **from schooljaar 2024/2025 the digibordlessen default to the blue
variant**, with a KanVAS toggle back. The current kenniscentrum page describes **blauw** as the
leiderschap cap with **no mention of zwart at all**.

> **So in a Dutch classroom in 2026, blauw plausibly means "stoer / leiderschap / grenzen
> aangeven" — the near-opposite of blue in both Kleurenmonster and Zones.**

Groepen 1 t/m 8. Animal characters t/m groep 5; from groep 3 the animals fade; in de bovenbouw
*"worden de gedragingen en gevoelens rechtstreeks benoemd."*

### Zones of Regulation — almost no Dutch footprint

The framework is as described (blauw = lage alertheid; groen = kalm én alert, klaar om te leren;
geel = verhoogde alertheid; rood = overweldigd). Cleanest citable per-zone definitions came from
an **NHS trust SLT service**, because **the publisher paywalls the curriculum and no longer
publishes the four definitions on its free pages** — both `/how-it-works` and the post literally
titled "What are the four Zones of Regulation?" now redirect to marketing copy [V].

**But the Dutch ecosystem is essentially absent** [A — negative finding]:
- No Dutch publisher (Uitgeverij Pica's catalogue: nothing).
- **`zonesofregulation.nl` and `zonesvanregulatie.nl` do not resolve at all (NXDOMAIN).**
- Searching `"zones van regulatie"` returns Etsy printables, an AI-generated "teaching wiki",
  colouring pages, and **one** genuine Dutch institutional hit: a
  [SWPBS.nl training log](https://swpbs.nl/images/2021/08/PBSelementen_groen_geel_rood.pdf).
- The developer's Dutch-language Google Play listing shows **"1K+ downloads"** — worldwide,
  across all Dutch-speaking users.
- **Not in the NJi databank.**

> **Zones in NL is a speciaal-onderwijs / ergotherapie / SWPBS import, usually in English, not a
> mainstream basisschool vocabulary. "Reusing" it would not reuse anything the child knows.**

### The rest of the field

| Methode | Kleurgecodeerd? | Emoties of gedrag? | Groepen | NJi-status |
|---|---|---|---|---|
| **De Vreedzame School** (CED) | **Nee** — conflictentrap, opstekers/afbrekers, leerling-mediatoren | conflictoplossing + burgerschap | 1–8 + KDV/BSO/SO | **Effectief volgens eerste aanwijzingen** (5 feb 2026) |
| **KiVa** | **Nee** | groepsnormen / pesten | 4–12 | **Effectief volgens sterke aanwijzingen** (30 sep 2022) |
| **Rots en Water** | **Nee** — *rots* vs *water* | weerbaarheid, fysiek/psychosociaal | 1–6 + VO | **Goed onderbouwd** (= nog niet op effect getoetst) |
| **Kwink** (~1900 scholen) | **Nee** — 5 CASEL-competenties | SEL | 1–8 | **Goed onderbouwd** |
| **Leefstijl** | Geen kleurvocabulaire gevonden | SEL | PO/VO | **Goed onderbouwd** |
| **Zippy's Vrienden** | modulekleuren, geen emotiepalet | coping met tegenslag | 5–8 (t/m 10) | Niet in databank; NL-aanwezigheid grotendeels historisch |
| **Goed Gedaan!** (Malmberg) | niet te verifiëren [U] | SEL | 1–8 | niet gecheckt |
| **Trefwoord** (Kwintessens) | Nee — levensbeschouwelijke dagopening | waarden | 1–8 | n.v.t. |
| **Stoplichtmethode** | **Ja — en het gaat over werkmodus, niet gevoel.** [Kennisrotonde (NRO) 2257](https://www.kennisrotonde.nl/vraag-en-antwoord/stoplichtmethode), 3 okt 2024: rood = "je werkt in stilte"; oranje = "stilte, vinger opsteken"; groen = "zacht overleggen mag" | klassenregels / taakgericht gedrag | 4–14 | meer on-task, minder storend gedrag |
| **SWPBS** | **Ja** — maar groen/geel/rood zijn **interventieniveaus voor personeel** | ondersteuningsintensiteit | schoolbreed | volwassen-gericht |
| **Emotiethermometer** | Ja, groen→rood verloop | intensiteit van één emotie | ad hoc, vaak SO | geen eigenaar [U] |

## C.2 ⭐ The collision table

Read **row-wise**. Every row is a colour a Dutch 5-year-old could plausibly have been taught two
or three incompatible meanings for, **in the same school year**.

| Kleur | Het Kleurenmonster (emotie) | Kanjertraining (copingstijl/gedrag) | Zones (regulatiestaat) | Stoplicht (werkregel) | SWPBS (niveau) |
|---|---|---|---|---|---|
| 🔴 **Rood** | **boos / woede** | **humor, vrolijkheid, relativeren** → **uitsloven, uitlachen, meelopen** | **overweldigd**, extreme energie — *of* dolgelukkig | **stop; stil werken** | intensieve individuele zorg |
| 🟢 **Groen** | **kalmte / rust** | *(geen groene pet)* | **kalm én alert, klaar om te leren** — een *state*, geen stemming | **overleggen mag** | basisondersteuning |
| 🟡 **Geel** | **blij / blijdschap** | **empathie, vriendelijk, bescheiden** → **bang, teruggetrokken** | **verhoogde alertheid**: gefrustreerd, gespannen, druk | — | extra ondersteuning |
| 🔵 **Blauw** | **verdrietig** | **stoer, krachtig, leiderschap** → **bazig, pesterig** *(vervangt zwart sinds 2020; standaard vanaf 2024/25)* | **lage alertheid**: moe, verdrietig, verveeld | — | — |
| ⚫ **Zwart** | **bang / angst** | leiderschap → bazig/pesterig *(wordt uitgefaseerd)* | — | — | — |
| 🩷 **Roze** | **verliefd** (slot, geen eigen potje) | — | — | — | — |
| 🟠 **Oranje** | — | — | — | **stilte, vinger opsteken** | — |

**The four clashes worth stating out loud:**

1. **⭐ Geel is the single worst colour in Dutch primary education.** Kleurenmonster: *blij*.
   Zones: *gespannen/onrustig, op weg naar overbelast*. Kanjertraining: *bang en teruggetrokken*.
   **A yellow face on a wall display means "I'm happy", "I'm getting overwhelmed", or "I'm
   shrinking away" depending on which classroom the child came from. There is no reading that
   reconciles these.**
2. **Rood is contested three ways, and the Kanjertraining reading is the surprising one.** Adult
   intuition says boos / overweldigd / stop. But a Kanjerkind may read a red button as **"de
   grappenmaker"** — the cheerful, joking cap. **Not a small drift; the opposite valence.**
3. **⭐ Blauw has just flipped underneath everyone.** Blauw = verdrietig (Kleurenmonster) and
   moe/verdrietig (Zones) — but Kanjertraining is actively migrating its **leiderschap/stoer** cap
   to blue, **default from 2024/25**. A child in a school that switched reads blue as "strong and
   bold." **This is a live, dated change; anything designed now sits right on top of it.**
4. **Groen means two genuinely different things and only one is a feeling.** Kleurenmonster:
   *rust*, an emotion, one of five equals. Zones: *gereguleerd, klaar om te leren*, a meta-state,
   and **the one everything returns to**. The Zones framing quietly makes green the "correct"
   answer. *That the framework's own materials push back ("all the zones are ok") tells you the
   failure mode is well known.*

## C.3 Prevalence — partly knowable; no reliable ranking

- **De Vreedzame School: "1000+ scholen"** — CED-Groep [V, publisher claim].
- **Kwink: "Meer dan 1900 scholen"** — kwinkopschool.nl [V, publisher claim].
- **Kanjertraining: "ruim 2500 scholen"** — recurs widely but **could not be found on Stichting
  Kanjertraining's own site**; the Kanjerscholen page is a JS map with no count/API/total, and the
  NJi *Uitgebreide beschrijving* contains no reach figure (full PDF grepped). Sourced only from a
  school website and a 2018 blog. **Treat as folklore-grade — roughly right, not auditable** [U].
- **KiVa:** no extractable total [U].
- **Het Kleurenmonster: unknowable in principle.** No licence, no registration, no tracking.
- **Zones NL: near-zero institutional footprint.**

**Denominator:** roughly **6,000–6,300 basisscholen**. So even the largest single method is a
minority of schools, and publisher figures are self-reported and non-comparable (a "Kwink school"
holds a subscription; a "Kanjerschool" holds licences and a board sign requiring 80% of teachers
trained).

**Regional / schoolbestuur patterns: not knowable from public sources** [U]. The NJi description
says of the target population *"er is geen specifieke spreiding."* **The only real route is asking
the school.**

**Inference, clearly labelled** [U]: for *emotion* vocabulary in **groep 1–3**, **Het
Kleurenmonster is probably the most widely encountered artefact** despite zero institutional
standing — because it is a €15 book rather than a €4,600 team training. For *behaviour* vocabulary
across groep 1–8, **Kanjertraining** is the most widespread named method.

## C.4 ⭐ Self-report vs adult classification — the decisive distinction

**Kanjertraining is a shared conversational tool, and emphatically NOT a "how do I feel"
self-label.** The method's own materials are unusually careful, and **the care itself is the
tell** — they are guarding against exactly the misuse a self-report UI would institutionalise.
From the NJi *Uitgebreide beschrijving* [primary]:

> *"Kinderen krijgen uitdrukkelijk **geen 'stempel'** van één bepaalde pet: je **bént** niet een
> type gedrag, maar je **gedraagt je** op een bepaald moment in een bepaalde situatie zo."*

Actual usage is **an adult prompt, in the moment, about observable behaviour**, and it is
**bidirectional** — teachers and parents wear the caps too:

> *"'**Welke pet heb je nu op?** Zet je witte pet er eens bij op. Wat zou je anders kunnen
> doen?'"*

And there is a formal exercise, the **pettenkwadrant**, where the four caps are laid on the floor
and **classmates place blocks** to indicate how they read someone's behaviour — **peer
classification**, the most explicitly other-directed mechanic in any of these systems.

> **So the petten answer "how is my behaviour landing on other people right now, and what could I
> choose instead" — not "what am I feeling."** Reusing them for a feelings check-in would be a
> category error, **and worse: it would convert a deliberately non-stigmatising tool into exactly
> the *stempel* the method spends paragraphs forbidding.** A wall display logging "Sanne tapped
> zwarte pet" is a **persistent behavioural label — the opposite of a cap you can take off.**
> Widespread, and a poor fit. **The owner's hypothesis holds.**

**Zones is designed for self-report, but explicitly scaffolded *from* adult classification.** The
NHS SLT guidance describes the progression: *"Model the zones regularly — Check-in at certain
times of the day… Say what you notice, such as 'I see you're very quiet, that might mean you're in
the blue zone'. Then **move the child's photo** to that zone. […] **Over time, let the child move
their photo**."* So the endpoint *is* "ik ben nu geel" — **the only one of these systems whose
destination is genuine self-report, and the only one built around a repeated check-in ritual**,
which is structurally what Kynite would build. Note also the guidance's warning that in the red
zone a child should be **told** what to do rather than offered choices — relevant if the UI offers
a strategy picker after the tap.

**Het Kleurenmonster is self-expression by design — but by *sorting*, not by picking one.** The
premise is that the monster feels several things at once and is *in de war* until each gets its
own jar. **The book's action is disentangling a mixture, not selecting a single current state. A
one-tap "pick your colour" UI inverts the book's lesson.** Adults read the book; children then
name and sort. No adult classifies the child.

*(This converges with §B.3.6: 4–5-year-olds report a single emotion 61% of the time. The book is
teaching precisely the capacity they lack, and a single-select control teaches the opposite.)*

**Stoplicht is purely adult-controlled and not about the child at all.** The teacher sets the light
for the whole class; a child never reports their stoplicht colour. **SWPBS groen/geel/rood** is
likewise an adult instrument. **KiVa, Vreedzame School, Rots en Water, Kwink:** no colour
self-labelling exists to reuse.

## C.5 Critique and erkenning

**NJi verdicts** (ladder: *goed onderbouwd* → *effectief volgens eerste / goede / sterke
aanwijzingen*):

| Methode | Erkenning | Datum |
|---|---|---|
| Kanjertraining | **Effectief volgens sterke aanwijzingen** | 17 mrt 2022 |
| KiVa | **Effectief volgens sterke aanwijzingen** | 30 sep 2022 |
| De Vreedzame School | **Effectief volgens eerste aanwijzingen** (regulier PO) | 5 feb 2026 |
| Kwink / Leefstijl / Rots en Water | **Goed onderbouwd** | — |
| Zones of Regulation | **niet in de databank** | — |
| Het Kleurenmonster | **niet in de databank** (het is een boek) | — |

**⭐ The interesting part is the caveats inside the erkenning, not the level.** The NJi's own
toelichting scopes the effect far more narrowly than the badge suggests:

> *"De studies geven sterke aanwijzingen dat deelname aan de Kanjertraining **als klassikale
> interventie voor conflictklassen** in het basisonderwijs **of als ouder-kindtraining in een
> klinische setting** leidt tot een afname van externaliserend en internaliserend gedrag bij
> kinderen van **8 tot 13 jaar** als deze wordt gegeven door **een getrainde psycholoog of
> orthopedagoog**. […] **Er zijn geen directe effecten gevonden op pesten.**"*

**That is not evidence for what most schools actually buy** — weekly schoolwide lessons by the
groepsleerkracht. It is evidence for an intensive intervention in a broken class, delivered by a
psychologist.

**The 2018 government-commissioned trial found it did not reduce bullying.** *Wat werkt tegen
pesten?* — €890k, five universities + Trimbos, led by prof. **Bram Orobio de Castro**. Of six
programmes, PRIMA and (groep 3–5) Taakspel demonstrably reduced bullying within a year;
Kanjertraining did not clear the bar. Pedagoog **Bas Levering** wrote it up as
["Moet de kanjertraining worden verboden?"](https://blog.pedagogiek.nu/blog/2018/05/24/moet-de-kanjertraining-worden-verboden/)
[C], concluding *"dat het gebruik van de Kanjertraining als antipestmethode… sterk moet worden
afgeraden."*

**The fair version — the lead researcher pushed back:** Orobio de Castro, in that blog's comments:
*"de kanjertraining lijkt wél positieve effecten te hebben in moeilijke klassen, maar… (**p = .052
i.p.v. < .05**). Over de kanjertraining kan je dus beter zeggen dat **effecten onzeker zijn** dan
dat ie zeker niet (of wel) zou werken."*

**Publisher framing vs source** [V]: Kanjertraining's kenniscentrum says *"In zowel 2015 als 2022
kreeg Kanjertraining het hoogst mogelijke oordeel"* — true, and it **omits the scope caveats and
the 2018 null**. Competitor KiVa frames the same report as *"Alle andere onderzochte programma's
bleken niet effectief"* — also technically defensible and also selective. **Neither framing is
neutral.**

**Practitioner-level critique** [C — single practitioner, but the theme matters]: children *see
through* the training and produce *"sociaal wenselijk in plaats van sociaal vaardig gedrag."*
**That failure mode — performing the expected answer — is precisely the risk in a daily
tap-a-colour check-in, whatever vocabulary is used.**

**Loose thread:** the NJi page carries a field labelled *"Momenteel in herbeoordeling:"* with no
visible value [U] — worth one direct check if it matters.

## C.6 The uncomfortable conclusion

**The two most widespread Dutch systems are not feelings vocabularies at all.** Kanjertraining is
coping/behaviour and is *designed to resist* exactly the persistent self-labelling a check-in
produces; the stoplicht is an adult-set work-mode signal. The one system whose semantics genuinely
match a daily self-report check-in — Zones — **has almost no Dutch footprint**.

**That leaves Het Kleurenmonster as the only widespread Dutch colour vocabulary that is actually
about emotions, actually child-voiced, and actually aimed at 4–7.** Its costs: no institutional
backing; **zwart = bang** is a hard colour to render warmly on a display; **roze is inconsistently
taught**; and **its whole pedagogical point is sorting several feelings at once** — so a
single-select control fights the source material.

> **And whichever is picked, geel and blauw will collide with something the child is taught at
> school, with blauw actively shifting under Kanjertraining's zwart→blauw migration. The one move
> the research supports is not choosing a "correct" palette but *knowing which method the school
> uses*. The collision is not resolvable by picking well — only by knowing.**

---

# D. Failure modes

## D.1 Performative reporting — near-certain, and the best-evidenced failure

Established by §B.6.1 (Zeman & Garber: audience-contingent suppression by age 7, driven by
anticipated negative social consequence), §B.6.2 (Rickwood: observed administration produces
systematically rosier data, N≈10,000), Ip 2021 (preschoolers fake-smile when observed), and Wu &
Schulz 2020 (by 7, children know public emotion is strategic). Corroborated in adults with **no**
audience by Schueller 2021 (users preferentially log positive moods). Independently predicted by
the Dutch practitioner critique of Kanjertraining ("sociaal wenselijk in plaats van sociaal
vaardig").

**This is not a risk. It is the expected behaviour of the system as specified.**

## D.2 Becoming a compliance tool

The mechanism is documented and **is caused by having a privileged state on the display** (§B.4.2).
Peer-reviewed articulation: Bartholdsson 2014 ("docile bodies"); Irisdotter Aldenmyr 2016
(requiring children to "share one's innermost" despite collective framing); Cipollone 2022
("Compliance and Control"). The slippage is visible **in pro-Zones material** ("ready-to-learn"
as the definition of regulated) and **in a check-in vendor's own K-2 script** ("it is hard to focus
and learn when feeling angry… get ready to learn").

**Known-good structural fix:** ENERGY's two-term match — **no good end, no bad end, no green to
return to** (§B.4.2).

## D.3 Parents over-reacting to a data point

**Evidence for the over-reaction itself: essentially none** [U]. No research found on parents
over-interpreting a single child mood report, nor on whether advance knowledge helps or hurts the
subsequent conversation. **If the delay proposal is justified by "parents over-react," that
justification is currently unevidenced.**

**What *is* evidenced:**
- The datum is near-uninterpretable: ICC .02–.23 at ages 5.5–8.5, and **parents' own QoL
  contaminates their reading** (Cremeens 2006).
- A single momentary rating is a low-reliability measurement (Webb 2025: ρ 0.50–0.77 vs α
  0.89–0.94), and respondents silently vary their comparison standard (Stone et al. 2022).
- **The *content* of a bad adult response is documented as costly** (Feng 2026: maternal
  emotion-**dismissing** predicted subsequent child negative expression, at mean age 5.16).
- **Chambers et al. (2002), *J Pediatric Psychology*** [A — experiment]: mothers randomly trained
  into "pain-promoting" vs "pain-reducing" interaction styles **measurably changed 8–12-year-olds'
  reported pain.** The cleanest demonstration that **a parent's framing of a child's internal state
  changes the child's report of it.** Over-attentive solicitousness is not neutral.

> **Implication: what the UI tells the adult to *do* matters more than *when* it tells them.**

## D.4 Gaming it / reward contamination

**Hearth ships a star value on the feelings step** [V] — the direct precedent. The qualitative
face: a Finch user, *"I just do the 😐 option so I can get in the game"* [C]. Nothing in the
literature contradicts this, and **Chambers & Johnston 2002 says you cannot fix it downstream with
a different scale** (§B.3.2). This is the one failure mode with a *product* precedent rather than
only a mechanism.

## D.5 Sibling mocking

High base rates and serious associations (§B.6.3), **but the specific link "emotional disclosure →
sibling teasing" is unstudied** [U]. **Do not claim it is documented.** Claim what is documented:
audience-dependent suppression is real by 7, siblings are an audience, and sibling bullying is
common and consequential.

## D.6 Abandonment after novelty

The best-evidenced failure after D.1. Median 30-day retention **3.3%** across 93 real apps;
**74%→40% in one week** with a one-tap interaction on dedicated hardware; **only 33% of children
7–18 would do it again**; ~50% of tracked-device users stop within two weeks (house research).
Mitigating: **trackers retained better than other mental-health app categories**, and
**adult-in-the-loop improves adherence**.

## D.7 The measurement mirage

Under-appreciated and specific: **the granularity index rises simply from being sampled more
often** (Hoemann 2021). Any "your emotional vocabulary is growing" metric would be measuring its
own prompt rate. Related: children **produce** words they do not **comprehend** (*embarrassed*:
third most-produced, never reliably understood through 13). **A design that infers understanding
from usage will be systematically wrong.**

---

# E. Design implications

Framed as trade-offs, not rules. Each names what the evidence supports, what it warns against, and
where it is silent. **Where the evidence is silent, that is said rather than papered over.**

## E.0 The threshold question: should this be a *measurement* at all?

**The evidence's clearest collective message is that this feature cannot succeed as an
instrument.** Children under 8 cannot produce a valid multi-point rating (§B.3.1); fewer options
does not fix it (§B.3.2); audience corrupts the entry (§B.6.1–2); adults cannot read it (§B.6.4);
repeated momentary ratings are *less* sensitive than a single periodic check (§B.5.7); and the
tracking component in stress apps was associated with *smaller* effects (§B.5.4).

**But it can succeed as a *bid* — a way for a child to say "notice me" that an adult answers.**
That reframing is the one the evidence supports, and it survives every objection above, because a
bid does not need to be a valid measurement. It needs to be **noticed and answered well.**

- **Trade-off:** a bid produces no chart, no trend, no dashboard, and therefore no obvious
  "product surface." That is a real cost in a hub whose other slices are all legible at a glance.
- **The house-consistency argument is strong here.** Kynite's stated tension is that every other
  surface *measures* children. **A bid is the only framing that resolves it rather than adding a
  seventh measurement.**

**Everything below assumes the bid framing.** If the decision is instead "an instrument," most of
the evidence in §B says don't.

## E.1 History — keep it, but do not render it as a trend

**Supported:** keeping raw entries. Deleting them costs nothing and gains nothing, and the
"notice a pattern over a fortnight" case is the honest reason an adult wants this at all.

**Warned against, strongly:** *rendering* history as a chart, sparkline, streak, or "3 sad days
this week" summary.

- One datum has ρ as low as 0.50 and ICC .02–.23 in this exact age band (§B.5.7, §B.6.4). A line
  through such points is a line through noise, drawn with the authority of a graph.
- The data is **systematically biased toward good days** even with no audience (§B.5.2), and more
  so with one.
- Loerakker 2023: **framing and reference points significantly change whether reflection becomes
  rumination** — so the chart is not a neutral readout, it is an intervention.
- Any derived "granularity" or "emotional vocabulary growth" metric would be measuring its own
  prompt rate (§B.2, §D.7).

**The defensible middle:** store entries; show an adult **the last few raw entries as raw entries**,
never aggregated, never plotted, with an explicit **minimum run-length before anything resembling a
pattern is surfaced at all**. If a summary must exist, it should describe **what happened around
the entries** (context), not the entries' distribution.

**Trade-off, stated honestly:** this makes the feature much less impressive in a demo and removes
the thing many parents would say they want. It also removes the mechanism by which a parent starts
treating their child as a dataset. Given `psychology-and-product-principles.md`'s existing stance
against measurement surfaces, the house position is consistent — but note this *is* a real capability
being declined, not a free win.

## E.2 Who sees an entry — split by role, and make the shared board opt-in

Private-only is off the table per the owner, and correctly: a bid nobody receives is not a bid.
**The live question is who *besides* the child, and the evidence answers it unusually clearly.**

**Supported — adults always:**
- The entire classroom-tool category is **private-to-adult by design and sells that as the
  feature** (§A.2). Closegap scopes to staff, never peers.
- Lehtimaki 2021: adult involvement **improves** adherence.
- Stattin & Kerr's mechanism does not transfer to 5-year-olds, so there is no autonomy argument
  against a parent seeing a young child's bid. Parents seeing it *is the function*.

**Warned against — the shared wall board, by default:**
- **Zeman & Garber (§B.6.1):** by 7, children suppress expression by audience, *because they
  anticipate a bad social consequence*. Siblings are an audience.
- **Rickwood (§B.6.2), N≈10,000:** a visible check-in is the interviewer-present condition and
  produces systematically rosier data, **with the bias concentrated on the child who is
  struggling.** A visible display is *worse than no display* if anyone acts on it.
- **Irisdotter Aldenmyr 2016:** the disclosure is individual and exposed even when the ritual looks
  communal — the precise peer-reviewed critique of a visible board.
- Every mainstream classroom tool avoids peer visibility; GGIE's practitioner guidance builds in a
  **right to pass**.

> **The strongest single design conclusion in this file: a wall-mounted family display is not a
> variant of the classroom practice — it is the thing the classroom practice is engineered to
> avoid. Role-split visibility (adults always; shared board optional and off by default) is the
> configuration the evidence supports, and no product currently ships it.**

**Two Kynite-specific constraints this interacts with:**
1. **Children never log in; members are decoupled from users** (`market-research-2026-08.md` §4.2).
   So "the child's own private view" does not exist as a surface, and role-split visibility has to
   be expressed in terms of *which surface renders it* (hub vs parent phone), not *who is logged
   in*.
2. **The no-account caregiver share link (PRD FR24/FR25) must never carry feelings entries.** A
   read-only link intended for a grandparent or babysitter is exactly the "unintended audience"
   case, and it is one URL forward from being outside the household entirely. This should be a
   structural exclusion, not a permission default.

**Trade-off:** an adults-only default weakens the "ambient, glanceable, worth looking at" value
that justifies the hub at all (house research: ~50% abandon when passive value fades). The feature
would live mostly on phones. That is a genuine cost — and the alternative buys visibility at the
price of the data meaning anything.

## E.3 Notification — no push on a single entry; make noticing a human act

**Warned against:** notifying a parent on each entry.
- It manufactures exactly the instant-reaction loop the owner worries about, and D.3's evidence
  says the adult's *response content* is what matters (Feng 2026), while the datum itself is
  near-uninterpretable (Cremeens).
- Chambers 2002: a parent's framing measurably changes the child's subsequent report. A parent
  primed by an alert arrives with a frame.
- Notably, **"Exploring Emotions: The Zones" — the only consumer product found with an explicit
  child-logs → adult-sees pathway — has no alerting** (§A.1).

**Supported:** the entry being *reliably visible* to an adult on a surface they already look at,
without a push. Schueller 2021's users' loudest complaint was the absence of a "what do I do now"
layer — **the gap to close is interpretation, not speed.**

**Genuine open question:** a bid that no one notices for two days is a failed bid, and there is no
evidence on what latency is acceptable. A quiet, non-interrupting indicator that persists until
acknowledged is the obvious compromise, and it is **not** evidence-backed — it is the least-bad
reading of D.3 plus §B.6.5.

**Deliberately unresolved:** whether a *repeated* strongly-negative entry should escalate. The
evidence gives no threshold, and Kirtley (§B.5.3) warns that the acutely distressed child is the
one most burdened by the mechanism. Picking a number here would be inventing evidence.

## E.4 ⭐ Delay vs amend window — the evidence favours the amend window, but weakly and for an unexpected reason

The two mechanisms must be kept apart, and the research verdict is genuinely surprising.

**Mechanism (a), a delay before *anyone* sees it:**
- **Cannot be justified by serve-and-return.** That is a popularisation whose only timing word is
  "prompt," undefined, from infant face-to-face research. **Invoking it here is a non-sequitur**
  (§B.6.5).
- **Still-face is a category error** if reached for: still-face is *present-and-withholding*; a
  delay is *absent*.
- **The contingency literature's unit is seconds.** 0 minutes and 30 minutes are *both* outside it.
  **The literature is silent between them, and silence is not endorsement of either.**
- **The most-cited "prompt response" finding did not replicate** (Bell & Ainsworth → Hubbard & van
  IJzendoorn 1991).
- **Emotion coaching contains no latency claim at all.**
- **Tsuji 2021 cuts against the whole framing:** perfect contingency from a *non-human* agent still
  failed. **Delivering the emoji faster does not deliver a caregiver faster.**
- **But:** the one direct empirical test of a delay (Wang 2014, CHI) found it **"both beneficial
  and annoying"** — split users, irritated a meaningful fraction. The *audience-clarity* nudge in
  the same trial worked cleanly.

**Mechanism (b), immediate-to-adults with an amend/retract window:**
- **No evidence that reversibility increases honest disclosure** — not in children, not in adults
  [U]. **Nothing at all on children's disclosure regret for 4–9s.**
- **Structural weakness:** Wang 2011 — retraction is materially incomplete once content has been
  seen. **On a shared display, "seen" happens fast. A 5-minute retract window there is close to no
  window at all.** *A delay actually delivers reversibility; an amend window mostly delivers the
  feeling of it.*
- **Structural strength:** it does not require defending withholding a child's bid from their
  parent, and it is the mechanism the one relevant field trial found tolerable.

> **Verdict: neither is evidence-backed; they are *differently* unevidenced. The amend window is
> preferable — but note the reason is not developmental psychology. It is that (b) is compatible
> with §E.2's role split, while (a) is not: once the shared board is off by default, "seen" no
> longer happens instantly to a room full of siblings, and the amend window's central weakness
> largely dissolves.**

**So the two decisions are coupled, and that is the real finding.** Role-split visibility is doing
the work that the delay was proposed to do — and doing it on better evidence (Zeman & Garber,
Rickwood) than any timing argument can muster. **Adopt the role split; then the amend window is
cheap and sufficient, and the delay is unnecessary.**

**Warned against either way:** a *configurable* delay. It is a setting that encodes an unevidenced
theory, it will be set once and forgotten, and Wang 2014 says a meaningful fraction of users will
find it annoying.

## E.5 Expiry — yes, and it is one of the better-supported choices

**Supported:**
- Kanjertraining's own doctrine — **"geen stempel"**, *you are not the cap* — is the sharpest
  articulation available of why a persisting emotional label is harmful, and it comes from the most
  widespread Dutch method (§C.4). **A persistent entry is exactly the stempel that method forbids.**
- Bayer 2015: ephemerality reduced self-presentational concern (**with the honest caveat that it
  also reduced social support** — the trade-off is real and named).
- §B.1.4's blunting finding and §B.5.1's rumination mechanism both argue against a durable
  accumulating record the child can revisit.

**Trade-off with §E.1:** "keep history for the adult" and "let it expire" pull against each other.
The coherent resolution is **asymmetric persistence**: the entry stops being *displayed* quickly
(it is today's bid, not a status), while the underlying record persists for the adult's raw,
unplotted view. That is defensible but it is a *design* resolution, not one the evidence dictates.

**Kynite-specific:** an entry that persists visibly on a wall display becomes an ambient label on a
person in their own kitchen. Expiry-from-display is the mechanism that stops the board describing
who someone *is*.

## E.6 Vocabulary size and content — small, provided, Dutch, and configurable at setup

**On size — the evidence is unusually specific and mostly ignored by the category:**
- **≤7: two response options. >8: three** (Coombes, §B.3.1) — **for an ordered rating scale.** A
  5-point "how are you feeling, sad→happy" slider is beyond the demonstrated capacity of every
  child in the 4–7 half of the range. *(This limit does not govern an unordered category picker —
  see the box below, which is the crux of the whole vocabulary question.)*
- **But fewer options does not fix extreme responding** (Chambers & Johnston, §B.3.2) — so
  shrinking the scale is not a fix, it is honesty about what the scale can carry.
- **And "kids just pick the happiest face" is now too strong** as a standalone justification
  (Read & Horton, §B.3.3).

> **⭐ The coherent reading turns on a distinction the category consistently blurs: an *ordered
> rating scale* ("how good/bad, 1–5") and an *unordered category picker* ("which of these") are
> different instruments. Coombes' 2-then-3-options limit governs the former. A small set of
> distinct named emotions is the latter, and can carry 6–8 options because the child is
> recognising, not ranking.**
>
> **So: ship a categorical picker, not a scale. Keep it small because that is what the child can
> *use* — not because smallness fixes bias (it does not). And accept that an unordered categorical
> instrument cannot be averaged, scored or plotted at all — which independently forecloses §E.1's
> chart and removes any temptation toward a "mood score."**

**On content:**
- **Age 5 safe set** (≥70% receptive accuracy): *happy, afraid, excited, worried, angry, disgusted,
  proud*. **Age 6 adds:** *surprised, confused, gloomy*.
- **⭐ A defensible shipping set for 4–8 is therefore roughly: *blij, verdrietig, boos,
  bang, opgewonden/enthousiast, bezorgd, trots* — about 6–8 options, every one age-5-verified**,
  and matching the ~6–7 words a five-year-old can actually produce. **Adding *frustrated*,
  *disappointed*, *embarrassed* or *jealous* is not supported and will generate noise dressed as
  granularity.**
- **Note the collision this creates with §E.1 and §B.3.1**: 6–8 *nominal* options is not the same
  as a 6–8 *point* scale. These are unordered categories, not a rating — which is precisely why
  they can exceed the 2–3 response options Coombes permits, and precisely why they cannot be
  averaged, scored or plotted.
- **⭐ Never ship *frustrated* or *embarrassed*** in a comprehension-dependent control for any age
  in this range — **neither reaches 70% receptive accuracy through age 13**, despite *embarrassed*
  being the third most-*produced* word (§B.3.4).
- **Expect valence-only answers as the normal case at 4–5**, not a failure: "good"/"bad" is the
  *modal* response (~39% of free productions), and *sad* (31%) far outstrips *happy* (8.3%).
- **"Disappointed" is not available below 7** and 5-year-olds get it backwards (§B.3.4).
- Route into differentiated emotions through **situations and consequences, not faces** (Widen;
  Weissman: fear/sadness face recognition does not mature until 15–16).
- **Depth beats size** in 4–6s (Streubel 2026): adult-like use of few words, not many words.

**On free text and voice notes — this is where §B.1.5 is decisive:**
- **A fixed palette of *provided* options is the supported paradigm.** A free-text or
  "describe how you feel" box is the **self-generation** condition, which is precisely where the
  affect-labelling effect **disappears or reverses**, per Lieberman's own lab (§B.1.5).
- **So: no free-text emotion field for the child.** This is one of the few places where the
  evidence gives a clean directional answer, and it happens to be the opposite of the intuitive
  "let them express themselves in their own words."
- **A voice note is a different object and should be judged differently.** It is not a *label*; it
  is a message to a person, which sidesteps the labelling literature entirely. But it is also
  maximally identifying, un-redactable, and the worst possible payload for the shared-board and
  caregiver-link exposure in §E.2. **If it ships at all, it must be adults-only and never render on
  the hub.** No evidence either way [U] — this is a values call.
- **An optional "why" as a *provided* set** (school, home, friends, tired, unwell…) is better
  supported than free text and directly addresses Schueller 2021's finding that users wanted
  interpretation. It also gives the adult the *context* §E.7 needs. BeMe ships mood + a reason.

**On the Dutch vocabulary question — the biggest correction:**
- **Do not reuse Kanjertraining's petten.** They are coping/behaviour, they are *other*-directed
  (the pettenkwadrant is peer classification), and the method explicitly forbids the persistent
  label a logged entry creates (§C.4). Widespread ≠ suitable.
- **Do not reuse Zones.** It has almost no Dutch footprint (§C.1) — "reusing" it reuses nothing —
  and its geometry builds a good/bad axis in (§B.4.3).
- **Het Kleurenmonster is the only genuine fit**: emotion-based, child-voiced, aimed at 4–7,
  Dutch-current. **But** it has no institutional backing, *zwart = bang* is hard to render warmly,
  *roze* is inconsistently taught (it is the book's punchline, not a jar), and **its lesson is
  sorting co-occurring feelings, which a single-select control inverts** — a tension that also
  shows up in §B.3.6.
- **⭐ The strongest conclusion: make the palette configurable at setup, and ask which method the
  school uses.** *Geel* and *blauw* will collide with something no matter what is chosen, and
  **blauw is actively shifting** under Kanjertraining's zwart→blauw migration (default from
  2024/25). **The collision is not resolvable by picking well — only by knowing.** Two children at
  different schools, or one school changing method between groepen, is the normal case, so the
  setting belongs **per child**, not per household.
- **Configurability is also a verified differentiator** — no product offers it (§A.2).
- **Trade-off:** per-child configurable vocabulary is real setup burden, and
  `psychology-and-product-principles.md` warns that setup ritual becomes another task for the
  already-overloaded parent. Mitigation: ship a sensible Kleurenmonster-derived default that works
  unconfigured, and treat the school-method question as an optional refinement, not a gate.

## E.7 What an adult should see alongside an entry

Not in the original brief but it emerged as the highest-leverage surface, because **D.3 says the
adult's response content matters more than anything about timing.** No direct evidence exists [U];
this is inference from Cremeens, Webb, Stone, Chambers and Feng:

1. **The child's own recent raw entries** — not a chart. Without a reference point the adult has no
   comparison standard, and Stone et al. show comparison standards vary silently.
2. **An explicit noise disclaimer.** The Webb reliability figures justify literally telling the
   adult that **one entry is not a trend**.
3. **The context the child attached** (the provided-set "why"), which is more actionable than the
   emotion token itself.
4. **A prompt to *ask*, not to conclude.** ICC .02–.23 at ages 5–8 says the adult's inference from
   the datum is near-worthless; its value is as a **conversation opener** — precisely the missing
   layer Schueller's users named.
5. **A nudge away from dismissing.** Feng 2026 is the one finding here in the right age band, and
   what it identifies as harmful is **emotion-dismissing**, not slowness.

**This is also where the hub's voice rule (PRD FR30, `hub-voice.test.ts`) bites:** the board must
not editorialise about a child's emotional state. "Sanne heeft iets gedeeld" is a neutral board.
"Sanne is verdrietig" is the board diagnosing a person in their own kitchen.

## E.8 Prompted vs available — lean available, on two independent lines of evidence

**Supported (available, child-initiated):**
- **Levy-Gigi 2022:** labelling may *increase* distress at **low** intensity — and a fixed daily
  prompt catches the child overwhelmingly in the low-intensity case (§B.1.6).
- **The repeated-closed-question concern** (§B.6.7) — flagged as the most important *unverified*
  claim here [U], but pointing the same way.
- **MYRIAD's dose-response ran in the harmful direction** (§B.5.5).
- **Wen 2017:** in nonclinical settings **fewer prompts → higher compliance** (91.7% at 2–3/day).
- Kirtley: mandatory cadence burdens the acutely distressed child most.

**Against (fully unprompted):** a board nobody taps is a board nobody uses, and D.6's retention
numbers are brutal. The entire youth EMA field prompts *because* prompting raises volume — and
**there is essentially no comparison literature on self-initiated entries in children** [A —
negative finding], so "available-only" is untested, not vindicated.

**The honest middle:** make it **always available and visually present** (so it is discoverable
without being demanded), with **at most one gentle, skippable invitation per day**, and an explicit
**right to pass** — the one piece of practitioner guidance that is unanimous (GGIE). Never a
notification, never a blocking step in a routine.

## E.9 ⭐ Interaction with the star economy — the instinct is correct, and it now has direct evidence

Both the owner's instinct and mine were that this must never touch stars. **Tested against the
evidence, the instinct holds, and unusually it is supported by a *product precedent* rather than
only a mechanism.**

**Direct evidence:**
- **Hearth ships a star value on its feelings step** [V] — the exact design under consideration,
  already in market.
- **The observed consequence:** *"I just do the 😐 option so I can get in the game"* [C — single
  user report, Finch, and it is one quote; but it is a report of precisely the predicted failure].
- **Chambers & Johnston 2002 (§B.3.2):** you cannot fix contaminated emotion responding downstream
  with a different scale. Once the answer gates a reward, no scale design recovers it.
- **§B.6.2 (Rickwood):** the reading is already biased rosy by audience. Adding a reward pushes the
  same direction, and the two compound.
- **§B.5.2 (Schueller):** users already under-report negative moods with *no* incentive at all.

**Mechanism evidence from the house research** (`psychology-and-product-principles.md`):
- Deci, Koestner & Ryan (128 experiments): expected, tangible, engagement-contingent rewards
  reliably **decrease intrinsic motivation** (r ≈ −0.24), **strongest in children**.
- Kynite's own rule already says stars attach to **tedium only** — chores and hygiene — and
  explicitly **not** to things the child already has reason to do. A feelings bid is the furthest
  thing from tedium.

**The reframed argument, which is stronger than "it would cheapen it":** attaching a reward
converts the entry from **a bid into a transaction**. A bid's whole value is that it is voluntary
and therefore informative; a rewarded tap is neither. **The reward does not merely dilute the
signal — it destroys the only property that made the feature worth building.**

> **Verdict: no stars, no counts, no completion state, no contribution to any routine's "done"
> tally, no appearance in progress surfaces. The check-in must not be completable.** This is one of
> the few places where the product precedent, the mechanism literature, the house research and the
> owner's instinct all agree — and it is the single cheapest way to get the feature wrong.

**Consistency note:** this belongs in `market-research-2026-08.md` §4.2's refused-features table
alongside streaks and negative marking, and is pinnable by test in the same way
(`no-negative-marking.test.ts` is the model).

## E.10 What would make this worth building — and what would falsify it

**Worth building if:** it is a **bid, not a measurement**; **adults always see it, the shared board
is opt-in**; **no stars, ever**; **small provided Dutch vocabulary, per-child configurable**; **no
free text**; **no chart**; **available rather than prompted**; and **the adult-facing surface
coaches a response rather than delivering a verdict**.

**Falsified if any of these show up in the first month of real use:**
- The children's entries cluster on the positive options (§B.5.2, §B.6.2 predict this — and it is
  measurable).
- A sibling repeats a child's entry back at them, even once.
- Either parent describes the feature in terms of "tracking" or asks for a graph.
- Anyone says "you're in the red, fix it" (§D.2).
- Daily taps decay below ~40% inside a week (§A.3's number, on far more prompting).

**And the honest bottom line on the evidence itself:** the mechanism this feature was originally
justified by — *naming the feeling helps* — is the part that has **collapsed**. What survives is
much smaller and much more defensible: **a child gets a low-effort way to say "notice me," and an
adult reliably notices and responds well.** That is not a neuroscience claim. It does not need to
be.

---

## Appendix — the clearest cases of a single study laundered into a design principle

1. **Lieberman 2007 → "naming tames the amygdala."** n=30, adults 18–36, strangers' faces,
   forced-choice from two words, **no feelings measured**, borderline p, and the amygdala was
   *elevated* in every labelling condition. This one paper carries the entire popular edifice.
2. **Barrett 2001 → "precise naming helps you regulate."** A 14-day undergraduate diary correlation
   whose outcome was *number of strategies attempted*. N unverifiable. The best-powered replication
   attempt found no strategy-selection relationship at all.
3. **Kashdan, Barrett & McKnight 2015 → cited as evidence.** It is an invited opinion piece with
   zero new data.
4. **Pons & Harris 2004 → "the 3 stages of emotion comprehension."** ~20 children per age point,
   one cross-sectional sample, 906 citations, now a commercial test and curriculum scaffold — and
   the component-to-phase assignment is not internally consistent across the authors' own papers.
5. **RULER's RCTs → "the Mood Meter works."** The trials measured **classroom climate** across a
   whole-school multi-year package. **The Mood Meter itself has never been evaluated.**
6. **Zones' "evidence-based" claim.** Two randomised trials exist; both are null. The vendor brief
   spotlights an unpublished dissertation and an n=14 uncontrolled feasibility study.
7. **"Validated for ages 4–10."** von Baeyer's 617-study review found **98%** of such claims in the
   best-studied analogous domain were obtained by **pooling young children with older ones**.
   Disaggregated, the evidence evaporated. **Expect the same pattern in any such claim here.**
