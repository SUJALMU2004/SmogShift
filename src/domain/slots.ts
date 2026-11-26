import { z } from "zod";

export const minutesPerDay = 24 * 60;
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export type Slot = { start: number; end: number };

/** Convert a validated 24-hour HH:MM time to minutes from midnight. */
export function timeToMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}

export function minutesToTime(minutes: number): string {
  return [Math.floor(minutes / 60), minutes % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function activitySlot(task: { time: string; duration: number }): Slot {
  const start = timeToMinutes(task.time);
  return { start, end: start + task.duration };
}

/** Slots are half-open, so an activity may start as another ends. */
export function overlaps(first: Slot, second: Slot): boolean {
  return first.start < second.end && second.start < first.end;
}
