"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/ui/icon";
import { Share2, Code } from "lucide-react";

export function HomepageFooter() {
  const t = useTranslations("HomePage.footer");
  const common = useTranslations("Common");

  return (
    <footer className="bg-card border-t py-12">
      <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 md:flex-row md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo-icon.svg"
            alt={common("appName")}
            width={24}
            height={24}
            className="size-6"
          />
          <span className="font-display font-bold">{common("appName")}</span>
        </Link>

        {/* Copyright */}
        <p className="text-muted-foreground text-sm">{t("copyright")}</p>

        {/* Social Links */}
        <div className="flex gap-6">
          <a
            href="#"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Twitter"
          >
            <Icon icon={Share2} size="md" />
          </a>
          <a
            href="#"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="GitHub"
          >
            <Icon icon={Code} size="md" />
          </a>
        </div>
      </div>
    </footer>
  );
}
