import { db } from "@/server/db";
import {
  events,
  eventParticipants,
  recurringEventPatterns,
} from "@/server/schema";
import { eq, lte } from "drizzle-orm";
import { addYears, addDays } from "date-fns";
import { createId } from "@paralleldrive/cuid2";
import {
  generateOccurrenceDates,
  getEventDuration,
  applyDuration,
} from "@/server/utils/recurrence";

const EXTENSION_THRESHOLD_DAYS = 30;
const EXTENSION_HORIZON_YEARS = 1;

export interface ExtendRecurringEventsResult {
  patternsExtended: number;
  eventsCreated: number;
}

/**
 * Extend recurring events that are approaching their generation horizon.
 *
 * This job finds all recurring event patterns where generatedUntil is within
 * 30 days, and generates new occurrences extending to 1 year from now.
 */
export async function extendRecurringEvents(): Promise<ExtendRecurringEventsResult> {
  const thresholdDate = addDays(new Date(), EXTENSION_THRESHOLD_DAYS);

  // Find patterns that need extension (where generatedUntil is within threshold)
  const patternsToExtend = await db
    .select()
    .from(recurringEventPatterns)
    .where(lte(recurringEventPatterns.generatedUntil, thresholdDate));

  let eventsCreated = 0;

  for (const pattern of patternsToExtend) {
    // Get the first event as template (for title, description, etc.)
    const templateEvents = await db
      .select()
      .from(events)
      .where(eq(events.recurringPatternId, pattern.id))
      .orderBy(events.startTime)
      .limit(1);

    if (templateEvents.length === 0) {
      // No events in this series, skip
      continue;
    }

    const templateEvent = templateEvents[0];

    // Get participants from template
    const templateParticipants = await db
      .select()
      .from(eventParticipants)
      .where(eq(eventParticipants.eventId, templateEvent.id));

    // Calculate new horizon (1 year from now)
    const newHorizon = addYears(new Date(), EXTENSION_HORIZON_YEARS);

    // Generate new occurrences from where we left off
    const newOccurrences = generateOccurrenceDates({
      startDate: addDays(pattern.generatedUntil, 1), // Start from day after last generated
      frequency: pattern.frequency as "daily" | "weekly" | "monthly" | "yearly",
      interval: pattern.interval,
      endType: pattern.endType as "never" | "count" | "date",
      endCount: pattern.endCount ?? undefined,
      endDate: pattern.endDate ?? undefined,
      untilDate: newHorizon,
    });

    if (newOccurrences.length === 0) {
      // Update generatedUntil even if no new occurrences (pattern may have ended)
      await db
        .update(recurringEventPatterns)
        .set({ generatedUntil: newHorizon })
        .where(eq(recurringEventPatterns.id, pattern.id));
      continue;
    }

    // Calculate duration from template
    const durationMs = getEventDuration(
      templateEvent.startTime,
      templateEvent.endTime
    );

    // Create new event occurrences in a transaction
    await db.transaction(async (tx) => {
      for (const occurrenceDate of newOccurrences) {
        const eventId = createId();
        const endTime = applyDuration(occurrenceDate, durationMs);

        await tx.insert(events).values({
          id: eventId,
          familyId: templateEvent.familyId,
          title: templateEvent.title,
          description: templateEvent.description,
          location: templateEvent.location,
          startTime: occurrenceDate,
          endTime,
          allDay: templateEvent.allDay,
          color: templateEvent.color,
          category: templateEvent.category,
          eventType: templateEvent.eventType,
          recurringPatternId: pattern.id,
          occurrenceDate,
          syncStatus: "synced",
          localUpdatedAt: new Date(),
        });

        // Copy participants to new occurrence
        for (const participant of templateParticipants) {
          await tx.insert(eventParticipants).values({
            id: createId(),
            eventId,
            familyMemberId: participant.familyMemberId,
            isOwner: participant.isOwner,
          });
        }

        eventsCreated++;
      }

      // Update pattern's generatedUntil
      await tx
        .update(recurringEventPatterns)
        .set({ generatedUntil: newHorizon })
        .where(eq(recurringEventPatterns.id, pattern.id));
    });
  }

  return {
    patternsExtended: patternsToExtend.length,
    eventsCreated,
  };
}
