import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";

interface OnboardingLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function OnboardingLayout({
  children,
  params,
}: OnboardingLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
