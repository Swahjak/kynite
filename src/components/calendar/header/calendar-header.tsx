"use client";

import { motion } from "framer-motion";

import {
  slideFromLeft,
  slideFromRight,
  transition,
} from "@/components/calendar/animations";
import { useCalendar } from "@/components/calendar/contexts/calendar-context";
import { DateNavigator } from "@/components/calendar/header/date-navigator";
import FilterEvents from "@/components/calendar/header/filter";
import { TodayButton } from "@/components/calendar/header/today-button";
import { UserSelect } from "@/components/calendar/header/user-select";
import { Settings } from "@/components/calendar/settings/settings";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useInteractionModeSafe } from "@/contexts/interaction-mode-context";
import Views from "./view-tabs";

export function CalendarHeader() {
  const { view, events } = useCalendar();
  const { mode } = useInteractionModeSafe();
  const isManageMode = mode === "manage";

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

        {isManageMode && <UserSelect />}

        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          {isManageMode && <Settings />}
        </div>
      </motion.div>
    </div>
  );
}
