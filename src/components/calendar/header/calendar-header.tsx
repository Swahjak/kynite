"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  slideFromLeft,
  slideFromRight,
  transition,
} from "@/components/calendar/animations";
import { useCalendar } from "@/components/calendar/contexts/calendar-context";
import { AddEditEventDialog } from "@/components/calendar/dialogs/add-edit-event-dialog";
import { DateNavigator } from "@/components/calendar/header/date-navigator";
import FilterEvents from "@/components/calendar/header/filter";
import { TodayButton } from "@/components/calendar/header/today-button";
import { UserSelect } from "@/components/calendar/header/user-select";
import { Settings } from "@/components/calendar/settings/settings";
import { LanguageSwitcher } from "@/components/language-switcher";
import Views from "./view-tabs";

interface CalendarHeaderProps {
  addEventButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function CalendarHeader({ addEventButtonRef }: CalendarHeaderProps) {
  const { view, events } = useCalendar();
  const t = useTranslations("Calendar");

  return (
    <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <motion.div
        className="flex items-center gap-3"
        variants={slideFromLeft}
        initial="initial"
        animate="animate"
        transition={transition}
      >
        <TodayButton />
        <DateNavigator view={view} events={events} />
      </motion.div>

      <motion.div
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-1.5"
        variants={slideFromRight}
        initial="initial"
        animate="animate"
        transition={transition}
      >
        <div className="options flex flex-wrap items-center gap-4 md:gap-2">
          <FilterEvents />
          <Views />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-1.5">
          <UserSelect />

          <AddEditEventDialog>
            <Button ref={addEventButtonRef}>
              <Plus className="h-4 w-4" />
              {t("addEvent")}
            </Button>
          </AddEditEventDialog>
        </div>
        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <Settings />
        </div>
      </motion.div>
    </div>
  );
}
