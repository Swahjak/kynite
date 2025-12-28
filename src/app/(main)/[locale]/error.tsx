"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Error");

  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-2xl font-semibold">{t("title")}</h2>
      <p className="text-muted-foreground max-w-md">{t("description")}</p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="default">
          {t("tryAgain")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">{t("goHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
