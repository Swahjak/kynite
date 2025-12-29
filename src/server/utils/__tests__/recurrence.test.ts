import { describe, it, expect } from "vitest";
import {
  generateOccurrenceDates,
  calculateNextOccurrence,
} from "../recurrence";

describe("generateOccurrenceDates", () => {
  const baseDate = new Date("2025-01-01T10:00:00");

  describe("daily frequency", () => {
    it("generates daily occurrences with interval 1", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "daily",
        interval: 1,
        endType: "count",
        endCount: 5,
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(5);
      expect(dates[0]).toEqual(new Date("2025-01-01T10:00:00"));
      expect(dates[1]).toEqual(new Date("2025-01-02T10:00:00"));
      expect(dates[4]).toEqual(new Date("2025-01-05T10:00:00"));
    });

    it("generates daily occurrences with interval 2", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "daily",
        interval: 2,
        endType: "count",
        endCount: 3,
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(3);
      expect(dates[0]).toEqual(new Date("2025-01-01T10:00:00"));
      expect(dates[1]).toEqual(new Date("2025-01-03T10:00:00"));
      expect(dates[2]).toEqual(new Date("2025-01-05T10:00:00"));
    });
  });

  describe("weekly frequency", () => {
    it("generates weekly occurrences", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "weekly",
        interval: 1,
        endType: "count",
        endCount: 4,
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(4);
      expect(dates[0]).toEqual(new Date("2025-01-01T10:00:00"));
      expect(dates[1]).toEqual(new Date("2025-01-08T10:00:00"));
      expect(dates[2]).toEqual(new Date("2025-01-15T10:00:00"));
      expect(dates[3]).toEqual(new Date("2025-01-22T10:00:00"));
    });

    it("generates bi-weekly occurrences", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "weekly",
        interval: 2,
        endType: "count",
        endCount: 3,
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(3);
      expect(dates[1]).toEqual(new Date("2025-01-15T10:00:00"));
    });
  });

  describe("monthly frequency", () => {
    it("generates monthly occurrences", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "monthly",
        interval: 1,
        endType: "count",
        endCount: 3,
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(3);
      expect(dates[0]).toEqual(new Date("2025-01-01T10:00:00"));
      expect(dates[1]).toEqual(new Date("2025-02-01T10:00:00"));
      expect(dates[2]).toEqual(new Date("2025-03-01T10:00:00"));
    });

    it("handles month-end edge case (Jan 31 -> Feb 28)", () => {
      const jan31 = new Date("2025-01-31T10:00:00");
      const dates = generateOccurrenceDates({
        startDate: jan31,
        frequency: "monthly",
        interval: 1,
        endType: "count",
        endCount: 2,
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(2);
      expect(dates[0]).toEqual(new Date("2025-01-31T10:00:00"));
      // Feb doesn't have 31 days, should clamp to Feb 28
      expect(dates[1]).toEqual(new Date("2025-02-28T10:00:00"));
    });
  });

  describe("yearly frequency", () => {
    it("generates yearly occurrences", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "yearly",
        interval: 1,
        endType: "count",
        endCount: 3,
        untilDate: new Date("2030-12-31"),
      });

      expect(dates).toHaveLength(3);
      expect(dates[0]).toEqual(new Date("2025-01-01T10:00:00"));
      expect(dates[1]).toEqual(new Date("2026-01-01T10:00:00"));
      expect(dates[2]).toEqual(new Date("2027-01-01T10:00:00"));
    });

    it("handles leap year (Feb 29)", () => {
      const feb29 = new Date("2024-02-29T10:00:00");
      const dates = generateOccurrenceDates({
        startDate: feb29,
        frequency: "yearly",
        interval: 1,
        endType: "count",
        endCount: 2,
        untilDate: new Date("2030-12-31"),
      });

      expect(dates).toHaveLength(2);
      expect(dates[0]).toEqual(new Date("2024-02-29T10:00:00"));
      // 2025 is not a leap year, should clamp to Feb 28
      expect(dates[1]).toEqual(new Date("2025-02-28T10:00:00"));
    });
  });

  describe("end conditions", () => {
    it("stops at endDate", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "daily",
        interval: 1,
        endType: "date",
        endDate: new Date("2025-01-03T23:59:59"), // End of day to include the 10:00 occurrence
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(3);
      expect(dates[2]).toEqual(new Date("2025-01-03T10:00:00"));
    });

    it("stops at untilDate horizon", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "daily",
        interval: 1,
        endType: "never",
        untilDate: new Date("2025-01-05T23:59:59"), // End of day to include the 10:00 occurrence
      });

      expect(dates).toHaveLength(5);
    });

    it("respects max occurrences cap (365)", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "daily",
        interval: 1,
        endType: "never",
        untilDate: new Date("2027-01-01"), // 2 years out
      });

      expect(dates.length).toBeLessThanOrEqual(365);
    });
  });
});

describe("calculateNextOccurrence", () => {
  it("calculates next daily occurrence", () => {
    const current = new Date("2025-01-01T10:00:00");
    const next = calculateNextOccurrence(current, "daily", 1);
    expect(next).toEqual(new Date("2025-01-02T10:00:00"));
  });

  it("calculates next weekly occurrence with interval", () => {
    const current = new Date("2025-01-01T10:00:00");
    const next = calculateNextOccurrence(current, "weekly", 2);
    expect(next).toEqual(new Date("2025-01-15T10:00:00"));
  });
});
