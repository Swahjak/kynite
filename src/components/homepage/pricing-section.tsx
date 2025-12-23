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
