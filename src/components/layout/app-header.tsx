"use client";

import { Menu } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { Button } from "@/components/ui/button";
import { BrandArea } from "./brand-area";
import { CurrentTime } from "./current-time";
import { ModeToggle } from "./mode-toggle";
import { UserMenu } from "@/components/auth/user-menu";

interface AppHeaderProps {
  isManager?: boolean;
  onMenuToggle?: () => void;
}

export function AppHeader({ isManager = false, onMenuToggle }: AppHeaderProps) {
  const { mode } = useInteractionMode();
  const { data: session } = useSession();

  const user = session?.user;
  const isManageMode = mode === "manage";

  return (
    <header className="bg-background flex h-16 items-center justify-between border-b px-4">
      {/* Left: Menu trigger + Brand */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
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

      {/* Center: Current Time (hidden on mobile) */}
      <div className="hidden flex-1 justify-center sm:flex">
        <CurrentTime />
      </div>

      {/* Right: Actions */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {/* Mode Toggle (managers only) */}
        <ModeToggle isManager={isManager} />

        {/* User Menu */}
        {isManageMode && user && (
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
      </div>
    </header>
  );
}
