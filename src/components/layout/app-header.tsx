"use client";

import { useState } from "react";
import { Menu, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandArea } from "./brand-area";
import { NavigationMenu } from "./navigation-menu";

interface AppHeaderProps {
  onAddEvent?: () => void;
}

export function AppHeader({ onAddEvent }: AppHeaderProps) {
  const t = useTranslations("Header");
  const { mode } = useInteractionMode();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const user = session?.user;
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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

              {/* User Avatar */}
              {user && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  data-testid="user-avatar"
                >
                  <Avatar className="size-9">
                    <AvatarImage
                      src={user.image || undefined}
                      alt={user.name || "User"}
                    />
                    <AvatarFallback>{initials || "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      <NavigationMenu open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
