"use client";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Hand, Plus } from "lucide-react";

// TODO: Replace with auto-generated types from payload-types.ts once available
export interface HeroBlockData {
  blockType: "hero";
  badge?: string | null;
  title: string;
  description: string;
  primaryCta?: {
    label: string;
    href: string;
  } | null;
  secondaryCta?: {
    label?: string | null;
    href?: string | null;
  } | null;
  previewLabel?: string | null;
}

interface HeroSectionProps {
  data: HeroBlockData;
}

export function HeroSection({ data }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24">
      <div className="relative z-10 container mx-auto px-4 text-center md:px-6">
        {/* Badge */}
        {data.badge && (
          <div className="bg-card text-muted-foreground mb-6 inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium shadow-sm">
            <span className="bg-primary mr-2 flex h-2 w-2 animate-pulse rounded-full" />
            {data.badge}
          </div>
        )}

        {/* Headline */}
        <h1 className="font-display mx-auto mb-6 max-w-4xl text-4xl leading-[1.1] font-bold tracking-tight md:text-6xl lg:text-7xl">
          {data.title}
        </h1>

        {/* Description */}
        <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg leading-relaxed md:text-xl">
          {data.description}
        </p>

        {/* CTAs */}
        <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {data.primaryCta && (
            <Button asChild size="lg" className="w-full rounded-xl sm:w-auto">
              <Link href={data.primaryCta.href}>{data.primaryCta.label}</Link>
            </Button>
          )}
          {data.secondaryCta?.label && data.secondaryCta?.href && (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full rounded-xl sm:w-auto"
            >
              <Link href={data.secondaryCta.href}>
                {data.secondaryCta.label}
              </Link>
            </Button>
          )}
        </div>

        {/* Dashboard Preview */}
        {data.previewLabel && (
          <div className="bg-card relative mx-auto aspect-[16/9] max-w-5xl overflow-hidden rounded-xl border shadow-2xl md:aspect-[2/1]">
            <DashboardPreview />
            <div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
              <p className="text-foreground flex items-center gap-2 rounded-full border border-white/50 bg-white/90 px-6 py-3 text-sm font-semibold shadow-xl backdrop-blur-md">
                <Icon icon={Hand} className="text-primary" />
                {data.previewLabel}
              </p>
            </div>
          </div>
        )}
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
              <Icon icon={Plus} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
