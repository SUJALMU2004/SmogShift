import { describe, expect, it } from "vitest";
import { aqiBand, type Forecast } from "../../src/domain/air";
import { buildPlan } from "../../src/domain/planner";
import { exampleTasks, reviewTasks, type Task } from "../../src/domain/routine";
import { sampleForecast } from "../../src/domain/sample";

const normal = { sensitive: false, carpool: false };
const walk: Task = {
  id: "walk",
  kind: "outdoor_exercise",
  time: "07:30",
  duration: 60,
  fixed: false,
  travel: "unspecified",
  indoorAvailable: true,
};

function outlook(values: Record<number, number | null>): Forecast {
  return {
    ...sampleForecast("delhi"),
    hours: Object.entries(values).map(([hour, aqi]) => ({
      hour: Number(hour),
      aqi,
      pm25: null,
      pm10: null,
      no2: null,
      o3: null,
    })),
  };
}

describe("US AQI bands", () => {
  it.each([
    [0, "Good"],
    [50, "Good"],
    [51, "Moderate"],
    [100, "Moderate"],
    [101, "Unhealthy for sensitive groups"],
    [150, "Unhealthy for sensitive groups"],
    [151, "Unhealthy"],
    [200, "Unhealthy"],
    [201, "Very unhealthy"],
    [300, "Very unhealthy"],
    [301, "Hazardous"],
    [500, "Hazardous"],
    [501, "Beyond the AQI scale"],
    [-1, "Unavailable"],
    [null, "Unavailable"],
  ])("classifies %s as %s", (value, label) => {
    expect(aqiBand(value).label).toBe(label);
  });
});

describe("planning decisions", () => {
  it("recalculates only the conditional trip when the carpool is unavailable", () => {
    const reviewed = reviewTasks(exampleTasks);
    if (!reviewed.ok) throw new Error("Invalid example");
    const tasks = reviewed.tasks;
    const forecast = sampleForecast("delhi");
    const withCarpool = buildPlan(tasks, forecast, {
      ...normal,
      carpool: true,
    });
    const withoutCarpool = buildPlan(tasks, forecast, normal);
    expect(withCarpool.impact).toEqual({
      outdoorMinutesAvoided: 0,
      conditionalRoundTrips: 1,
      sourcesRemoved: 1,
    });
    expect(withoutCarpool.impact).toEqual({
      outdoorMinutesAvoided: 0,
      conditionalRoundTrips: 0,
      sourcesRemoved: 1,
    });
    expect(withoutCarpool.decisions[1]).toMatchObject({
      kind: "kept",
      time: "15:00",
    });
  });

  it("checks every hour in both the original and the alternative windows", () => {
    const forecast = outlook({
      7: 80,
      8: 220,
      9: 70,
      10: null,
      11: 80,
      12: 80,
    });
    const result = buildPlan([{ ...walk, duration: 75 }], forecast, normal);
    expect(result.decisions[0]).toMatchObject({
      kind: "moved",
      time: "11:00",
      outdoorMinutesAvoided: 0,
    });
    expect(result.decisions[0].reason).toEqual({
      code: "move",
      peak: 220,
      newPeak: 80,
      cutoff: 151,
    });
  });

  it("avoids a collision with a locked commitment", () => {
    const forecast = outlook({
      7: 220,
      8: 220,
      9: 70,
      10: null,
      11: 80,
      12: 80,
    });
    const fixed: Task = {
      ...walk,
      id: "fixed",
      kind: "other",
      time: "11:45",
      duration: 45,
      fixed: true,
    };
    const result = buildPlan(
      [{ ...walk, duration: 75 }, fixed],
      forecast,
      normal,
    );
    expect(result.decisions[0]).toMatchObject({
      kind: "indoors",
      time: "07:30",
    });
    expect(result.decisions[1]).toMatchObject({ kind: "kept", time: "11:45" });
  });

  it("uses the sensitive household threshold and preserves fixed outdoor times", () => {
    const forecast = outlook({ 7: 140, 8: 140 });
    expect(buildPlan([walk], forecast, normal).decisions[0].kind).toBe("kept");
    expect(
      buildPlan([walk], forecast, { ...normal, sensitive: true }).decisions[0]
        .kind,
    ).toBe("indoors");
    expect(
      buildPlan([{ ...walk, fixed: true, indoorAvailable: false }], forecast, {
        ...normal,
        sensitive: true,
      }).decisions[0],
    ).toMatchObject({ kind: "kept", time: "07:30" });
    expect(
      buildPlan([{ ...walk, fixed: true }], forecast, {
        ...normal,
        sensitive: true,
      }).decisions[0],
    ).toMatchObject({
      kind: "indoors",
      time: "07:30",
      reason: { code: "lockedIndoor" },
    });
  });

  it("preserves an outdoor activity when the forecast coverage is missing", () => {
    const result = buildPlan([walk], outlook({ 7: 300 }), normal);
    expect(result.decisions[0].reason).toEqual({ code: "unknown" });
    expect(result.impact.outdoorMinutesAvoided).toBe(0);
  });

  it("defers an unlocked outdoor errand when there is no eligible period", () => {
    const task: Task = { ...walk, kind: "outdoor_errand" };
    const result = buildPlan([task], outlook({ 7: 590, 8: 600 }), normal);
    expect(result.decisions[0]).toMatchObject({
      kind: "deferred",
      time: null,
      outdoorMinutesAvoided: 60,
    });
  });

  it("does not double-count carpool options or count a non-car pickup", () => {
    const pickup: Task = {
      ...walk,
      kind: "school_pickup",
      travel: "car",
      fixed: true,
    };
    const tasks = [
      pickup,
      { ...pickup, id: "second" },
      { ...pickup, id: "bus", travel: "transit" },
    ] as Task[];
    expect(
      buildPlan(tasks, null, { ...normal, carpool: true }).impact
        .conditionalRoundTrips,
    ).toBe(1);
    expect(
      buildPlan([tasks[2]], null, { ...normal, carpool: true }).impact
        .conditionalRoundTrips,
    ).toBe(0);
  });

  it("rejects incomplete drafts, malformed times and activities across midnight", () => {
    for (const time of [null, "27:00", "23:30"]) {
      expect(reviewTasks([{ ...walk, time }])).toEqual({
        ok: false,
        issue: { code: "activity", index: 0 },
      });
    }
    expect(reviewTasks([{ ...walk, time: "23:00" }]).ok).toBe(true);
  });

  it("rejects an impossible move window and overlapping baseline tasks", () => {
    expect(
      reviewTasks([{ ...walk, earliestStart: "10:00", latestEnd: "10:30" }]),
    ).toMatchObject({
      issue: { code: "window", index: 0 },
    });
    expect(
      reviewTasks([walk, { ...walk, id: "second", time: "08:00" }]),
    ).toMatchObject({
      issue: { code: "conflict", index: 1 },
    });
    expect(
      reviewTasks([walk, { ...walk, id: "second", time: "08:30" }]).ok,
    ).toBe(true);
  });

  it("preserves a required activity with no eligible slot", () => {
    const errand: Task = {
      ...walk,
      kind: "outdoor_errand",
      required: true,
      earliestStart: "08:00",
      latestEnd: "09:00",
    };
    const result = buildPlan(
      [errand],
      outlook({ 7: 260, 8: 180, 9: 20 }),
      normal,
    );
    expect(result.decisions[0]).toMatchObject({
      kind: "review",
      time: "07:30",
      reason: { code: "requiredReview", peak: 260 },
    });
    expect(result.impact.outdoorMinutesAvoided).toBe(0);
  });

  it("uses the activity sensitivity override and its available indoor fallback", () => {
    const activity = {
      ...walk,
      duration: 30,
      earliestStart: "10:00",
      latestEnd: "11:00",
    };
    const forecast = outlook({ 7: 210, 10: 120, 11: 60 });
    expect(buildPlan([activity], forecast, normal).decisions[0]).toMatchObject({
      kind: "moved",
      time: "10:00",
    });
    expect(
      buildPlan([{ ...activity, sensitivity: "sensitive" }], forecast, normal)
        .decisions[0],
    ).toMatchObject({
      kind: "indoors",
      time: "07:30",
      outdoorMinutesAvoided: 30,
    });
    expect(
      buildPlan([{ ...activity, sensitivity: "general" }], forecast, {
        ...normal,
        sensitive: true,
      }).decisions[0].kind,
    ).toBe("moved");
    expect(
      buildPlan(
        [{ ...activity, sensitivity: "sensitive", indoorAvailable: false }],
        forecast,
        normal,
      ).decisions[0].kind,
    ).toBe("deferred");
  });

  it("lets a required task take the only eligible start without overlapping another proposal", () => {
    const optional = {
      ...walk,
      duration: 30,
      earliestStart: "10:17",
      latestEnd: "10:47",
    };
    const required: Task = {
      ...optional,
      id: "required",
      kind: "outdoor_errand",
      required: true,
      time: "08:30",
    };
    const result = buildPlan(
      [optional, required],
      outlook({ 7: 210, 8: 200, 10: 90 }),
      normal,
    );
    expect(result.decisions[0]).toMatchObject({ kind: "indoors" });
    expect(result.decisions[1]).toMatchObject({ kind: "moved", time: "10:17" });
  });

  it("preserves a school pickup even if extraction fails to flag it as fixed or required", () => {
    const pickup: Task = {
      ...walk,
      kind: "school_pickup",
      fixed: false,
      required: false,
      travel: "car",
    };
    expect(buildPlan([pickup], null, normal).decisions[0]).toMatchObject({
      kind: "kept",
      time: pickup.time,
    });
  });
});
