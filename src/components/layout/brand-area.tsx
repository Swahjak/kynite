import Image from "next/image";
import { useTranslations } from "next-intl";

export function BrandArea() {
  const t = useTranslations("Header");

  return (
    <div className="flex items-center gap-3">
      <div data-testid="brand-icon" className="size-12">
        <Image
          src="/images/logo-icon.svg"
          alt="Kynite"
          width={48}
          height={48}
          className="size-12"
          priority
        />
      </div>
      <div className="flex flex-col">
        <span className="font-display text-xl font-bold text-[#10221a]">
          {t("brand")}
        </span>
        <span className="text-primary text-xs font-medium tracking-wider">
          {t("tagline")}
        </span>
      </div>
    </div>
  );
}
