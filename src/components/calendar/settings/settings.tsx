import { SettingsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useCalendar } from "@/components/calendar/contexts/calendar-context";
import type { TCalendarView } from "@/components/calendar/types";
import { useDragDrop } from "@/components/calendar/contexts/dnd-context";

export function Settings() {
  const {
    badgeVariant,
    setBadgeVariant,
    use24HourFormat,
    toggleTimeFormat,
    view,
    setView,
    agendaModeGroupBy,
    setAgendaModeGroupBy,
  } = useCalendar();
  const { showConfirmation, setShowConfirmation } = useDragDrop();
  const { theme, setTheme } = useTheme();
  const t = useTranslations("Settings");

  const isDarkMode = theme === "dark";
  const isDotVariant = badgeVariant === "dot";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <SettingsIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            {t("darkMode")}
            <DropdownMenuShortcut>
              <Switch
                checked={isDarkMode}
                onCheckedChange={(checked) =>
                  setTheme(checked ? "dark" : "light")
                }
              />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            {t("confirmationDialog")}
            <DropdownMenuShortcut>
              <Switch
                checked={showConfirmation}
                onCheckedChange={(checked) => setShowConfirmation(checked)}
              />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            {t("dotBadge")}
            <DropdownMenuShortcut>
              <Switch
                checked={isDotVariant}
                onCheckedChange={(checked) =>
                  setBadgeVariant(checked ? "dot" : "colored")
                }
              />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            {t("use24Hour")}
            <DropdownMenuShortcut>
              <Switch
                checked={use24HourFormat}
                onCheckedChange={toggleTimeFormat}
              />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("agendaGroupBy")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={agendaModeGroupBy}
            onValueChange={(value) =>
              setAgendaModeGroupBy(value as "date" | "color")
            }
          >
            <DropdownMenuRadioItem value="date">
              {t("groupByDate")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="color">
              {t("groupByColor")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
