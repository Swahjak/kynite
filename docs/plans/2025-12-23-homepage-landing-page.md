# Homepage Landing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the marketing landing page for Kynite based on the design in `docs/design/homepage/`.

**Architecture:** Replace the current minimal home-content.tsx with a full marketing landing page. The page will be a client component using next-intl for translations and existing shadcn components. The design shows "Wall Hub" but we'll use "Kynite" per brand guidelines.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, next-intl, Material Symbols Outlined

---

## Design Analysis

The design (`docs/design/homepage/homepage-design-1.png`) contains:

1. **Header**: Sticky nav with logo, nav links (Features, How it Works, Plans), Sign In, Sign Up
2. **Hero Section**: Badge, headline, description, 2 CTAs, interactive dashboard preview
3. **Features Section**: 3 feature cards (Unified Calendar, Gamified Routines, Meal Planning)
4. **Pricing Section**: 3 pricing tiers (Free, Basic, Pro)
5. **CTA Section**: Dark background with call-to-action
6. **Footer**: Logo, copyright, social links

---

### Task 1: Add Homepage Translation Keys

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Add English translations**

Add to `messages/en.json` after the existing `HomePage` key (replace the current minimal `HomePage` section):

```json
"HomePage": {
  "nav": {
    "features": "Features",
    "howItWorks": "How it Works",
    "plans": "Plans",
    "signIn": "Sign In",
    "signUp": "Sign Up"
  },
  "hero": {
    "badge": "The OS for your home",
    "title": "The Operating System for Your Family",
    "description": "Reduce mental load, gamify chores, and keep everyone in sync. The proactive dashboard designed specifically for your home's wall hub.",
    "cta": "Get Started for Free",
    "ctaSecondary": "View Demo",
    "previewLabel": "Interactive Dashboard Preview"
  },
  "features": {
    "title": "Everything you need to run your home",
    "subtitle": "Powerful features designed to replace the sticky notes, mental math, and chaos.",
    "calendar": {
      "title": "Unified Calendar",
      "description": "Syncs seamlessly with Google & Apple calendars. See everyone's schedule in one glance on the wall, color-coded for clarity."
    },
    "routines": {
      "title": "Gamified Routines",
      "description": "Turn boring chores into streaks. Kids earn points, unlock rewards, and build healthy habits without the nagging."
    },
    "meals": {
      "title": "Meal Planning",
      "description": "Drag-and-drop meal planner that generates grocery lists automatically. Know exactly \"what's for dinner\" every single night."
    }
  },
  "pricing": {
    "title": "License Plans",
    "subtitle": "Choose the perfect tier for your family size.",
    "mostPopular": "Most Popular",
    "perMonth": "/month",
    "free": {
      "name": "Free",
      "description": "For getting organized.",
      "price": "0",
      "features": ["Shared Calendar (Read-only)", "Basic Todo Lists", "Up to 2 Family Members"],
      "cta": "Sign Up Free"
    },
    "basic": {
      "name": "Basic",
      "description": "For the active household.",
      "price": "9",
      "includes": "Everything in Free",
      "features": ["2-Way Calendar Sync (Google/Apple)", "Meal Planner & Recipe Storage", "Up to 5 Family Members"],
      "cta": "Get Basic"
    },
    "pro": {
      "name": "Pro",
      "description": "For total home automation.",
      "price": "19",
      "includes": "Everything in Basic",
      "features": ["Advanced Chore Analytics & History", "Unlimited Family Members", "Custom Dashboard Themes"],
      "cta": "Get Pro"
    }
  },
  "cta": {
    "title": "Ready to organize your wall?",
    "description": "Join thousands of families who have reclaimed their time and sanity with Kynite.",
    "button": "Start Your Free Trial",
    "note": "No credit card required for 14-day trial."
  },
  "footer": {
    "copyright": "© 2024 Kynite. All rights reserved."
  }
}
```

**Step 2: Add Dutch translations**

Add the same structure to `messages/nl.json` with Dutch translations:

```json
"HomePage": {
  "nav": {
    "features": "Functies",
    "howItWorks": "Hoe het werkt",
    "plans": "Abonnementen",
    "signIn": "Inloggen",
    "signUp": "Registreren"
  },
  "hero": {
    "badge": "Het OS voor je huis",
    "title": "Het besturingssysteem voor je gezin",
    "description": "Verminder mentale belasting, gamificeer klusjes en houd iedereen op de hoogte. Het proactieve dashboard speciaal ontworpen voor je familiehub.",
    "cta": "Gratis starten",
    "ctaSecondary": "Demo bekijken",
    "previewLabel": "Interactief Dashboard Voorbeeld"
  },
  "features": {
    "title": "Alles wat je nodig hebt om je huishouden te runnen",
    "subtitle": "Krachtige functies ontworpen om de plakbriefjes, hoofdrekenen en chaos te vervangen.",
    "calendar": {
      "title": "Geïntegreerde Kalender",
      "description": "Synchroniseert naadloos met Google & Apple kalenders. Bekijk ieders planning in één oogopslag aan de muur, kleurgecodeerd voor duidelijkheid."
    },
    "routines": {
      "title": "Gamified Routines",
      "description": "Verander saaie klusjes in streaks. Kinderen verdienen punten, ontgrendelen beloningen en bouwen gezonde gewoontes zonder het zeuren."
    },
    "meals": {
      "title": "Maaltijdplanning",
      "description": "Sleep-en-drop maaltijdplanner die automatisch boodschappenlijstjes genereert. Weet elke avond precies \"wat eten we vanavond\"."
    }
  },
  "pricing": {
    "title": "Abonnementen",
    "subtitle": "Kies het perfecte plan voor je gezinsgrootte.",
    "mostPopular": "Meest Populair",
    "perMonth": "/maand",
    "free": {
      "name": "Gratis",
      "description": "Om georganiseerd te raken.",
      "price": "0",
      "features": ["Gedeelde Kalender (Alleen lezen)", "Basis Takenlijsten", "Tot 2 Gezinsleden"],
      "cta": "Gratis Registreren"
    },
    "basic": {
      "name": "Basis",
      "description": "Voor het actieve huishouden.",
      "price": "9",
      "includes": "Alles in Gratis",
      "features": ["2-Weg Kalender Sync (Google/Apple)", "Maaltijdplanner & Receptopslag", "Tot 5 Gezinsleden"],
      "cta": "Kies Basis"
    },
    "pro": {
      "name": "Pro",
      "description": "Voor totale huisautomatisering.",
      "price": "19",
      "includes": "Alles in Basis",
      "features": ["Geavanceerde Klusanalyse & Geschiedenis", "Onbeperkt Gezinsleden", "Aangepaste Dashboard Thema's"],
      "cta": "Kies Pro"
    }
  },
  "cta": {
    "title": "Klaar om je muur te organiseren?",
    "description": "Sluit je aan bij duizenden gezinnen die hun tijd en rust hebben teruggewonnen met Kynite.",
    "button": "Start Je Gratis Proefperiode",
    "note": "Geen creditcard nodig voor 14-dagen proefperiode."
  },
  "footer": {
    "copyright": "© 2024 Kynite. Alle rechten voorbehouden."
  }
}
```

**Step 3: Verify translations load correctly**

Run: `pnpm dev`
Expected: Dev server starts without errors

**Step 4: Commit**

```bash
git add messages/en.json messages/nl.json
git commit -m "feat(homepage): add translation keys for landing page"
```

---

### Task 2: Create Homepage Header Component

**Files:**

- Create: `src/components/homepage/homepage-header.tsx`

**Step 1: Create the header component**

```tsx
"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HomepageHeader() {
  const t = useTranslations("HomePage.nav");
  const common = useTranslations("Common");

  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo-icon.svg"
            alt={common("appName")}
            width={32}
            height={32}
            className="size-8"
          />
          <span className="font-display text-lg font-bold tracking-tight">
            {common("appName")}
          </span>
        </Link>

        {/* Navigation */}
        <nav className="text-muted-foreground hidden items-center gap-8 text-sm font-medium md:flex">
          <a
            href="#features"
            className="hover:text-foreground transition-colors"
          >
            {t("features")}
          </a>
          <a
            href="#how-it-works"
            className="hover:text-foreground transition-colors"
          >
            {t("howItWorks")}
          </a>
          <a
            href="#pricing"
            className="hover:text-foreground transition-colors"
          >
            {t("plans")}
          </a>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground hidden text-sm font-medium transition-colors md:inline-flex"
          >
            {t("signIn")}
          </Link>
          <Button asChild>
            <Link href="/login">{t("signUp")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Verify component compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/homepage/homepage-header.tsx
git commit -m "feat(homepage): add header component with navigation"
```

---

### Task 3: Create Hero Section Component

**Files:**

- Create: `src/components/homepage/hero-section.tsx`

**Step 1: Create the hero section component**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function HeroSection() {
  const t = useTranslations("HomePage.hero");

  return (
    <section className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24">
      <div className="relative z-10 container mx-auto px-4 text-center md:px-6">
        {/* Badge */}
        <div className="bg-card text-muted-foreground mb-6 inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium shadow-sm">
          <span className="bg-primary mr-2 flex h-2 w-2 animate-pulse rounded-full" />
          {t("badge")}
        </div>

        {/* Headline */}
        <h1 className="font-display mx-auto mb-6 max-w-4xl text-4xl leading-[1.1] font-bold tracking-tight md:text-6xl lg:text-7xl">
          {t("title")}
        </h1>

        {/* Description */}
        <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg leading-relaxed md:text-xl">
          {t("description")}
        </p>

        {/* CTAs */}
        <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild size="lg" className="w-full rounded-xl sm:w-auto">
            <Link href="/login">{t("cta")}</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full rounded-xl sm:w-auto"
          >
            <Link href="/calendar">{t("ctaSecondary")}</Link>
          </Button>
        </div>

        {/* Dashboard Preview */}
        <div className="bg-card relative mx-auto aspect-[16/9] max-w-5xl overflow-hidden rounded-xl border shadow-2xl md:aspect-[2/1]">
          <DashboardPreview />
          <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
            <p className="text-foreground flex items-center gap-2 rounded-full border border-white/50 bg-white/90 px-6 py-3 text-sm font-semibold shadow-xl backdrop-blur-md">
              <Icon name="touch_app" className="text-primary" />
              {t("previewLabel")}
            </p>
          </div>
        </div>
      </div>

      {/* Background gradient */}
      <div className="from-primary/5 via-background to-background absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]" />
    </section>
  );
}

function DashboardPreview() {
  return (
    <div className="bg-muted/50 absolute inset-0 flex flex-col">
      {/* Window Chrome */}
      <div className="bg-card flex h-12 items-center gap-2 border-b px-4">
        <div className="flex gap-1.5">
          <div className="size-3 rounded-full bg-red-400" />
          <div className="size-3 rounded-full bg-yellow-400" />
          <div className="size-3 rounded-full bg-green-400" />
        </div>
        <div className="bg-muted ml-4 h-2 w-32 rounded-full" />
      </div>

      {/* Dashboard Grid */}
      <div className="grid flex-1 grid-cols-1 gap-6 p-6 md:grid-cols-4">
        {/* Sidebar */}
        <div className="col-span-1 hidden space-y-4 md:block">
          <div className="border-primary/20 bg-primary/10 flex h-24 flex-col items-center justify-center gap-2 rounded-lg border">
            <div className="bg-primary/40 h-2 w-16 rounded-full" />
            <div className="bg-primary/40 h-6 w-10 rounded-lg" />
          </div>
          <div className="bg-card h-12 rounded-lg border shadow-sm" />
          <div className="bg-card h-12 rounded-lg border shadow-sm" />
        </div>

        {/* Main Content */}
        <div className="col-span-1 grid grid-cols-2 gap-4 md:col-span-3 md:grid-cols-3">
          <div className="bg-card h-full space-y-2 rounded-lg border p-4 shadow-sm">
            <div className="bg-muted h-3 w-12 rounded" />
            <div className="h-16 rounded border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-950" />
            <div className="h-16 rounded border-l-4 border-purple-400 bg-purple-50 dark:bg-purple-950" />
          </div>
          <div className="bg-card h-full space-y-2 rounded-lg border p-4 shadow-sm">
            <div className="bg-muted h-3 w-12 rounded" />
            <div className="h-16 rounded border-l-4 border-orange-400 bg-orange-50 dark:bg-orange-950" />
          </div>
          <div className="bg-card hidden h-full space-y-2 rounded-lg border p-4 shadow-sm md:block">
            <div className="bg-muted h-3 w-12 rounded" />
            <div className="text-muted-foreground flex h-24 items-center justify-center rounded border border-dashed">
              <Icon name="add" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify component compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/homepage/hero-section.tsx
git commit -m "feat(homepage): add hero section with dashboard preview"
```

---

### Task 4: Create Features Section Component

**Files:**

- Create: `src/components/homepage/features-section.tsx`

**Step 1: Create the features section component**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const features = [
  {
    key: "calendar",
    icon: "calendar_month",
    color: "primary",
  },
  {
    key: "routines",
    icon: "stadia_controller",
    color: "purple",
  },
  {
    key: "meals",
    icon: "restaurant_menu",
    color: "orange",
  },
] as const;

const colorClasses = {
  primary: {
    icon: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
    border: "hover:border-primary/50",
  },
  purple: {
    icon: "bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white dark:bg-purple-900/50 dark:text-purple-400",
    border: "hover:border-purple-200 dark:hover:border-purple-800",
  },
  orange: {
    icon: "bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white dark:bg-orange-900/50 dark:text-orange-400",
    border: "hover:border-orange-200 dark:hover:border-orange-800",
  },
};

export function FeaturesSection() {
  const t = useTranslations("HomePage.features");

  return (
    <section id="features" className="bg-card border-y py-16">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">{t("subtitle")}</p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.key}
              className={cn(
                "group bg-background relative rounded-2xl border p-8 transition-all duration-300 hover:shadow-lg",
                colorClasses[feature.color].border
              )}
            >
              <div
                className={cn(
                  "mb-6 inline-flex size-14 items-center justify-center rounded-xl shadow-sm transition-colors",
                  colorClasses[feature.color].icon
                )}
              >
                <Icon name={feature.icon} size="lg" />
              </div>
              <h3 className="font-display mb-3 text-xl font-bold">
                {t(`${feature.key}.title`)}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t(`${feature.key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Verify component compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/homepage/features-section.tsx
git commit -m "feat(homepage): add features section with 3 cards"
```

---

### Task 5: Create Pricing Section Component

**Files:**

- Create: `src/components/homepage/pricing-section.tsx`

**Step 1: Create the pricing section component**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const tiers = [
  { key: "free", featured: false },
  { key: "basic", featured: true },
  { key: "pro", featured: false },
] as const;

export function PricingSection() {
  const t = useTranslations("HomePage.pricing");

  return (
    <section id="pricing" className="bg-background relative py-20">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">{t("subtitle")}</p>
        </div>

        {/* Pricing Cards */}
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <PricingCard
              key={tier.key}
              tierKey={tier.key}
              featured={tier.featured}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingCard({
  tierKey,
  featured,
}: {
  tierKey: "free" | "basic" | "pro";
  featured: boolean;
}) {
  const t = useTranslations("HomePage.pricing");

  const features = t.raw(`${tierKey}.features`) as string[];
  const includesText =
    tierKey !== "free" ? (t(`${tierKey}.includes`) as string) : null;

  return (
    <div
      className={cn(
        "bg-card relative flex flex-col rounded-2xl p-6 transition-shadow",
        featured
          ? "border-primary z-10 scale-100 border-2 shadow-xl lg:scale-105"
          : "border shadow-sm hover:shadow-md"
      )}
    >
      {/* Most Popular Badge */}
      {featured && (
        <div className="bg-primary text-primary-foreground absolute -top-4 right-0 left-0 mx-auto w-fit rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase">
          {t("mostPopular")}
        </div>
      )}

      {/* Tier Info */}
      <div className="mb-4">
        <h3 className="font-display text-lg font-bold">
          {t(`${tierKey}.name`)}
        </h3>
        <div className="mt-2 flex items-baseline">
          <span className="font-display text-4xl font-bold tracking-tight">
            ${t(`${tierKey}.price`)}
          </span>
          <span className="text-muted-foreground ml-1 text-sm font-semibold">
            {t("perMonth")}
          </span>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          {t(`${tierKey}.description`)}
        </p>
      </div>

      <div className="bg-border my-4 h-px" />

      {/* Features List */}
      <ul className="mb-8 flex-1 space-y-4">
        {includesText && (
          <li className="flex items-start text-sm">
            <Icon
              name="check_circle"
              className="text-primary mr-3 shrink-0"
              size="sm"
            />
            <span className="font-semibold">{includesText}</span>
          </li>
        )}
        {features.map((feature, index) => (
          <li key={index} className="flex items-start text-sm">
            <Icon
              name="check_circle"
              className="text-primary mr-3 shrink-0"
              size="sm"
            />
            {feature}
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <Button
        asChild
        variant={featured ? "default" : "outline"}
        className="w-full"
      >
        <Link href="/login">{t(`${tierKey}.cta`)}</Link>
      </Button>
    </div>
  );
}
```

**Step 2: Verify component compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/homepage/pricing-section.tsx
git commit -m "feat(homepage): add pricing section with 3 tiers"
```

---

### Task 6: Create CTA Section Component

**Files:**

- Create: `src/components/homepage/cta-section.tsx`

**Step 1: Create the CTA section component**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  const t = useTranslations("HomePage.cta");

  return (
    <section className="bg-foreground text-background relative overflow-hidden py-20">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)]" />

      <div className="relative z-10 container mx-auto px-4 text-center">
        <h2 className="font-display mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="text-background/70 mx-auto mb-8 max-w-2xl text-lg">
          {t("description")}
        </p>
        <Button
          asChild
          size="lg"
          className="ring-offset-foreground focus-visible:ring-offset-foreground rounded-xl"
        >
          <Link href="/login">{t("button")}</Link>
        </Button>
        <p className="text-background/50 mt-4 text-sm">{t("note")}</p>
      </div>
    </section>
  );
}
```

**Step 2: Verify component compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/homepage/cta-section.tsx
git commit -m "feat(homepage): add CTA section"
```

---

### Task 7: Create Homepage Footer Component

**Files:**

- Create: `src/components/homepage/homepage-footer.tsx`

**Step 1: Create the footer component**

```tsx
"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/icon";

export function HomepageFooter() {
  const t = useTranslations("HomePage.footer");
  const common = useTranslations("Common");

  return (
    <footer className="bg-card border-t py-12">
      <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 md:flex-row md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo-icon.svg"
            alt={common("appName")}
            width={24}
            height={24}
            className="size-6"
          />
          <span className="font-display font-bold">{common("appName")}</span>
        </Link>

        {/* Copyright */}
        <p className="text-muted-foreground text-sm">{t("copyright")}</p>

        {/* Social Links */}
        <div className="flex gap-6">
          <a
            href="#"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Twitter"
          >
            <Icon name="share" size="md" />
          </a>
          <a
            href="#"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="GitHub"
          >
            <Icon name="code" size="md" />
          </a>
        </div>
      </div>
    </footer>
  );
}
```

**Step 2: Verify component compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/homepage/homepage-footer.tsx
git commit -m "feat(homepage): add footer component"
```

---

### Task 8: Create Homepage Index Export

**Files:**

- Create: `src/components/homepage/index.ts`

**Step 1: Create barrel export**

```ts
export { HomepageHeader } from "./homepage-header";
export { HeroSection } from "./hero-section";
export { FeaturesSection } from "./features-section";
export { PricingSection } from "./pricing-section";
export { CtaSection } from "./cta-section";
export { HomepageFooter } from "./homepage-footer";
```

**Step 2: Commit**

```bash
git add src/components/homepage/index.ts
git commit -m "feat(homepage): add barrel export for homepage components"
```

---

### Task 9: Update HomeContent to Use New Components

**Files:**

- Modify: `src/app/[locale]/home-content.tsx`

**Step 1: Replace the current minimal implementation**

```tsx
"use client";

import {
  HomepageHeader,
  HeroSection,
  FeaturesSection,
  PricingSection,
  CtaSection,
  HomepageFooter,
} from "@/components/homepage";

export function HomeContent() {
  return (
    <div className="flex min-h-screen flex-col">
      <HomepageHeader />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <CtaSection />
      </main>
      <HomepageFooter />
    </div>
  );
}
```

**Step 2: Verify the page renders correctly**

Run: `pnpm dev`
Navigate to: `http://localhost:3000`
Expected: Full landing page with all sections visible

**Step 3: Commit**

```bash
git add src/app/[locale]/home-content.tsx
git commit -m "feat(homepage): integrate all landing page sections"
```

---

### Task 10: Visual Verification and Final Polish

**Files:**

- Potentially: Various homepage component files for minor adjustments

**Step 1: Test light mode**

Run: `pnpm dev`
Navigate to: `http://localhost:3000`
Expected: Page renders correctly in light mode

**Step 2: Test dark mode**

Toggle to dark mode using the theme switcher (if available) or browser dev tools
Expected: All sections render correctly with appropriate dark mode colors

**Step 3: Test Dutch locale**

Navigate to: `http://localhost:3000/nl`
Expected: All text displays in Dutch

**Step 4: Test responsive design**

Resize browser to mobile widths (< 768px)
Expected:

- Header shows only logo and Sign Up button
- Hero CTAs stack vertically
- Feature cards stack vertically
- Pricing cards stack vertically

**Step 5: Run linting**

Run: `pnpm lint`
Expected: No errors

**Step 6: Run build**

Run: `pnpm build`
Expected: Build succeeds without errors

**Step 7: Final commit**

```bash
git add -A
git commit -m "feat(homepage): complete landing page implementation"
```

---

## Summary

This plan implements the full marketing landing page with:

- 6 new components in `src/components/homepage/`
- Full i18n support (EN + NL)
- Dark mode support using existing CSS variables
- Responsive design for mobile and desktop
- Reuses existing shadcn components (Button, Icon)
- Follows brand guidelines (Kynite branding, Lexend font, primary color)

---

**Plan complete and saved to `docs/plans/2025-12-23-homepage-landing-page.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
