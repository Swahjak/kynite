import { Suspense } from "react";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Auth",
  });

  return {
    title: t("login"),
  };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { callbackUrl } = await searchParams;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("Auth");
  const tHeader = await getTranslations("Header");

  return (
    <div className="bg-muted flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/images/logo-icon.svg"
              alt="Kynite"
              width={64}
              height={64}
              priority
            />
            <div className="flex flex-col">
              <span className="font-display text-2xl font-bold text-[#10221a] dark:text-white">
                {tHeader("brand")}
              </span>
              <span className="text-primary text-sm font-medium tracking-wider">
                {tHeader("tagline")}
              </span>
            </div>
          </div>
        </CardHeader>

        <div className="px-6">
          <Separator />
        </div>

        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2 text-center">
            <h1 className="text-lg font-semibold">{t("loginTitle")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("loginDescription")}
            </p>
          </div>

          <Suspense
            fallback={<div className="bg-muted h-12 animate-pulse rounded" />}
          >
            <GoogleSignInButton callbackUrl={callbackUrl} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
