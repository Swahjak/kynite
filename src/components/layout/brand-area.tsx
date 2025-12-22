import { Home } from "lucide-react";
import { useTranslations } from "next-intl";

export function BrandArea() {
  const t = useTranslations("Header");

  return (
    <div className="flex items-center gap-3">
      <div
        data-testid="brand-icon"
        className="bg-primary flex size-12 items-center justify-center rounded-full"
      >
        <Home className="text-primary-foreground size-6" />
      </div>
      <div className="flex flex-col">
        <span className="font-display text-xl font-bold">{t("brand")}</span>
        <span className="text-primary text-xs font-medium tracking-wider uppercase">
          {t("tagline")}
        </span>
      </div>
    </div>
  );
}
