"use client";

import { Menu, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { Button } from "@/components/ui/button";
import { BrandArea } from "./brand-area";
import { ModeToggle } from "./mode-toggle";
import { UserMenu } from "@/components/auth/user-menu";

interface AppHeaderProps {
  onAddEvent?: () => void;
  isManager?: boolean;
  onMenuToggle?: () => void;
}

export function AppHeader({
  onAddEvent,
  isManager = false,
  onMenuToggle,
}: AppHeaderProps) {
  const t = useTranslations("Header");
  const { mode } = useInteractionMode();
  const { data: session } = useSession();

  const user = session?.user;
  const isManageMode = mode === "manage";

  return (
    <header className="bg-background flex h-16 items-center justify-between border-b px-4">
      {/* Left: Menu trigger + Brand */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
        <BrandArea />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Mode Toggle (managers only) */}
        <ModeToggle isManager={isManager} />

        {isManageMode && (
          <>
            {/* Add Event Button */}
            {onAddEvent && (
              <>
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
              </>
            )}

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
  );
}
