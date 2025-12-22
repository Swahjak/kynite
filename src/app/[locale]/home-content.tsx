"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function HomeContent() {
  const t = useTranslations("HomePage");

  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("subtitle")}</p>
      <Link
        href="/calendar"
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-3"
      >
        {t("openCalendar")}
      </Link>
    </main>
  );
}
