"use client";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

// TODO: Replace with auto-generated types from payload-types.ts once available
export interface CtaBlockData {
  blockType: "cta";
  title: string;
  description?: string | null;
  button?: {
    label: string;
    href: string;
    variant?: "default" | "secondary" | "outline" | null;
  } | null;
}

interface CtaSectionProps {
  data: CtaBlockData;
}

export function CtaSection({ data }: CtaSectionProps) {
  return (
    <section className="bg-foreground text-background relative overflow-hidden py-20">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)]" />

      <div className="relative z-10 container mx-auto px-4 text-center">
        <h2 className="font-display mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
          {data.title}
        </h2>
        {data.description && (
          <p className="text-background/70 mx-auto mb-8 max-w-2xl text-lg">
            {data.description}
          </p>
        )}
        {data.button && (
          <Button
            asChild
            size="lg"
            variant={data.button.variant ?? "default"}
            className="ring-offset-foreground focus-visible:ring-offset-foreground rounded-xl"
          >
            <Link href={data.button.href}>{data.button.label}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
