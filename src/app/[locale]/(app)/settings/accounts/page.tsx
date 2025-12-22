import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { LinkedAccountsSection } from "@/components/settings/linked-accounts-section";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AccountsSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Linked Accounts</h1>
          <p className="text-muted-foreground">
            Manage your connected Google accounts for calendar access
          </p>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="mb-4 text-lg font-semibold">Google Accounts</h2>
          <LinkedAccountsSection />
        </div>
      </div>
    </div>
  );
}
