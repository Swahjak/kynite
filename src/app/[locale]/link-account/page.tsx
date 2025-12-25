import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import LinkAccountClient from "./link-account-client";
import { Loader2 } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
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
