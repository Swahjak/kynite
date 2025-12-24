/**
 * One-time script to set up push notification channels for existing calendars
 * Run with: pnpm tsx scripts/setup-push-channels.ts
 */

import { db } from "../src/server/db";
import { googleCalendars } from "../src/server/schema";
import { eq } from "drizzle-orm";
import { createWatchChannel } from "../src/server/services/google-channel-service";

async function main() {
  console.log(
    "Setting up push notification channels for existing calendars...\n"
  );

  const calendars = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.syncEnabled, true));

  console.log(`Found ${calendars.length} enabled calendars\n`);

  let success = 0;
  let failed = 0;

  for (const calendar of calendars) {
    process.stdout.write(`Setting up channel for ${calendar.name}... `);

    const result = await createWatchChannel(calendar.id);

    if (result.success) {
      console.log("OK");
      success++;
    } else {
      console.log(`FAILED: ${result.error}`);
      failed++;
    }
  }

  console.log(`\nComplete: ${success} success, ${failed} failed`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
