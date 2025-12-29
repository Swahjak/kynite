"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { ProgressLink } from "@/components/ui/progress-link";
import { cn } from "@/lib/utils";
import { useIsManager } from "@/hooks/use-is-manager";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "./sidebar-context";
import { navItems, helpItem } from "./nav-items";
import Image from "next/image";

export function DesktopSidebar() {
  const t = useTranslations("Menu");
  const tHeader = useTranslations("Header");
  const pathname = usePathname();
  const isManager = useIsManager();
  const locale = useLocale();
  const { isCollapsed, toggle, collapse } = useSidebar();

  const filteredItems = navItems.filter(
    (item) => !item.manageOnly || isManager
  );

  const HelpIcon = helpItem.icon;

  return (
    <aside
      className={cn(
        "bg-sidebar border-sidebar-border hidden flex-col border-r transition-[width] duration-300 ease-in-out md:flex",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header / Brand */}
      <div
        className={cn(
          "flex h-16 items-center border-b px-4",
          isCollapsed ? "justify-center" : "gap-3"
        )}
      >
        <div className="size-10 shrink-0">
          <Image
            src="/images/logo-icon.svg"
            alt="Kynite"
            width={40}
            height={40}
            className="size-10"
            priority
          />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="text-sidebar-foreground font-display truncate text-lg font-bold">
              {tHeader("brand")}
            </span>
            <span className="text-primary truncate text-xs font-medium tracking-wider">
              {tHeader("tagline")}
            </span>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex flex-1 flex-col">
        <ul className="flex-1 space-y-1 p-2">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            const linkContent = (
              <ProgressLink
                href={item.href}
                onClick={() => {
                  if (!isCollapsed) collapse();
                }}
                className={cn(
                  "flex h-12 items-center rounded-md text-sm font-medium transition-colors",
                  isCollapsed ? "justify-center px-2" : "gap-3 px-4",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="size-5 shrink-0" />
                {!isCollapsed && (
                  <span className="truncate">{t(item.labelKey)}</span>
                )}
              </ProgressLink>
            );

            return (
              <li key={item.href}>
                {isCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right">
                      {t(item.labelKey)}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  linkContent
                )}
              </li>
            );
          })}
        </ul>

        {/* Help link at bottom */}
        <div className="border-t p-2">
          {(() => {
            const helpLinkContent = (
              <a
                href={`/help/${locale}`}
                className={cn(
                  "flex h-12 w-full items-center rounded-md text-sm font-medium",
                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isCollapsed ? "justify-center px-2" : "gap-3 px-4"
                )}
              >
                <HelpIcon className="size-5 shrink-0" />
                {!isCollapsed && <span>{t("help")}</span>}
              </a>
            );

            return isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>{helpLinkContent}</TooltipTrigger>
                <TooltipContent side="right">{t("help")}</TooltipContent>
              </Tooltip>
            ) : (
              helpLinkContent
            );
          })()}
        </div>
      </nav>

      {/* Collapse Toggle Button */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={cn(
            "text-sidebar-foreground hover:bg-sidebar-accent h-10 w-full",
            isCollapsed ? "justify-center" : "justify-end"
          )}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="size-5" />
          ) : (
            <ChevronLeft className="size-5" />
          )}
        </Button>
      </div>
    </aside>
  );
}
