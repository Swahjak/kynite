"use client";

import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  Grid3X3,
} from "lucide-react";
import type { TCalendarView } from "@/components/calendar/types";

interface CalendarHeaderProps {
  currentDate: Date;
  view: TCalendarView;
  onPreviousClick: () => void;
  onNextClick: () => void;
  onViewChange: (view: TCalendarView) => void;
  onTodayClick: () => void;
}

export function CalendarHeader({
  currentDate,
  view,
  onPreviousClick,
  onNextClick,
  onViewChange,
  onTodayClick,
}: CalendarHeaderProps) {
  const getHeaderText = () => {
    if (view === "day") {
      return currentDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    if (view === "week") {
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    if (view === "month") {
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    return "Schedule";
  };

  return (
    <div
      className="flex items-center justify-between border-b p-6"
      style={{
        backgroundColor: "var(--color-surface-elevated)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="flex items-center gap-4">
        <h1
          className="text-4xl font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {getHeaderText()}
        </h1>
        <Button
          onClick={onTodayClick}
          variant="outline"
          className="touch-target-lg bg-transparent"
          style={{
            borderColor: "var(--color-primary)",
            color: "var(--color-primary)",
          }}
        >
          Today
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button
            onClick={onPreviousClick}
            variant="outline"
            size="icon"
            className="touch-target-lg bg-transparent"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            onClick={onNextClick}
            variant="outline"
            size="icon"
            className="touch-target-lg bg-transparent"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        <div
          className="flex items-center gap-2 rounded-lg border p-1"
          style={{ borderColor: "var(--color-border)" }}
        >
          <Button
            onClick={() => onViewChange("day")}
            variant={view === "day" ? "default" : "ghost"}
            size="sm"
            className="touch-target-lg"
            style={
              view === "day"
                ? {
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                  }
                : {}
            }
          >
            <Calendar className="mr-2 h-5 w-5" />
            Day
          </Button>
          <Button
            onClick={() => onViewChange("week")}
            variant={view === "week" ? "default" : "ghost"}
            size="sm"
            className="touch-target-lg"
            style={
              view === "week"
                ? {
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                  }
                : {}
            }
          >
            <Grid3X3 className="mr-2 h-5 w-5" />
            Week
          </Button>
          <Button
            onClick={() => onViewChange("month")}
            variant={view === "month" ? "default" : "ghost"}
            size="sm"
            className="touch-target-lg"
            style={
              view === "month"
                ? {
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                  }
                : {}
            }
          >
            <Grid3X3 className="mr-2 h-5 w-5" />
            Month
          </Button>
          <Button
            onClick={() => onViewChange("list")}
            variant={view === "list" ? "default" : "ghost"}
            size="sm"
            className="touch-target-lg"
            style={
              view === "list"
                ? {
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                  }
                : {}
            }
          >
            <List className="mr-2 h-5 w-5" />
            List
          </Button>
        </div>
      </div>
    </div>
  );
}
