import type { Forecast } from "./air";
import {
  findAlternative,
  peakInWindow,
  type HourlyAqi,
} from "./outdoor-window";
import {
  isFixed,
  isOutdoor,
  isRequired,
  type Preferences,
  type Task,
} from "./routine";
import { activitySlot, minutesToTime, type Slot } from "./slots";

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

function planningCutoff(task: Task, preferences: Preferences): number {
  if (task.sensitivity === "sensitive") return 101;
  if (task.sensitivity === "general") return 151;
  return preferences.sensitive ? 101 : 151;
}

function outdoorFallback(
  task: Task,
  occupied: Map<string, Slot>,
  peak: number,
  cutoff: number,
): Decision {
  const fixed = isFixed(task);
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

function outdoorDecision(
  task: Task,
  aqiByHour: HourlyAqi,
  occupied: Map<string, Slot>,
  preferences: Preferences,
): Decision {
  const cutoff = planningCutoff(task, preferences);
  const peak = peakInWindow(aqiByHour, activitySlot(task));
  if (peak === null) return unchanged(task, { code: "unknown" });
  if (peak < cutoff) return unchanged(task, { code: "below", peak, cutoff });

  const alternative = isFixed(task)
    ? undefined
    : findAlternative(task, occupied, aqiByHour, cutoff);
  if (!alternative) return outdoorFallback(task, occupied, peak, cutoff);

  const time = minutesToTime(alternative.start);
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
    time,
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
    timeline.map((task) => [task.id, activitySlot(task)]),
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
