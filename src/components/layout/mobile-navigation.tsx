"use client";

import { useTranslations, useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { ProgressLink } from "@/components/ui/progress-link";
import { cn } from "@/lib/utils";
import { useIsManager } from "@/hooks/use-is-manager";
import { BrandArea } from "./brand-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { navItems, helpItem } from "./nav-items";

interface MobileNavigationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNavigation({
  open,
  onOpenChange,
}: MobileNavigationProps) {
  const t = useTranslations("Menu");
  const pathname = usePathname();
  const isManager = useIsManager();
  const locale = useLocale();

  const filteredItems = navItems.filter(
    (item) => !item.manageOnly || isManager
  );

  const HelpIcon = helpItem.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <BrandArea />
        </SheetHeader>

        <nav className="flex flex-1 flex-col">
          <ul className="flex-1 space-y-1 p-2">
            {filteredItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <ProgressLink
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex h-12 items-center gap-3 rounded-md px-4 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="size-5" />
                    {t(item.labelKey)}
                  </ProgressLink>
                </li>
              );
            })}
          </ul>

          <div className="border-t p-2">
            <a
              href={`/help/${locale}`}
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-12 w-full items-center gap-3 rounded-md px-4 text-sm font-medium"
            >
              <HelpIcon className="size-5" />
              {t("help")}
            </a>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
