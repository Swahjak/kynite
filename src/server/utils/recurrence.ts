import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isBefore,
  isEqual,
  min,
  getDaysInMonth,
  setDate,
} from "date-fns";
import type {
  RecurrenceFrequency,
  RecurrenceEndType,
} from "@/lib/validations/recurrence";

const MAX_OCCURRENCES = 365;

interface GenerateOccurrencesOptions {
  startDate: Date;
  frequency: RecurrenceFrequency;
  interval: number;
  endType: RecurrenceEndType;
  endCount?: number;
  endDate?: Date;
  untilDate: Date; // generation horizon
}

/**
 * Calculate the next occurrence date based on frequency and interval
 */
export function calculateNextOccurrence(
  current: Date,
  frequency: RecurrenceFrequency,
  interval: number
): Date {
  switch (frequency) {
    case "daily":
      return addDays(current, interval);
    case "weekly":
      return addWeeks(current, interval);
    case "monthly":
      return addMonthsSafe(current, interval);
    case "yearly":
      return addYearsSafe(current, interval);
  }
}

/**
 * Add months while handling month-end edge cases
 * e.g., Jan 31 + 1 month = Feb 28 (not Mar 3)
 */
function addMonthsSafe(date: Date, months: number): Date {
  const originalDay = date.getDate();
  const result = addMonths(date, months);
  const maxDay = getDaysInMonth(result);

  if (originalDay > maxDay) {
    return setDate(result, maxDay);
  }
  return result;
}

/**
 * Add years while handling leap year edge cases
 * e.g., Feb 29, 2024 + 1 year = Feb 28, 2025
 */
function addYearsSafe(date: Date, years: number): Date {
  const originalDay = date.getDate();
  const result = addYears(date, years);
  const maxDay = getDaysInMonth(result);

  if (originalDay > maxDay) {
    return setDate(result, maxDay);
  }
  return result;
}

/**
 * Generate all occurrence dates for a recurring event pattern
 */
export function generateOccurrenceDates(
  options: GenerateOccurrencesOptions
): Date[] {
  const {
    startDate,
    frequency,
    interval,
    endType,
    endCount,
    endDate,
    untilDate,
  } = options;

  const dates: Date[] = [];
  let current = new Date(startDate);
  let count = 0;

  // Determine effective end date
  const effectiveEndDate =
    endType === "date" && endDate ? min([endDate, untilDate]) : untilDate;
  const effectiveMaxCount =
    endType === "count" && endCount ? endCount : MAX_OCCURRENCES;

  while (
    count < effectiveMaxCount &&
    count < MAX_OCCURRENCES &&
    (isBefore(current, effectiveEndDate) || isEqual(current, effectiveEndDate))
  ) {
    dates.push(new Date(current));
    count++;
    current = calculateNextOccurrence(current, frequency, interval);
  }

  return dates;
}

/**
 * Calculate the event duration in milliseconds
 */
export function getEventDuration(startTime: Date, endTime: Date): number {
  return endTime.getTime() - startTime.getTime();
}

/**
 * Apply a duration to an occurrence date to get the end time
 */
export function applyDuration(occurrenceDate: Date, durationMs: number): Date {
  return new Date(occurrenceDate.getTime() + durationMs);
}
