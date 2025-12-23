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
