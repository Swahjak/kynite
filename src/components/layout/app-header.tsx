"use client";

import { useState } from "react";
import { Menu, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandArea } from "./brand-area";
import { NavigationMenu } from "./navigation-menu";
import { UserMenu } from "@/components/auth/user-menu";

interface AppHeaderProps {
  onAddEvent?: () => void;
}

export function AppHeader({ onAddEvent }: AppHeaderProps) {
  const t = useTranslations("Header");
  const { mode } = useInteractionMode();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const user = session?.user;
  const isManageMode = mode === "manage";

  return (
    <>
      <header className="bg-background flex h-16 items-center justify-between border-b px-4">
        {/* Left: Menu trigger + Brand */}
        <div className="flex items-center gap-2">
          {isManageMode && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
          )}

          <button
            onClick={() => !isManageMode && setMenuOpen(true)}
            className={cn(
              "flex items-center",
              !isManageMode && "cursor-pointer"
            )}
            disabled={isManageMode}
          >
            <BrandArea />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {isManageMode && (
            <>
              {/* Add Event Button */}
              <Button onClick={onAddEvent} className="hidden sm:flex">
                <Plus className="size-4" />
                {t("addEvent")}
              </Button>
              <Button
                onClick={onAddEvent}
                size="icon"
                className="sm:hidden"
                aria-label={t("addEvent")}
              >
                <Plus className="size-5" />
              </Button>

              {/* User Menu */}
              {user && (
                <div data-testid="user-avatar">
                  <UserMenu
                    user={{
                      name: user.name || "User",
                      email: user.email || "",
                      image: user.image,
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </header>

      <NavigationMenu open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
