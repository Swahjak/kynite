"use client";

import { Menu } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useIsManager } from "@/hooks/use-is-manager";
import { Button } from "@/components/ui/button";
import { HelpLink } from "@/components/ui/help-link";
import { BrandArea } from "./brand-area";
import { CurrentTime } from "./current-time";
import { UserMenu } from "@/components/auth/user-menu";

interface AppHeaderProps {
  onMenuToggle?: () => void;
}

export function AppHeader({ onMenuToggle }: AppHeaderProps) {
  const isManager = useIsManager();
  const { data: session } = useSession();

  const user = session?.user;

  return (
    <header className="bg-background flex h-16 items-center justify-between border-b px-4">
      {/* Left: Menu trigger (mobile only) + Brand */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* Mobile only: hamburger menu */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          aria-label="Open menu"
          className="md:hidden"
        >
          <Menu className="size-5" />
        </Button>
        {/* Mobile only: show brand in header */}
        <div className="md:hidden">
          <BrandArea />
        </div>
      </div>

      {/* Center: Current Time (hidden on mobile) */}
      <div className="hidden flex-1 justify-center sm:flex">
        <CurrentTime />
      </div>

      {/* Right: Help Link + User Menu (managers only) */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <HelpLink />
        {isManager && user && (
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
