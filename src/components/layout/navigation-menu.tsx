"use client";

import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Settings,
  HelpCircle,
  Star,
  Gift,
  Timer,
} from "lucide-react";
import { useTranslations } from "next-intl";
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

interface NavigationMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey:
    | "dashboard"
    | "calendar"
    | "chores"
    | "timers"
    | "rewardChart"
    | "rewards"
    | "settings"
    | "help";
  manageOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" },
  { href: "/calendar/today", icon: Calendar, labelKey: "calendar" },
  { href: "/chores", icon: CheckSquare, labelKey: "chores", manageOnly: true },
  { href: "/timers", icon: Timer, labelKey: "timers", manageOnly: true },
  { href: "/reward-chart", icon: Star, labelKey: "rewardChart" },
  { href: "/rewards", icon: Gift, labelKey: "rewards" },
  { href: "/settings", icon: Settings, labelKey: "settings", manageOnly: true },
];

export function NavigationMenu({ open, onOpenChange }: NavigationMenuProps) {
  const t = useTranslations("Menu");
  const pathname = usePathname();
  const isManager = useIsManager();

  const filteredItems = navItems.filter(
    (item) => !item.manageOnly || isManager
  );

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
            <ProgressLink
              href="/help"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-12 w-full items-center gap-3 rounded-md px-4 text-sm font-medium"
            >
              <HelpCircle className="size-5" />
              {t("help")}
            </ProgressLink>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
