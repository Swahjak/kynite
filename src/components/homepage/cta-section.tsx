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
