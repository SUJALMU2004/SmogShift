import type { Forecast } from "./air";
import {
  explicitWindow,
  isFixed,
  isOutdoor,
  isRequired,
  minutesToTime,
  timeToMinutes,
  type Preferences,
  type Task,
} from "./routine";

type Reason =
  | {
      code:
        "fixed" | "keep" | "pickup" | "incense" | "mop" | "carpool" | "unknown";
    }
  | {
      code:
        | "below"
        | "lockedHigh"
        | "lockedIndoor"
        | "indoor"
        | "optionalDeferral"
        | "requiredReview";
      peak: number;
      cutoff: number;
    }
  | { code: "move"; peak: number; newPeak: number; cutoff: number };

export type Decision = {
  original: Task;
  time: string | null;
  reason: Reason;
  kind:
    "kept" | "moved" | "indoors" | "deferred" | "carpool" | "source" | "review";
  outdoorMinutesAvoided: number;
  conditionalRoundTrips: number;
  sourcesRemoved: number;
};

type Slot = { start: number; end: number };

function unchanged(original: Task, reason: Reason): Decision {
  return {
    original,
    time: original.time,
    reason,
    kind: "kept",
    outdoorMinutesAvoided: 0,
    conditionalRoundTrips: 0,
    sourcesRemoved: 0,
  };
}

function peakInWindow(
  aqiByHour: ReadonlyMap<number, number | null>,
  start: number,
  duration: number,
) {
  let peak = 0;
  for (
    let hour = Math.floor(start / 60);
    hour <= Math.floor((start + duration - 1) / 60);
    hour++
  ) {
    const value = aqiByHour.get(hour);
    if (value == null || !Number.isFinite(value) || value < 0) return null;
    peak = Math.max(peak, Math.round(value));
  }
  return peak;
}

function findAlternative(
  task: Task,
  occupied: ReadonlyMap<string, Slot>,
  aqiByHour: ReadonlyMap<number, number | null>,
  cutoff: number,
) {
  const original = timeToMinutes(task.time);
  const window =
    task.earliestStart || task.latestEnd
      ? explicitWindow(task)
      : {
          start: Math.max(360, original - 240),
          end: Math.min(1260, original + 240 + task.duration),
        };
  const latest = window.end - task.duration;
  const otherSlots = [...occupied]
    .filter(([id]) => id !== task.id)
    .map(([, slot]) => slot);
  const starts = new Set([
    window.start,
    latest,
    ...otherSlots.map(({ end }) => end),
  ]);
  for (
    let start = Math.ceil(window.start / 30) * 30;
    start <= latest;
    start += 30
  )
    starts.add(start);

  let best: { start: number; peak: number; shift: number } | undefined;
  for (const start of starts) {
    if (
      start < window.start ||
      start > latest ||
      otherSlots.some(
        (slot) => start < slot.end && start + task.duration > slot.start,
      )
    )
      continue;
    const peak = peakInWindow(aqiByHour, start, task.duration);
    if (peak === null || peak >= cutoff) continue;
    const shift = Math.abs(start - original);
    if (
      !best ||
      peak < best.peak ||
      (peak === best.peak &&
        (shift < best.shift || (shift === best.shift && start < best.start)))
    ) {
      best = { start, peak, shift };
    }
  }
  return best;
}

function outdoorDecision(
  task: Task,
  aqiByHour: ReadonlyMap<number, number | null>,
  occupied: Map<string, Slot>,
  preferences: Preferences,
): Decision {
  const sensitive =
    task.sensitivity === "sensitive" ||
    (task.sensitivity !== "general" && preferences.sensitive);
  // Cutoffs use the US AQI bands consumed by the forecast adapter.
  const cutoff = sensitive ? 101 : 151;
  const peak = peakInWindow(aqiByHour, timeToMinutes(task.time), task.duration);

  if (peak === null) return unchanged(task, { code: "unknown" });
  if (peak < cutoff) return unchanged(task, { code: "below", peak, cutoff });
  const fixed = isFixed(task);
  const alternative = fixed
    ? undefined
    : findAlternative(task, occupied, aqiByHour, cutoff);
  if (alternative) {
    occupied.set(task.id, {
      start: alternative.start,
      end: alternative.start + task.duration,
    });
    return {
      ...unchanged(task, {
        code: "move",
        peak,
        newPeak: alternative.peak,
        cutoff,
      }),
      kind: "moved",
      time: minutesToTime(alternative.start),
    };
  }
  if (task.kind === "outdoor_exercise" && task.indoorAvailable) {
    return {
      ...unchanged(task, {
        code: fixed ? "lockedIndoor" : "indoor",
        peak,
        cutoff,
      }),
      kind: "indoors",
      outdoorMinutesAvoided: task.duration,
    };
  }
  if (fixed) return unchanged(task, { code: "lockedHigh", peak, cutoff });
  if (isRequired(task)) {
    return {
      ...unchanged(task, { code: "requiredReview", peak, cutoff }),
      kind: "review",
    };
  }
  occupied.delete(task.id);
  return {
    ...unchanged(task, { code: "optionalDeferral", peak, cutoff }),
    kind: "deferred",
    time: null,
    outdoorMinutesAvoided: task.duration,
  };
}

function indoorDecision(task: Task, occupied: Map<string, Slot>): Decision {
  const incense = task.kind === "burn_incense";
  if (incense && isFixed(task)) return unchanged(task, { code: "fixed" });
  if (incense && isRequired(task)) return unchanged(task, { code: "keep" });
  if (incense) occupied.delete(task.id);
  return {
    ...unchanged(task, { code: incense ? "incense" : "mop" }),
    kind: "source",
    time: incense ? null : task.time,
    sourcesRemoved: 1,
  };
}

/** Replan one confirmed schedule. Required activities get priority for alternative slots. */
export function buildPlan(
  tasks: readonly Task[],
  forecast: Forecast | null,
  preferences: Preferences,
) {
  const aqiByHour = new Map(
    forecast?.hours.map(({ hour, aqi }) => [hour, aqi]),
  );
  const timeline = [...tasks].sort((a, b) => a.time.localeCompare(b.time));
  const occupied = new Map(
    timeline.map((task) => {
      const start = timeToMinutes(task.time);
      return [task.id, { start, end: start + task.duration }];
    }),
  );
  const carpoolPickup = preferences.carpool
    ? timeline.find(
        (task) => task.kind === "school_pickup" && task.travel === "car",
      )?.id
    : undefined;

  const priority = [...timeline].sort(
    (a, b) => Number(isRequired(b)) - Number(isRequired(a)),
  );
  const decisions = priority
    .map((task): Decision => {
      if (task.id === carpoolPickup) {
        return {
          ...unchanged(task, { code: "carpool" }),
          kind: "carpool",
          conditionalRoundTrips: 1,
        };
      }
      if (task.kind === "school_pickup")
        return unchanged(task, { code: "pickup" });
      if (isOutdoor(task))
        return outdoorDecision(task, aqiByHour, occupied, preferences);
      if (task.kind === "burn_incense" || task.kind === "dry_sweeping")
        return indoorDecision(task, occupied);
      return unchanged(task, { code: isFixed(task) ? "fixed" : "keep" });
    })
    .sort((a, b) => a.original.time.localeCompare(b.original.time));

  const impact = decisions.reduce(
    (total, item) => ({
      outdoorMinutesAvoided:
        total.outdoorMinutesAvoided + item.outdoorMinutesAvoided,
      conditionalRoundTrips:
        total.conditionalRoundTrips + item.conditionalRoundTrips,
      sourcesRemoved: total.sourcesRemoved + item.sourcesRemoved,
    }),
    { outdoorMinutesAvoided: 0, conditionalRoundTrips: 0, sourcesRemoved: 0 },
  );
  return { decisions, impact };
}
