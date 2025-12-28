import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export default async function NotFound() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations({ locale, namespace: "NotFound" });

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-2xl font-semibold">{t("title")}</h2>
      <p className="text-muted-foreground max-w-md">{t("description")}</p>
      <Button asChild>
        <Link href="/dashboard">{t("goHome")}</Link>
      </Button>
    </div>
  );
}
