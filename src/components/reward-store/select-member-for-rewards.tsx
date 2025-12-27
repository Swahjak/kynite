"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PersonSelectorCards } from "@/components/shared/person-selector-cards";

interface ChildInfo {
  id: string;
  name: string;
  avatarColor: string | null;
  avatarSvg?: string | null;
  avatarUrl?: string | null;
  balance: number;
}

interface SelectMemberForRewardsProps {
  children: ChildInfo[];
}

export function SelectMemberForRewards({
  children,
}: SelectMemberForRewardsProps) {
  const t = useTranslations("rewardStore");
  const router = useRouter();

  const handleSelectChild = (childId: string | "all") => {
    if (childId === "all") return;
    router.push(`?child=${childId}`);
  };

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-lg font-medium text-slate-600">
              {t("selectMemberTitle")}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t("selectMemberDescription")}
            </p>
          </div>
          <PersonSelectorCards
            people={children}
            selectedId="all"
            onSelect={handleSelectChild}
          />
        </div>
      </div>
    </div>
  );
}
