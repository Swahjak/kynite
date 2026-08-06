/**
 * Public surface of the calendar slice (docs/architecture.md §2).
 * The views, CRUD and recurrence expansion land in M06; M05 needs the table
 * and its types so the Google sync engine can write through this boundary.
 */

export { EVENT_TYPES, event, eventType, type Event, type EventType } from './schema';
