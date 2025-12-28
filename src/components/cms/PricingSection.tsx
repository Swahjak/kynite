"use client";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { CheckCircle } from "lucide-react";

// TODO: Replace with auto-generated types from payload-types.ts once available
export interface PricingBlockData {
  blockType: "pricing";
  title: string;
  subtitle?: string | null;
  tiers?: Array<{
    name: string;
    price: number;
    currency?: string | null;
    period?: string | null;
    description?: string | null;
    featured?: boolean | null;
    features?: Array<{
      text: string;
      id?: string | null;
    }> | null;
    cta?: {
      label: string;
      href: string;
    } | null;
    id?: string | null;
  }> | null;
}

interface PricingSectionProps {
  data: PricingBlockData;
}

export function PricingSection({ data }: PricingSectionProps) {
  return (
    <section id="pricing" className="bg-background relative py-20">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {data.title}
          </h2>
          {data.subtitle && (
            <p className="text-muted-foreground mt-4 text-lg">
              {data.subtitle}
            </p>
          )}
        </div>

        {/* Pricing Cards */}
        {data.tiers && data.tiers.length > 0 && (
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-8 lg:grid-cols-3">
            {data.tiers.map((tier, index) => (
              <PricingCard key={tier.id ?? index} tier={tier} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface PricingCardProps {
  tier: NonNullable<PricingBlockData["tiers"]>[number];
}

function PricingCard({ tier }: PricingCardProps) {
  const featured = tier.featured ?? false;
  const currency = tier.currency ?? "EUR";
  const period = tier.period ?? "/month";

  // Format currency symbol
  const currencySymbol =
    currency === "EUR" ? "\u20AC" : currency === "USD" ? "$" : currency;

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
          Most Popular
        </div>
      )}

      {/* Tier Info */}
      <div className="mb-4">
        <h3 className="font-display text-lg font-bold">{tier.name}</h3>
        <div className="mt-2 flex items-baseline">
          <span className="font-display text-4xl font-bold tracking-tight">
            {currencySymbol}
            {tier.price}
          </span>
          <span className="text-muted-foreground ml-1 text-sm font-semibold">
            {period}
          </span>
        </div>
        {tier.description && (
          <p className="text-muted-foreground mt-2 text-sm">
            {tier.description}
          </p>
        )}
      </div>

      <div className="bg-border my-4 h-px" />

      {/* Features List */}
      <ul className="mb-8 flex-1 space-y-4">
        {tier.features?.map((feature, index) => (
          <li key={feature.id ?? index} className="flex items-start text-sm">
            <Icon
              icon={CheckCircle}
              className="text-primary mr-3 shrink-0"
              size="sm"
            />
            {feature.text}
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      {tier.cta && (
        <Button
          asChild
          variant={featured ? "default" : "outline"}
          className="w-full"
        >
          <Link href={tier.cta.href}>{tier.cta.label}</Link>
        </Button>
      )}
    </div>
  );
}
