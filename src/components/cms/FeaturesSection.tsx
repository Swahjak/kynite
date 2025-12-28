"use client";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

// TODO: Replace with auto-generated types from payload-types.ts once available
export interface FeaturesBlockData {
  blockType: "features";
  title: string;
  subtitle?: string | null;
  features?: Array<{
    icon: string;
    title: string;
    description: string;
    id?: string | null;
  }> | null;
}

interface FeaturesSectionProps {
  data: FeaturesBlockData;
}

// Color classes for rotating through feature cards
const colorClasses = [
  {
    icon: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
    border: "hover:border-primary/50",
  },
  {
    icon: "bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white dark:bg-purple-900/50 dark:text-purple-400",
    border: "hover:border-purple-200 dark:hover:border-purple-800",
  },
  {
    icon: "bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white dark:bg-orange-900/50 dark:text-orange-400",
    border: "hover:border-orange-200 dark:hover:border-orange-800",
  },
  {
    icon: "bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-900/50 dark:text-blue-400",
    border: "hover:border-blue-200 dark:hover:border-blue-800",
  },
  {
    icon: "bg-green-100 text-green-600 group-hover:bg-green-600 group-hover:text-white dark:bg-green-900/50 dark:text-green-400",
    border: "hover:border-green-200 dark:hover:border-green-800",
  },
  {
    icon: "bg-pink-100 text-pink-600 group-hover:bg-pink-600 group-hover:text-white dark:bg-pink-900/50 dark:text-pink-400",
    border: "hover:border-pink-200 dark:hover:border-pink-800",
  },
] as const;

/**
 * Resolves a Lucide icon name to its component.
 * Falls back to a circle icon if not found.
 */
function getIconComponent(iconName: string): LucideIcon {
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  // Try the exact name first, then PascalCase conversion
  if (icons[iconName]) {
    return icons[iconName];
  }
  // Try to convert kebab-case or lowercase to PascalCase
  const pascalCase = iconName
    .split(/[-_\s]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
  if (icons[pascalCase]) {
    return icons[pascalCase];
  }
  // Fallback to Circle icon
  return LucideIcons.Circle;
}

export function FeaturesSection({ data }: FeaturesSectionProps) {
  return (
    <section id="features" className="bg-card border-y py-16">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {data.title}
          </h2>
          {data.subtitle && (
            <p className="text-muted-foreground mt-4 text-lg">
              {data.subtitle}
            </p>
          )}
        </div>

        {/* Feature Cards */}
        {data.features && data.features.length > 0 && (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {data.features.map((feature, index) => {
              const colorIndex = index % colorClasses.length;
              const colors = colorClasses[colorIndex];
              const IconComponent = getIconComponent(feature.icon);

              return (
                <div
                  key={feature.id ?? index}
                  className={cn(
                    "group bg-background relative rounded-2xl border p-8 transition-all duration-300 hover:shadow-lg",
                    colors.border
                  )}
                >
                  <div
                    className={cn(
                      "mb-6 inline-flex size-14 items-center justify-center rounded-xl shadow-sm transition-colors",
                      colors.icon
                    )}
                  >
                    <Icon icon={IconComponent} size="lg" />
                  </div>
                  <h3 className="font-display mb-3 text-xl font-bold">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
