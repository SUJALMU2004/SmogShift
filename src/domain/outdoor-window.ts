import { explicitWindow, type Task } from "./routine";
import { minutesPerDay, overlaps, timeToMinutes, type Slot } from "./slots";

const defaultMoveRadius = 4 * 60;
const defaultDayStart = 6 * 60;
const defaultDayEnd = 21 * 60;

export type HourlyAqi = ReadonlyMap<number, number | null>;
type Candidate = { start: number; peak: number; shift: number };

/** A window needs a valid AQI reading for every hour it touches. */
export function peakInWindow(aqi: HourlyAqi, slot: Slot): number | null {
  let peak = 0;
  const lastHour = Math.floor((slot.end - 1) / 60);
  for (let hour = Math.floor(slot.start / 60); hour <= lastHour; hour++) {
    const value = aqi.get(hour);
    if (value == null || !Number.isFinite(value) || value < 0) return null;
    peak = Math.max(peak, Math.round(value));
  }
  return peak;
}

function moveWindow(task: Task, original: number): Slot {
  if (task.earliestStart || task.latestEnd) return explicitWindow(task);
  return {
    start: Math.max(defaultDayStart, original - defaultMoveRadius),
    end: Math.min(defaultDayEnd, original + defaultMoveRadius + task.duration),
  };
}

function candidateStarts(
  window: Slot,
  duration: number,
  original: number,
  occupied: readonly Slot[],
) {
  const starts = new Set([window.start, window.end - duration, original]);
  for (const slot of occupied) {
    starts.add(slot.start - duration);
    starts.add(slot.end);
  }
  // The peak and eligibility stay constant between hour and commitment
  // boundaries. Include each edge and the original time for exact ranking.
  for (let hour = 60; hour < minutesPerDay; hour += 60) {
    starts.add(hour - 1);
    starts.add(hour);
    starts.add(hour - duration);
    starts.add(hour - duration + 1);
  }
  return starts;
}

function compareCandidates(first: Candidate, second: Candidate): number {
  return (
    first.peak - second.peak ||
    first.shift - second.shift ||
    first.start - second.start
  );
}

export function findAlternative(
  task: Task,
  occupied: ReadonlyMap<string, Slot>,
  aqi: HourlyAqi,
  cutoff: number,
): Candidate | undefined {
  const original = timeToMinutes(task.time);
  const window = moveWindow(task, original);
  const otherSlots = [...occupied]
    .filter(([id]) => id !== task.id)
    .map(([, slot]) => slot);
  let best: Candidate | undefined;
  for (const start of candidateStarts(
    window,
    task.duration,
    original,
    otherSlots,
  )) {
    const slot = { start, end: start + task.duration };
    if (start < window.start || slot.end > window.end) continue;
    if (otherSlots.some((other) => overlaps(slot, other))) continue;

    const peak = peakInWindow(aqi, slot);
    if (peak === null || peak >= cutoff) continue;
    const candidate = { start, peak, shift: Math.abs(start - original) };
    if (!best || compareCandidates(candidate, best) < 0) best = candidate;
  }
  return best;
}
