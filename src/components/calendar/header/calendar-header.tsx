"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsManager } from "@/hooks/use-is-manager";
import { useAccountErrors } from "@/hooks/use-settings";
import Views from "./view-tabs";

export function CalendarHeader() {
  const { view, events } = useCalendar();
  const isManager = useIsManager();
  const { hasErrors } = useAccountErrors();

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

        {isManager && <UserSelect />}

        <div className="flex items-center gap-1.5">
          {hasErrors && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-destructive">
                    <AlertTriangle className="size-5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Some calendars have sync issues.</p>
                  <p className="text-muted-foreground text-xs">
                    Check Settings &rarr; Accounts
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <LanguageSwitcher />
          {isManager && <Settings />}
        </div>
      </motion.div>
    </div>
  );
}
