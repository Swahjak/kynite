import {
  addDays,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfWeek,
} from "date-fns";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fadeIn,
  staggerContainer,
  transition,
} from "@/components/calendar/animations";
import { useCalendar } from "@/components/calendar/contexts/calendar-context";
import { AddEditEventDialog } from "@/components/calendar/dialogs/add-edit-event-dialog";
import { DroppableArea } from "@/components/calendar/dnd/droppable-area";
import { groupEvents } from "@/components/calendar/helpers";
import type { IEvent } from "@/components/calendar/interfaces";
import { BirthdayBanner } from "@/components/calendar/views/week-and-day-view/birthday-banner";
import { CalendarTimeline } from "@/components/calendar/views/week-and-day-view/calendar-time-line";
import { RenderGroupedEvents } from "@/components/calendar/views/week-and-day-view/render-grouped-events";
import { WeekViewMultiDayEventsRow } from "@/components/calendar/views/week-and-day-view/week-view-multi-day-events-row";

interface IProps {
  singleDayEvents: IEvent[];
  multiDayEvents: IEvent[];
}

export function CalendarWeekView({ singleDayEvents, multiDayEvents }: IProps) {
  const { selectedDate, use24HourFormat } = useCalendar();
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const todayRefs = useRef<(HTMLDivElement | null)[]>([]);

  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Find the index of today in the week, or default to selected date's day
  const todayIndex = weekDays.findIndex((day) => isToday(day));
  const focusDayIndex =
    todayIndex >= 0
      ? todayIndex
      : weekDays.findIndex((day) => isSameDay(day, selectedDate));

  // Scroll to current day on mobile
  useEffect(() => {
    // Guard against invalid index
    if (focusDayIndex < 0 || focusDayIndex >= weekDays.length) return;

    const targetRef = todayRefs.current[focusDayIndex];
    if (targetRef && mobileScrollRef.current) {
      targetRef.scrollIntoView({ behavior: "instant", inline: "center" });
    }
  }, [focusDayIndex, weekDays.length]);

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={fadeIn}
      transition={transition}
      className="h-full"
    >
      {/* Mobile horizontal scroll view */}
      <div className="flex h-full flex-col md:hidden">
        <BirthdayBanner events={multiDayEvents} />
        <WeekViewMultiDayEventsRow
          selectedDate={selectedDate}
          multiDayEvents={multiDayEvents}
        />

        {/* Scrollable day columns */}
        <div
          ref={mobileScrollRef}
          className="flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
          role="region"
          aria-label="Week calendar - swipe to navigate between days"
        >
          <div className="flex h-full" style={{ width: "560%" }}>
            {weekDays.map((day, dayIndex) => {
              const dayEvents = singleDayEvents.filter(
                (event) =>
                  isSameDay(parseISO(event.startDate), day) ||
                  isSameDay(parseISO(event.endDate), day)
              );
              const groupedEvents = groupEvents(dayEvents);
              const isTodayColumn = isToday(day);

              return (
                <div
                  key={dayIndex}
                  ref={(el) => {
                    todayRefs.current[dayIndex] = el;
                  }}
                  className="flex h-full w-[80vw] flex-shrink-0 snap-center flex-col"
                >
                  {/* Day header */}
                  <div
                    className={`border-b px-3 py-2 text-center ${isTodayColumn ? "bg-primary/10" : ""}`}
                  >
                    <span className="text-muted-foreground text-xs font-medium">
                      {format(day, "EEEE")}
                    </span>
                    <span
                      className={`ml-2 text-sm font-semibold ${isTodayColumn ? "text-primary" : ""}`}
                    >
                      {format(day, "d MMM")}
                    </span>
                  </div>

                  {/* Day content with vertical scroll */}
                  <div className="relative flex-1 overflow-y-auto">
                    <div className="relative">
                      {hours.map((hour, hourIndex) => (
                        <div
                          key={hour}
                          className="relative flex"
                          style={{ height: "96px" }}
                        >
                          {/* Hour label */}
                          <div className="w-12 flex-shrink-0 border-r">
                            {hourIndex !== 0 && (
                              <span className="text-muted-foreground absolute -top-2.5 left-1 text-xs">
                                {format(
                                  new Date().setHours(hour, 0, 0, 0),
                                  use24HourFormat ? "HH:00" : "h a"
                                )}
                              </span>
                            )}
                          </div>

                          {/* Hour slot */}
                          <div className="relative flex-1 border-b">
                            <DroppableArea
                              date={day}
                              hour={hour}
                              minute={0}
                              className="absolute inset-x-0 top-0 h-[48px]"
                            >
                              <AddEditEventDialog
                                startDate={day}
                                startTime={{ hour, minute: 0 }}
                              >
                                <div className="hover:bg-secondary absolute inset-0 cursor-pointer transition-colors" />
                              </AddEditEventDialog>
                            </DroppableArea>

                            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-b border-dashed opacity-50" />

                            <DroppableArea
                              date={day}
                              hour={hour}
                              minute={30}
                              className="absolute inset-x-0 bottom-0 h-[48px]"
                            >
                              <AddEditEventDialog
                                startDate={day}
                                startTime={{ hour, minute: 30 }}
                              >
                                <div className="hover:bg-secondary absolute inset-0 cursor-pointer transition-colors" />
                              </AddEditEventDialog>
                            </DroppableArea>
                          </div>
                        </div>
                      ))}

                      {/* Events overlay */}
                      <div className="absolute inset-0 left-12">
                        <RenderGroupedEvents
                          groupedEvents={groupedEvents}
                          day={day}
                        />
                      </div>

                      <CalendarTimeline />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop view (hidden on mobile) */}
      <motion.div
        className="hidden h-full flex-col md:flex"
        variants={staggerContainer}
      >
        <div>
          <BirthdayBanner events={multiDayEvents} />
          <WeekViewMultiDayEventsRow
            selectedDate={selectedDate}
            multiDayEvents={multiDayEvents}
          />

          {/* Week header */}
          <motion.div
            className="relative z-20 flex border-b"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
          >
            {/* Time column header - responsive width */}
            <div className="w-18"></div>
            <div className="grid flex-1 grid-cols-7 border-l">
              {weekDays.map((day, index) => (
                <motion.span
                  key={index}
                  className="text-t-quaternary py-1 text-center text-xs font-medium sm:py-2"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, ...transition }}
                >
                  {/* Mobile: Show only day abbreviation and number */}
                  <span className="block sm:hidden">
                    {format(day, "EEE").charAt(0)}
                    <span className="text-t-secondary block text-xs font-semibold">
                      {format(day, "d")}
                    </span>
                  </span>
                  {/* Desktop: Show full format */}
                  <span className="hidden sm:inline">
                    {format(day, "EE")}{" "}
                    <span className="text-t-secondary ml-1 font-semibold">
                      {format(day, "d")}
                    </span>
                  </span>
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>

        <ScrollArea className="h-full" type="always">
          <div className="flex">
            {/* Hours column */}
            <motion.div className="relative w-18" variants={staggerContainer}>
              {hours.map((hour, index) => (
                <motion.div
                  key={hour}
                  className="relative"
                  style={{ height: "96px" }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02, ...transition }}
                >
                  <div className="absolute -top-3 right-2 flex h-6 items-center">
                    {index !== 0 && (
                      <span className="text-t-quaternary text-xs">
                        {format(
                          new Date().setHours(hour, 0, 0, 0),
                          use24HourFormat ? "HH:00" : "h a"
                        )}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Week grid */}
            <motion.div
              className="relative flex-1 border-l"
              variants={staggerContainer}
            >
              <div className="grid grid-cols-7 divide-x">
                {weekDays.map((day, dayIndex) => {
                  const dayEvents = singleDayEvents.filter(
                    (event) =>
                      isSameDay(parseISO(event.startDate), day) ||
                      isSameDay(parseISO(event.endDate), day)
                  );
                  const groupedEvents = groupEvents(dayEvents);

                  return (
                    <motion.div
                      key={dayIndex}
                      className="relative"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: dayIndex * 0.1, ...transition }}
                    >
                      {hours.map((hour, index) => (
                        <motion.div
                          key={hour}
                          className="relative"
                          style={{ height: "96px" }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.01, ...transition }}
                        >
                          {index !== 0 && (
                            <div className="pointer-events-none absolute inset-x-0 top-0 border-b"></div>
                          )}

                          <DroppableArea
                            date={day}
                            hour={hour}
                            minute={0}
                            className="absolute inset-x-0 top-0 h-[48px]"
                          >
                            <AddEditEventDialog
                              startDate={day}
                              startTime={{ hour, minute: 0 }}
                            >
                              <div className="hover:bg-secondary absolute inset-0 cursor-pointer transition-colors" />
                            </AddEditEventDialog>
                          </DroppableArea>

                          <div className="border-b-tertiary pointer-events-none absolute inset-x-0 top-1/2 border-b border-dashed"></div>

                          <DroppableArea
                            date={day}
                            hour={hour}
                            minute={30}
                            className="absolute inset-x-0 bottom-0 h-[48px]"
                          >
                            <AddEditEventDialog
                              startDate={day}
                              startTime={{ hour, minute: 30 }}
                            >
                              <div className="hover:bg-secondary absolute inset-0 cursor-pointer transition-colors" />
                            </AddEditEventDialog>
                          </DroppableArea>
                        </motion.div>
                      ))}

                      <RenderGroupedEvents
                        groupedEvents={groupedEvents}
                        day={day}
                      />
                    </motion.div>
                  );
                })}
              </div>

              <CalendarTimeline />
            </motion.div>
          </div>
        </ScrollArea>
      </motion.div>
    </motion.div>
  );
}
