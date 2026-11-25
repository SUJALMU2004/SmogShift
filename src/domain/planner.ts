import { aqiBand, type Forecast } from "./air";
import {
  activities,
  minutesToTime,
  timeToMinutes,
  type Preferences,
  type Task,
} from "./routine";

export type Decision = {
  original: Task;
  time: string | null;
  title: string;
  reason: string;
  kind: "kept" | "moved" | "indoors" | "deferred" | "carpool" | "source";
  outdoorMinutesAvoided: number;
  conditionalRoundTrips: number;
  sourcesRemoved: number;
};

function unchanged(task: Task, reason: string): Decision {
  return {
    original: task,
    time: task.time,
    title: activities[task.kind],
    reason,
    kind: "kept",
    outdoorMinutesAvoided: 0,
    conditionalRoundTrips: 0,
    sourcesRemoved: 0,
  };
}

function peakInWindow(
  aqiByHour: Map<number, number | null>,
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

function isOutdoor(task: Task) {
  return task.kind === "outdoor_exercise" || task.kind === "outdoor_errand";
}

function findAlternative(
  task: Task,
  occupied: ReadonlyMap<string, { start: number; end: number }>,
  aqiByHour: Map<number, number | null>,
  cutoff: number,
) {
  const original = timeToMinutes(task.time);
  let best: { start: number; peak: number } | undefined;
  // Only offer same-day blocks within four hours of the original start.
  for (
    let start = Math.max(6 * 60, original - 240);
    start <= original + 240 && start + task.duration <= 21 * 60;
    start += 30
  ) {
    const peak = peakInWindow(aqiByHour, start, task.duration);
    if (peak === null || peak >= cutoff) continue;
    if (
      [...occupied].some(
        ([id, slot]) =>
          id !== task.id &&
          start < slot.end &&
          start + task.duration > slot.start,
      )
    )
      continue;
    if (
      !best ||
      peak < best.peak ||
      (peak === best.peak &&
        Math.abs(start - original) < Math.abs(best.start - original))
    ) {
      best = { start, peak };
    }
  }
  return best;
}

/** Plan confirmed activities for a single regional forecast day without side effects. */
export function buildPlan(
  tasks: readonly Task[],
  forecast: Forecast | null,
  preferences: Preferences,
) {
  const aqiByHour = new Map(
    forecast?.hours.map(({ hour, aqi }) => [hour, aqi]),
  );
  const cutoff = preferences.sensitive ? 101 : 151;
  const sorted = [...tasks].sort((first, second) =>
    first.time.localeCompare(second.time),
  );
  const occupied = new Map(
    sorted.map((task) => {
      const start = timeToMinutes(task.time);
      return [task.id, { start, end: start + task.duration }];
    }),
  );
  let offeredCarpool = false;

  const decisions = sorted.map((task): Decision => {
    if (
      task.kind === "school_pickup" &&
      task.travel === "car" &&
      preferences.carpool &&
      !offeredCarpool
    ) {
      offeredCarpool = true;
      return {
        ...unchanged(
          task,
          "Pickup time stays fixed. Count the saving only if this shared ride replaces a separate car round trip.",
        ),
        kind: "carpool",
        title: "Share the school pickup ride",
        conditionalRoundTrips: 1,
      };
    }

    if (task.kind === "school_pickup") {
      return unchanged(task, "Keep the school pickup at its scheduled time.");
    }

    if (task.fixed) {
      if (isOutdoor(task)) {
        const peak = peakInWindow(
          aqiByHour,
          timeToMinutes(task.time),
          task.duration,
        );
        if (peak !== null && peak >= cutoff) {
          return unchanged(
            task,
            `Time is locked and the forecast peaks at US AQI ${peak} during this block. Reduce time or exertion outdoors where feasible.`,
          );
        }
      }
      return unchanged(task, "You marked this activity as fixed.");
    }

    if (task.kind === "burn_incense" || task.kind === "dry_sweeping") {
      const incense = task.kind === "burn_incense";
      if (incense) occupied.delete(task.id);
      return {
        ...unchanged(
          task,
          incense
            ? "Skipping incense removes a source of indoor smoke."
            : "A damp mop traps settled dust that dry sweeping can stir up.",
        ),
        kind: "source",
        title: incense ? "Skip incense" : "Damp mop instead",
        time: incense ? null : task.time,
        sourcesRemoved: 1,
      };
    }

    if (!isOutdoor(task))
      return unchanged(task, "Keep this activity as entered.");

    const start = timeToMinutes(task.time);
    const peak = peakInWindow(aqiByHour, start, task.duration);
    if (peak === null)
      return unchanged(
        task,
        "Forecast coverage is incomplete for this activity.",
      );
    if (peak < cutoff)
      return unchanged(
        task,
        `Forecast peak for this block is US AQI ${peak} (${aqiBand(peak).label.toLowerCase()}).`,
      );

    const alternative = findAlternative(task, occupied, aqiByHour, cutoff);
    if (alternative) {
      occupied.set(task.id, {
        start: alternative.start,
        end: alternative.start + task.duration,
      });
      return {
        ...unchanged(
          task,
          `The forecast peak drops from US AQI ${peak} to ${alternative.peak} for the same duration.`,
        ),
        kind: "moved",
        time: minutesToTime(alternative.start),
        title: `Reschedule ${activities[task.kind].toLowerCase()}`,
      };
    }

    const exercise = task.kind === "outdoor_exercise";
    if (!exercise) occupied.delete(task.id);
    return {
      ...unchanged(
        task,
        `The original block peaks at US AQI ${peak}. No suitable alternative outdoor block was found nearby in time.`,
      ),
      kind: exercise ? "indoors" : "deferred",
      time: exercise ? task.time : null,
      title: exercise ? "Move exercise indoors" : "Defer the outdoor errand",
      outdoorMinutesAvoided: task.duration,
    };
  });

  const impact = {
    outdoorMinutesAvoided: decisions.reduce(
      (total, item) => total + item.outdoorMinutesAvoided,
      0,
    ),
    conditionalRoundTrips: decisions.reduce(
      (total, item) => total + item.conditionalRoundTrips,
      0,
    ),
    sourcesRemoved: decisions.reduce(
      (total, item) => total + item.sourcesRemoved,
      0,
    ),
  };

  return { decisions, impact };
}
