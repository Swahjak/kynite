import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import LinkAccountClient from "./link-account-client";
import { Loader2 } from "lucide-react";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "LinkAccount" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

function LinkAccountLoading() {
  return (
    <div className="container flex min-h-screen items-center justify-center">
      <Loader2 className="text-primary h-8 w-8 animate-spin" />
    </div>
  );
}

export default function LinkAccountPage() {
  return (
    <Suspense fallback={<LinkAccountLoading />}>
      <LinkAccountClient />
    </Suspense>
  );
}
