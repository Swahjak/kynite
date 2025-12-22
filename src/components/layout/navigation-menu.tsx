"use client";

import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Settings,
  HelpCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
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
  labelKey: "dashboard" | "calendar" | "chores" | "settings" | "help";
  manageOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" },
  { href: "/calendar", icon: Calendar, labelKey: "calendar" },
  { href: "/chores", icon: CheckSquare, labelKey: "chores", manageOnly: true },
  { href: "/settings", icon: Settings, labelKey: "settings", manageOnly: true },
];

export function NavigationMenu({ open, onOpenChange }: NavigationMenuProps) {
  const t = useTranslations("Menu");
  const pathname = usePathname();
  const { mode } = useInteractionMode();

  const filteredItems = navItems.filter(
    (item) => !item.manageOnly || mode === "manage"
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
                  <Link
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
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="border-t p-2">
            <button
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-12 w-full items-center gap-3 rounded-md px-4 text-sm font-medium"
              onClick={() => {
                // TODO: Open help modal
                onOpenChange(false);
              }}
            >
              <HelpCircle className="size-5" />
              {t("help")}
            </button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
