"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HomepageHeader() {
  const t = useTranslations("HomePage.nav");
  const common = useTranslations("Common");

  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo-icon.svg"
            alt={common("appName")}
            width={32}
            height={32}
            className="size-8"
          />
          <span className="font-display text-lg font-bold tracking-tight">
            {common("appName")}
          </span>
        </Link>

        {/* Navigation */}
        <nav className="text-muted-foreground hidden items-center gap-8 text-sm font-medium md:flex">
          <a
            href="#features"
            className="hover:text-foreground transition-colors"
          >
            {t("features")}
          </a>
          <a
            href="#how-it-works"
            className="hover:text-foreground transition-colors"
          >
            {t("howItWorks")}
          </a>
          <a
            href="#pricing"
            className="hover:text-foreground transition-colors"
          >
            {t("plans")}
          </a>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground hidden text-sm font-medium transition-colors md:inline-flex"
          >
            {t("signIn")}
          </Link>
          <Button asChild>
            <Link href="/login">{t("signUp")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
