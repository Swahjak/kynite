/**
 * The wall-clock hour (0-23) of `date` in `timeZone` — the family's zone, never
 * the device's or the server's. `getHours()` reads the *runtime's* zone, which
 * is UTC on the server and whatever the tablet says on the client: they
 * disagree for hours every day, which is a hydration mismatch and a wrong
 * daypart/theme/reload window.
 *
 * `PrePaintTheme` inlines the same `Intl` call as a string; keep them in step.
 */
export function hourIn(date: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(date)
  );
}
