/**
 * Environment validation - runs at startup
 * Ensures required secrets are present in production
 */

const isProduction = process.env.NODE_ENV === "production";

// CRON_SECRET is required in production
if (isProduction && !process.env.CRON_SECRET) {
  throw new Error(
    "CRON_SECRET is required in production. Generate with: openssl rand -base64 32"
  );
}

// Export validated env (add more as needed)
export const env = {
  CRON_SECRET: process.env.CRON_SECRET,
  isProduction,
};
