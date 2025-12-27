"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  LogOut,
  Settings,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Clock,
  Languages,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import authClient from "@/lib/auth-client";
import {
  useUserPreferences,
  useUpdatePreferences,
} from "@/hooks/use-preferences";

interface UserMenuProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const t = useTranslations("UserMenu");
  const { theme, setTheme } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { data: preferences } = useUserPreferences();
  const updatePreferences = useUpdatePreferences();
  const use24HourFormat = preferences?.use24HourFormat ?? true;

  // Sync database locale preference to cookie and redirect if needed
  useEffect(() => {
    const savedLocale = preferences?.locale;
    if (savedLocale && savedLocale !== locale) {
      // Set cookie for future visits
      document.cookie = `NEXT_LOCALE=${savedLocale}; path=/; max-age=31536000; SameSite=Lax`;
      // Redirect to user's preferred locale
      router.replace(pathname, { locale: savedLocale as Locale });
    }
  }, [preferences?.locale, locale, pathname, router]);

  const cycleLanguage = () => {
    const locales: Locale[] = ["nl", "en"];
    const currentIndex = locales.indexOf(locale);
    const nextLocale = locales[(currentIndex + 1) % locales.length];

    // Save preference to database
    updatePreferences.mutate({ locale: nextLocale });

    // Set cookie for middleware (persists across sessions)
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;

    // Navigate to same page in new locale
    router.replace(pathname, { locale: nextLocale });
  };

  const cycleTheme = () => {
    const order = ["system", "light", "dark"] as const;
    const currentIndex = order.indexOf(theme as (typeof order)[number]);
    const nextIndex = (currentIndex + 1) % order.length;
    setTheme(order[nextIndex]);
  };

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative size-10 rounded-full">
          <Avatar className="size-10">
            <AvatarImage src={user.image || undefined} alt={user.name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm leading-none font-medium">{user.name}</p>
            <p className="text-muted-foreground truncate text-xs leading-none">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="mr-2 size-4" />
          {t("settings")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={cycleTheme}>
          <ThemeIcon className="mr-2 size-4" />
          {t("theme.label")}:{" "}
          {theme === "light"
            ? t("theme.light")
            : theme === "dark"
              ? t("theme.dark")
              : t("theme.auto")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={cycleLanguage}>
          <Languages className="mr-2 size-4" />
          {t("language.label")}: {t(`language.${locale}`)}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="cursor-pointer"
        >
          <Clock className="mr-2 size-4" />
          {t("timeFormat.label")}
          <DropdownMenuShortcut>
            <Switch
              checked={use24HourFormat}
              onCheckedChange={(checked) =>
                updatePreferences.mutate({ use24HourFormat: checked })
              }
            />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 size-4" />
          )}
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
