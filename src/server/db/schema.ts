/**
 * Drizzle schema barrel.
 *
 * Each `src/modules/<slice>/schema.ts` owns its own tables and is re-exported
 * from here so drizzle-kit sees a single schema surface (M04). The better-auth
 * tables are not slice-owned and live in `./auth-schema`.
 *
 * This file is the one sanctioned deep import of a slice's `schema.ts`: it is
 * the schema *assembly point*, not a consumer.
 */
export * from './auth-schema';
export * from '@/modules/family/schema';
export * from '@/modules/devices/schema';
export * from '@/modules/google/schema';
export * from '@/modules/calendar/schema';
export * from '@/modules/rewards/schema';
export * from '@/modules/routines/schema';
export * from '@/modules/sharing/schema';
export * from '@/modules/notifications/schema';
export * from '@/modules/realtime/schema';
