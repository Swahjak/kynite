"use client";

import { useTranslations } from "next-intl";
import { Users, Link2 } from "lucide-react";
import type { Family } from "@/server/schema";
import type { FamilyMemberWithUser, FamilyMemberRole } from "@/types/family";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FamilySettingsClient } from "@/components/family/family-settings-client";
import { LinkedAccountsSection } from "@/components/settings/linked-accounts-section";

interface SettingsPageClientProps {
  family: Family & { currentUserRole: FamilyMemberRole };
  members: FamilyMemberWithUser[];
  currentUserId: string;
  isManager: boolean;
  locale: string;
}

export function SettingsPageClient({
  family,
  members,
  currentUserId,
  isManager,
  locale,
}: SettingsPageClientProps) {
  const t = useTranslations("SettingsPage");

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>

        <Tabs defaultValue="family" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="family" className="gap-2">
              <Users className="size-4" />
              {t("tabs.family")}
            </TabsTrigger>
            <TabsTrigger value="accounts" className="gap-2">
              <Link2 className="size-4" />
              {t("tabs.accounts")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="family" className="mt-6">
            <FamilySettingsClient
              family={family}
              members={members}
              currentUserId={currentUserId}
              isManager={isManager}
              locale={locale}
            />
          </TabsContent>

          <TabsContent value="accounts" className="mt-6">
            <div className="rounded-lg border p-6">
              <h2 className="mb-2 text-lg font-semibold">
                {t("accounts.title")}
              </h2>
              <p className="text-muted-foreground mb-4 text-sm">
                {t("accounts.description")}
              </p>
              <LinkedAccountsSection familyId={family.id} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
