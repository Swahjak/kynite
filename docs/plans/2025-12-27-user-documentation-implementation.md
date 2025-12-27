# User Documentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Nextra-powered help center at `/help` with Dutch and English content, integrated via contextual help links throughout the app.

**Architecture:** Nextra 4 renders MDX content under a catch-all route at `src/app/[locale]/help/[[...slug]]/page.tsx`. Content lives in `content/help/{locale}/` directories. A reusable `HelpLink` component provides contextual help icons that link to relevant documentation pages.

**Tech Stack:** Nextra 4, nextra-theme-docs, MDX, next-intl (existing), Tailwind CSS (existing)

---

## Phase 1: Infrastructure

### Task 1: Install Nextra Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install packages**

Run:

```bash
pnpm add nextra nextra-theme-docs
```

Expected: Packages added to dependencies

**Step 2: Verify installation**

Run:

```bash
pnpm list nextra nextra-theme-docs
```

Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add nextra and nextra-theme-docs dependencies"
```

---

### Task 2: Configure Nextra in Next.js

**Files:**

- Modify: `next.config.ts`

**Step 1: Update next.config.ts**

Replace the entire file with:

```typescript
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import nextra from "nextra";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withNextra = nextra({
  contentDirBasePath: "/help",
});

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://accounts.google.com https://*.googleapis.com wss://*.pusher.com https://*.pusherapp.com",
      "frame-src 'self' https://accounts.google.com",
    ].join("; "),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(withNextra(nextConfig));
```

**Step 2: Verify config loads**

Run:

```bash
pnpm typecheck
```

Expected: No type errors

**Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: configure nextra for help documentation"
```

---

### Task 3: Create MDX Components File

**Files:**

- Create: `mdx-components.tsx` (project root)

**Step 1: Create mdx-components.tsx**

Create file at project root with:

```tsx
import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
  };
}
```

**Step 2: Verify file exists**

Run:

```bash
ls -la mdx-components.tsx
```

Expected: File exists

**Step 3: Commit**

```bash
git add mdx-components.tsx
git commit -m "feat: add MDX components configuration"
```

---

### Task 4: Create Help Route Structure

**Files:**

- Create: `src/app/[locale]/help/layout.tsx`
- Create: `src/app/[locale]/help/[[...slug]]/page.tsx`

**Step 1: Create help layout**

Create `src/app/[locale]/help/layout.tsx`:

```tsx
import "nextra-theme-docs/style.css";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import type { ReactNode } from "react";

export const metadata = {
  title: "Help Center",
};

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function HelpLayout({ children, params }: Props) {
  const { locale } = await params;
  const pageMap = await getPageMap(`/${locale}/help`);

  return (
    <Layout
      pageMap={pageMap}
      docsRepositoryBase="https://github.com/your-repo"
      navbar={
        <Navbar
          logo={<span className="font-bold">Kynite Help</span>}
          projectLink="/"
        />
      }
      footer={<Footer>© {new Date().getFullYear()} Kynite</Footer>}
    >
      {children}
    </Layout>
  );
}
```

**Step 2: Create catch-all page**

Create `src/app/[locale]/help/[[...slug]]/page.tsx`:

```tsx
import { generateStaticParamsFor, importPage } from "nextra/pages";
import { useMDXComponents } from "../../../../../mdx-components";

export const generateStaticParams = generateStaticParamsFor("slug");

type Props = {
  params: Promise<{
    locale: string;
    slug?: string[];
  }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const { metadata } = await importPage(slug, locale);
  return metadata;
}

export default async function HelpPage({ params }: Props) {
  const { locale, slug } = await params;
  const { default: MDXContent, toc, metadata } = await importPage(slug, locale);

  return (
    <MDXContent {...{ toc, metadata }} components={useMDXComponents({})} />
  );
}
```

**Step 3: Verify files exist**

Run:

```bash
ls -la src/app/\[locale\]/help/
ls -la src/app/\[locale\]/help/\[\[...slug\]\]/
```

Expected: Both directories with their files

**Step 4: Commit**

```bash
git add src/app/\[locale\]/help/
git commit -m "feat: add help route structure for Nextra"
```

---

### Task 5: Create Content Directory Structure

**Files:**

- Create: `content/help/en/_meta.ts`
- Create: `content/help/en/index.mdx`
- Create: `content/help/nl/_meta.ts`
- Create: `content/help/nl/index.mdx`

**Step 1: Create English meta**

Create `content/help/en/_meta.ts`:

```typescript
export default {
  index: "Welcome",
  "getting-started": "Getting Started",
  calendar: "Calendar",
  chores: "Chores & Stars",
  rewards: "Reward Store",
  "wall-hub": "Wall Hub",
};
```

**Step 2: Create English index**

Create `content/help/en/index.mdx`:

```mdx
# Welcome to Kynite Help

Find answers to common questions and learn how to get the most out of Kynite.

## Quick Links

- [Getting Started](/en/help/getting-started) - Set up your family account
- [Calendar](/en/help/calendar) - View and manage events
- [Chores & Stars](/en/help/chores) - Manage chores and rewards
- [Reward Store](/en/help/rewards) - Set up and redeem rewards
- [Wall Hub](/en/help/wall-hub) - Configure wall display mode
```

**Step 3: Create Dutch meta**

Create `content/help/nl/_meta.ts`:

```typescript
export default {
  index: "Welkom",
  "getting-started": "Aan de slag",
  calendar: "Kalender",
  chores: "Klusjes & Sterren",
  rewards: "Beloningswinkel",
  "wall-hub": "Wandscherm",
};
```

**Step 4: Create Dutch index**

Create `content/help/nl/index.mdx`:

```mdx
# Welkom bij Kynite Help

Vind antwoorden op veelgestelde vragen en leer hoe je het meeste uit Kynite kunt halen.

## Snelle links

- [Aan de slag](/nl/help/getting-started) - Stel je gezinsaccount in
- [Kalender](/nl/help/calendar) - Bekijk en beheer evenementen
- [Klusjes & Sterren](/nl/help/chores) - Beheer klusjes en beloningen
- [Beloningswinkel](/nl/help/rewards) - Stel beloningen in en wissel ze in
- [Wandscherm](/nl/help/wall-hub) - Configureer de wandweergave
```

**Step 5: Verify structure**

Run:

```bash
find content/help -type f
```

Expected: 4 files listed

**Step 6: Commit**

```bash
git add content/
git commit -m "feat: add initial help content structure"
```

---

### Task 6: Verify Dev Server Starts

**Step 1: Start dev server**

Run:

```bash
pnpm dev
```

Expected: Server starts without errors

**Step 2: Test help page loads**

Open browser to `http://localhost:3000/en/help`

Expected: Help page renders with "Welcome to Kynite Help"

**Step 3: Test Dutch version**

Open browser to `http://localhost:3000/nl/help`

Expected: Dutch help page renders with "Welkom bij Kynite Help"

**Step 4: Stop dev server and commit if any fixes needed**

---

## Phase 2: Content

### Task 7: Create Getting Started Content

**Files:**

- Create: `content/help/en/getting-started.mdx`
- Create: `content/help/nl/getting-started.mdx`

**Step 1: Create English getting-started**

Create `content/help/en/getting-started.mdx`:

```mdx
# Getting Started

Welcome to Kynite! This guide will help you set up your family account.

## Creating Your Account

1. Go to the homepage and click **Sign Up**
2. Enter your email address and create a password
3. Verify your email by clicking the link we send you

## Linking Google Calendar

To see your Google Calendar events in Kynite:

1. Go to **Settings** from the menu
2. Click **Link Google Account**
3. Sign in with your Google account
4. Grant permission to access your calendar

Your events will start syncing automatically.

## Creating Your Family

After signing in:

1. You'll be prompted to create a family
2. Enter your family name
3. Add family members (parents and children)

## Adding Family Members

### Adding Adults (Parents/Guardians)

Adults can manage chores, rewards, and settings:

1. Go to **Settings** → **Family**
2. Click **Invite Member**
3. Enter their email address
4. They'll receive an invitation to join

### Adding Children

Children have limited access focused on viewing their tasks and earning stars:

1. Go to **Settings** → **Family**
2. Click **Add Child**
3. Enter their name and optional avatar

Children don't need email accounts - they're managed by parents.

## Next Steps

- [Set up chores](/en/help/chores) for your family
- [Configure rewards](/en/help/rewards) in the reward store
- [Learn about the calendar](/en/help/calendar)
```

**Step 2: Create Dutch getting-started**

Create `content/help/nl/getting-started.mdx`:

```mdx
# Aan de slag

Welkom bij Kynite! Deze gids helpt je om je gezinsaccount in te stellen.

## Account aanmaken

1. Ga naar de homepage en klik op **Registreren**
2. Voer je e-mailadres in en maak een wachtwoord aan
3. Verifieer je e-mail door op de link te klikken die we sturen

## Google Agenda koppelen

Om je Google Agenda-evenementen in Kynite te zien:

1. Ga naar **Instellingen** via het menu
2. Klik op **Google-account koppelen**
3. Meld je aan met je Google-account
4. Geef toestemming om je agenda te openen

Je evenementen worden automatisch gesynchroniseerd.

## Je gezin aanmaken

Na het inloggen:

1. Word je gevraagd een gezin aan te maken
2. Voer je gezinsnaam in
3. Voeg gezinsleden toe (ouders en kinderen)

## Gezinsleden toevoegen

### Volwassenen toevoegen (Ouders/Verzorgers)

Volwassenen kunnen klusjes, beloningen en instellingen beheren:

1. Ga naar **Instellingen** → **Gezin**
2. Klik op **Lid uitnodigen**
3. Voer hun e-mailadres in
4. Ze ontvangen een uitnodiging om lid te worden

### Kinderen toevoegen

Kinderen hebben beperkte toegang gericht op het bekijken van hun taken en het verdienen van sterren:

1. Ga naar **Instellingen** → **Gezin**
2. Klik op **Kind toevoegen**
3. Voer hun naam en optionele avatar in

Kinderen hebben geen e-mailaccounts nodig - ze worden beheerd door ouders.

## Volgende stappen

- [Stel klusjes in](/nl/help/chores) voor je gezin
- [Configureer beloningen](/nl/help/rewards) in de beloningswinkel
- [Leer over de kalender](/nl/help/calendar)
```

**Step 3: Verify pages render**

Run dev server and visit:

- `http://localhost:3000/en/help/getting-started`
- `http://localhost:3000/nl/help/getting-started`

Expected: Both pages render correctly

**Step 4: Commit**

```bash
git add content/help/
git commit -m "docs: add getting started help content"
```

---

### Task 8: Create Calendar Content

**Files:**

- Create: `content/help/en/calendar.mdx`
- Create: `content/help/nl/calendar.mdx`

**Step 1: Create English calendar**

Create `content/help/en/calendar.mdx`:

```mdx
# Calendar

The calendar is the heart of Kynite, showing everyone's schedule at a glance.

## Calendar Views

Kynite offers multiple ways to view your calendar:

### Day View

Shows events for a single day in a detailed timeline. Best for:

- Checking today's schedule
- Seeing exact event times

### Week View

Displays a full week with all family members' events. Best for:

- Planning the week ahead
- Spotting schedule conflicts

### Month View

Shows the entire month at once. Best for:

- Long-term planning
- Seeing birthdays and recurring events

### Agenda View

A simple list of upcoming events. Best for:

- Quick overview of what's coming up
- Wall hub display mode

## Filtering by Family Member

Use the avatar filter at the top to show events for specific family members:

1. Click on a family member's avatar to show only their events
2. Click again to include them back
3. Click "Everyone" to show all events

## Birthdays

Birthdays appear automatically from Google Calendar with a special cake icon. They show as all-day events at the top of each view.

## Event Colors

Events are color-coded by the family member they belong to. Each person has a unique color assigned in their profile.
```

**Step 2: Create Dutch calendar**

Create `content/help/nl/calendar.mdx`:

```mdx
# Kalender

De kalender is het hart van Kynite en toont ieders planning in één oogopslag.

## Kalenderweergaven

Kynite biedt meerdere manieren om je kalender te bekijken:

### Dagweergave

Toont evenementen voor één dag in een gedetailleerde tijdlijn. Beste voor:

- De planning van vandaag bekijken
- Exacte evenementtijden zien

### Weekweergave

Toont een volledige week met evenementen van alle gezinsleden. Beste voor:

- De week vooruit plannen
- Conflicten in de planning opsporen

### Maandweergave

Toont de hele maand in één keer. Beste voor:

- Langetermijnplanning
- Verjaardagen en terugkerende evenementen zien

### Agendaweergave

Een eenvoudige lijst van aankomende evenementen. Beste voor:

- Snel overzicht van wat eraan komt
- Wandscherm weergavemodus

## Filteren op gezinslid

Gebruik de avatarfilter bovenaan om evenementen voor specifieke gezinsleden te tonen:

1. Klik op de avatar van een gezinslid om alleen hun evenementen te tonen
2. Klik opnieuw om ze weer toe te voegen
3. Klik op "Iedereen" om alle evenementen te tonen

## Verjaardagen

Verjaardagen verschijnen automatisch vanuit Google Agenda met een speciaal taartpictogram. Ze worden als dagvullende evenementen bovenaan elke weergave getoond.

## Evenementkleuren

Evenementen zijn kleurgecodeerd per gezinslid. Elke persoon heeft een unieke kleur toegewezen in hun profiel.
```

**Step 3: Commit**

```bash
git add content/help/
git commit -m "docs: add calendar help content"
```

---

### Task 9: Create Chores Content

**Files:**

- Create: `content/help/en/chores.mdx`
- Create: `content/help/nl/chores.mdx`

**Step 1: Create English chores**

Create `content/help/en/chores.mdx`:

```mdx
# Chores & Stars

Turn household tasks into a fun game with stars and rewards.

## How It Works

1. Parents create chores with star values
2. Kids complete chores and earn stars
3. Stars can be redeemed for rewards in the reward store

## Creating Chores

Parents can create chores from the Chores page:

1. Go to **Chores** from the menu
2. Click the **+** button
3. Fill in the chore details:
   - **Name**: What the chore is (e.g., "Make bed")
   - **Stars**: How many stars it's worth
   - **Assigned to**: Which child (or all children)
   - **Frequency**: One-time, daily, weekly, etc.

## Completing Chores

When a child finishes a chore:

1. Open the app on any device
2. Find the chore in the list
3. Tap the checkmark to complete it

Stars are added to their balance immediately.

## Star Balance

Each child has a star balance showing how many stars they've earned. View balances on:

- The dashboard
- The reward chart
- The child's profile

## Star History

Parents can view the complete star history to see:

- When stars were earned
- Which chores were completed
- When stars were spent on rewards

## Tips for Success

- Start with a few simple chores
- Make star values fair and consistent
- Celebrate when kids earn rewards
- Adjust difficulty as kids grow
```

**Step 2: Create Dutch chores**

Create `content/help/nl/chores.mdx`:

```mdx
# Klusjes & Sterren

Maak huishoudelijke taken leuk met sterren en beloningen.

## Hoe het werkt

1. Ouders maken klusjes aan met sterwaarden
2. Kinderen voltooien klusjes en verdienen sterren
3. Sterren kunnen worden ingewisseld voor beloningen in de beloningswinkel

## Klusjes aanmaken

Ouders kunnen klusjes aanmaken vanaf de Klusjes-pagina:

1. Ga naar **Klusjes** via het menu
2. Klik op de **+** knop
3. Vul de klusjesdetails in:
   - **Naam**: Wat het klusje is (bijv. "Bed opmaken")
   - **Sterren**: Hoeveel sterren het waard is
   - **Toegewezen aan**: Welk kind (of alle kinderen)
   - **Frequentie**: Eenmalig, dagelijks, wekelijks, etc.

## Klusjes voltooien

Wanneer een kind een klusje afrondt:

1. Open de app op elk apparaat
2. Vind het klusje in de lijst
3. Tik op het vinkje om het te voltooien

Sterren worden direct aan hun saldo toegevoegd.

## Sterrensaldo

Elk kind heeft een sterrensaldo dat toont hoeveel sterren ze hebben verdiend. Bekijk saldi op:

- Het dashboard
- De sterrenkaart
- Het profiel van het kind

## Sterrengeschiedenis

Ouders kunnen de volledige sterrengeschiedenis bekijken om te zien:

- Wanneer sterren zijn verdiend
- Welke klusjes zijn voltooid
- Wanneer sterren zijn uitgegeven aan beloningen

## Tips voor succes

- Begin met een paar eenvoudige klusjes
- Maak sterwaarden eerlijk en consistent
- Vier het wanneer kinderen beloningen verdienen
- Pas de moeilijkheid aan naarmate kinderen groeien
```

**Step 3: Commit**

```bash
git add content/help/
git commit -m "docs: add chores and stars help content"
```

---

### Task 10: Create Rewards Content

**Files:**

- Create: `content/help/en/rewards.mdx`
- Create: `content/help/nl/rewards.mdx`

**Step 1: Create English rewards**

Create `content/help/en/rewards.mdx`:

```mdx
# Reward Store

The reward store lets kids spend their hard-earned stars on treats and privileges.

## Setting Up Rewards

Parents create rewards that kids can work toward:

1. Go to **Rewards** from the menu
2. Click **Add Reward**
3. Fill in the details:
   - **Name**: What the reward is
   - **Star cost**: How many stars it costs
   - **Description**: Optional details
   - **Image**: Optional picture

## Reward Ideas

Here are some popular reward ideas:

### Small Rewards (5-20 stars)

- Extra screen time (30 minutes)
- Choose dinner menu
- Stay up 15 minutes later

### Medium Rewards (25-50 stars)

- Movie night pick
- Friend sleepover
- Special outing

### Big Rewards (75-100+ stars)

- New toy or game
- Day trip of their choice
- Special experience

## Redeeming Rewards

When a child has enough stars:

1. Go to the Reward Store
2. Find the reward they want
3. Click **Redeem**
4. Stars are deducted from their balance

Parents receive a notification when rewards are redeemed.

## Managing Rewards

Parents can:

- Edit reward costs and details
- Disable rewards temporarily
- Delete rewards no longer needed
- View redemption history
```

**Step 2: Create Dutch rewards**

Create `content/help/nl/rewards.mdx`:

```mdx
# Beloningswinkel

De beloningswinkel laat kinderen hun zuurverdiende sterren uitgeven aan traktaties en privileges.

## Beloningen instellen

Ouders maken beloningen aan waar kinderen naartoe kunnen werken:

1. Ga naar **Beloningen** via het menu
2. Klik op **Beloning toevoegen**
3. Vul de details in:
   - **Naam**: Wat de beloning is
   - **Sterrenkosten**: Hoeveel sterren het kost
   - **Beschrijving**: Optionele details
   - **Afbeelding**: Optionele foto

## Beloningsideeën

Hier zijn enkele populaire beloningsideeën:

### Kleine beloningen (5-20 sterren)

- Extra schermtijd (30 minuten)
- Diner kiezen
- 15 minuten later naar bed

### Middelgrote beloningen (25-50 sterren)

- Filmavond kiezen
- Vriendje logeren
- Speciaal uitje

### Grote beloningen (75-100+ sterren)

- Nieuw speelgoed of spel
- Dagje uit naar keuze
- Speciale ervaring

## Beloningen inwisselen

Wanneer een kind genoeg sterren heeft:

1. Ga naar de Beloningswinkel
2. Vind de gewenste beloning
3. Klik op **Inwisselen**
4. Sterren worden van hun saldo afgetrokken

Ouders ontvangen een melding wanneer beloningen worden ingewisseld.

## Beloningen beheren

Ouders kunnen:

- Beloningskosten en details bewerken
- Beloningen tijdelijk uitschakelen
- Beloningen verwijderen die niet meer nodig zijn
- Inwisselingsgeschiedenis bekijken
```

**Step 3: Commit**

```bash
git add content/help/
git commit -m "docs: add reward store help content"
```

---

### Task 11: Create Wall Hub Content

**Files:**

- Create: `content/help/en/wall-hub.mdx`
- Create: `content/help/nl/wall-hub.mdx`

**Step 1: Create English wall-hub**

Create `content/help/en/wall-hub.mdx`:

```mdx
# Wall Hub

Turn any tablet or screen into a family command center on your wall.

## What is Wall Hub Mode?

Wall Hub mode transforms Kynite into a glanceable display optimized for:

- Wall-mounted tablets
- Kitchen counters
- Common areas

It shows the most important information without requiring interaction.

## Enabling Wall Hub Mode

1. Go to **Settings**
2. Find **Display Mode**
3. Select **Wall Hub**

The interface will switch to a simplified, large-text display.

## What's Shown

Wall Hub mode displays:

- Today's calendar at a glance
- Upcoming events
- Current time (large)
- Active chores
- Star balances

## Display Settings

Customize the wall hub display:

### Auto-Refresh

Events and chores update automatically. The default refresh interval is every minute.

### Screen Orientation

Lock the screen to landscape or portrait depending on your display setup.

### Show/Hide Sections

Choose which sections appear:

- Calendar events
- Chore list
- Star chart
- Current time

## Hardware Tips

### Recommended Tablets

Any tablet with a web browser works. Popular choices:

- Amazon Fire tablets (budget-friendly)
- iPad (premium)
- Android tablets

### Mounting

- Use a wall mount or tablet stand
- Position at eye level for adults
- Ensure power cable reaches an outlet
- Consider a tablet with always-on display

### Power

Keep the tablet plugged in 24/7 for always-on display. Most tablets handle this well.
```

**Step 2: Create Dutch wall-hub**

Create `content/help/nl/wall-hub.mdx`:

```mdx
# Wandscherm

Maak van elke tablet of scherm een gezinscommandocentrum aan je muur.

## Wat is Wandschermmodus?

Wandschermmodus transformeert Kynite in een overzichtelijke weergave geoptimaliseerd voor:

- Wandgemonteerde tablets
- Keukenbladen
- Gemeenschappelijke ruimtes

Het toont de belangrijkste informatie zonder interactie te vereisen.

## Wandschermmodus inschakelen

1. Ga naar **Instellingen**
2. Vind **Weergavemodus**
3. Selecteer **Wandscherm**

De interface schakelt over naar een vereenvoudigde weergave met grote tekst.

## Wat wordt getoond

Wandschermmodus toont:

- Kalender van vandaag in één oogopslag
- Aankomende evenementen
- Huidige tijd (groot)
- Actieve klusjes
- Sterrensaldi

## Weergave-instellingen

Pas de wandschermweergave aan:

### Automatisch vernieuwen

Evenementen en klusjes worden automatisch bijgewerkt. Het standaard verversingsinterval is elke minuut.

### Schermoriëntatie

Vergrendel het scherm naar liggend of staand, afhankelijk van je displayopstelling.

### Secties tonen/verbergen

Kies welke secties verschijnen:

- Kalender evenementen
- Klusjeslijst
- Sterrenkaart
- Huidige tijd

## Hardware tips

### Aanbevolen tablets

Elke tablet met een webbrowser werkt. Populaire keuzes:

- Amazon Fire tablets (budgetvriendelijk)
- iPad (premium)
- Android tablets

### Montage

- Gebruik een wandhouder of tabletstandaard
- Positioneer op ooghoogte voor volwassenen
- Zorg dat de stroomkabel een stopcontact bereikt
- Overweeg een tablet met always-on display

### Stroom

Houd de tablet 24/7 aangesloten voor always-on display. De meeste tablets kunnen dit goed aan.
```

**Step 3: Commit**

```bash
git add content/help/
git commit -m "docs: add wall hub help content"
```

---

## Phase 3: App Integration

### Task 12: Create HelpLink Component

**Files:**

- Create: `src/components/ui/help-link.tsx`

**Step 1: Create the component**

Create `src/components/ui/help-link.tsx`:

```tsx
"use client";

import { HelpCircle } from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type HelpPage =
  | "getting-started"
  | "calendar"
  | "chores"
  | "rewards"
  | "wall-hub";

interface HelpLinkProps {
  page?: HelpPage;
  section?: string;
  variant?: "icon" | "text";
  className?: string;
  label?: string;
}

const pageLabels: Record<HelpPage, string> = {
  "getting-started": "Getting started help",
  calendar: "Calendar help",
  chores: "Chores help",
  rewards: "Rewards help",
  "wall-hub": "Wall hub help",
};

export function HelpLink({
  page,
  section,
  variant = "icon",
  className,
  label,
}: HelpLinkProps) {
  const locale = useLocale();

  const basePath = `/${locale}/help`;
  const pagePath = page ? `${basePath}/${page}` : basePath;
  const href = section ? `${pagePath}#${section}` : pagePath;

  const tooltipLabel = label || (page ? pageLabels[page] : "Help center");

  if (variant === "text") {
    return (
      <Link
        href={href}
        className={cn(
          "text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline",
          className
        )}
      >
        <HelpCircle className="size-4" />
        {tooltipLabel}
      </Link>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            className={cn(
              "text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-md p-2 transition-colors",
              className
            )}
            aria-label={tooltipLabel}
          >
            <HelpCircle className="size-5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{tooltipLabel} →</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

**Step 2: Verify no type errors**

Run:

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/help-link.tsx
git commit -m "feat: add HelpLink component for contextual help"
```

---

### Task 13: Update Navigation Menu

**Files:**

- Modify: `src/components/layout/navigation-menu.tsx`

**Step 1: Update navigation menu**

Replace the TODO help button (lines 100-111) with a proper link. Find:

```tsx
<div className="border-t p-2">
  <button
    className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-12 w-full items-center gap-3 rounded-md px-4 text-sm font-medium"
    onClick={() => {
      // TODO: Open help modal
      onOpenChange(false);
    }}
  >
    <HelpCircle className="size-5" />
    {t("help")}
  </button>
</div>
```

Replace with:

```tsx
<div className="border-t p-2">
  <ProgressLink
    href="/help"
    onClick={() => onOpenChange(false)}
    className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-12 w-full items-center gap-3 rounded-md px-4 text-sm font-medium"
  >
    <HelpCircle className="size-5" />
    {t("help")}
  </ProgressLink>
</div>
```

**Step 2: Verify no type errors**

Run:

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Test navigation**

Run dev server, open menu, click Help. Should navigate to `/help`.

**Step 4: Commit**

```bash
git add src/components/layout/navigation-menu.tsx
git commit -m "feat: link help menu item to help center"
```

---

### Task 14: Add Help Link to Header

**Files:**

- Modify: `src/components/layout/app-header.tsx`

**Step 1: Add import**

Add to imports:

```tsx
import { HelpLink } from "@/components/ui/help-link";
```

**Step 2: Add help link before user menu**

Find the right section (lines 42-54) and add HelpLink before UserMenu:

```tsx
{
  /* Right: Help + User Menu */
}
<div className="flex min-w-0 flex-1 items-center justify-end gap-2">
  <HelpLink />
  {isManager && user && (
    <div data-testid="user-avatar">
      <UserMenu
        user={{
          name: user.name || "User",
          email: user.email || "",
          image: user.image,
        }}
      />
    </div>
  )}
</div>;
```

**Step 3: Verify no type errors**

Run:

```bash
pnpm typecheck
```

Expected: No errors

**Step 4: Test**

Run dev server, verify help icon appears in header next to user menu.

**Step 5: Commit**

```bash
git add src/components/layout/app-header.tsx
git commit -m "feat: add help icon to app header"
```

---

### Task 15: Add Translations for Help

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Add English translations**

Add to `messages/en.json` under a new "Help" section:

```json
"Help": {
  "title": "Help Center",
  "linkLabel": "Help",
  "gettingStarted": "Getting Started",
  "calendar": "Calendar",
  "chores": "Chores & Stars",
  "rewards": "Reward Store",
  "wallHub": "Wall Hub"
}
```

**Step 2: Add Dutch translations**

Add to `messages/nl.json`:

```json
"Help": {
  "title": "Helpcentrum",
  "linkLabel": "Help",
  "gettingStarted": "Aan de slag",
  "calendar": "Kalender",
  "chores": "Klusjes & Sterren",
  "rewards": "Beloningswinkel",
  "wallHub": "Wandscherm"
}
```

**Step 3: Commit**

```bash
git add messages/
git commit -m "feat: add help center translations"
```

---

### Task 16: Run Tests and Verify

**Step 1: Run type check**

Run:

```bash
pnpm typecheck
```

Expected: No errors

**Step 2: Run linter**

Run:

```bash
pnpm lint
```

Expected: No errors (or only warnings)

**Step 3: Run tests**

Run:

```bash
pnpm test:run
```

Expected: All tests pass

**Step 4: Manual verification**

Run dev server and verify:

1. `/en/help` loads the English help center
2. `/nl/help` loads the Dutch help center
3. All 5 content pages load in both languages
4. Help icon in header links to help center
5. Help link in menu works
6. Sidebar navigation works

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete user documentation help center"
```

---

## Summary

This plan implements:

1. **Nextra integration** - Full docs framework configured with Next.js 16
2. **Bilingual content** - 5 help sections in Dutch and English
3. **App integration** - HelpLink component, header icon, menu link
4. **14 MDX pages** - Complete user documentation

The help center is accessible at `/[locale]/help` and integrates seamlessly with the existing i18n routing.
