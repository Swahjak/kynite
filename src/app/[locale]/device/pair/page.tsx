import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { DevicePairForm } from "@/components/device/device-pair-form";

// Device pairing is dynamic - no static generation needed
export const dynamic = "force-dynamic";

interface DevicePairPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DevicePairPage({ params }: DevicePairPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <DevicePairForm locale={locale} />
    </div>
  );
}
