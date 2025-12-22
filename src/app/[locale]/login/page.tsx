import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

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

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto w-full max-w-sm space-y-6 p-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">{t("loginTitle")}</h1>
          <p className="text-muted-foreground">{t("loginDescription")}</p>
        </div>

        <Suspense
          fallback={<div className="bg-muted h-12 animate-pulse rounded" />}
        >
          <GoogleSignInButton callbackUrl={callbackUrl} />
        </Suspense>
      </div>
    </div>
  );
}
