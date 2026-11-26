import { describe, expect, it } from "vitest";
import { regionalForecastSchema } from "../../src/domain/air";
import { sampleForecast } from "../../src/domain/sample";

const fixture = {
  ...sampleForecast("delhi"),
  source: "open-meteo",
  date: "2026-11-27",
  fetchedAt: "2026-11-26T10:00:00.000Z",
};

describe("regional forecast contract", () => {
  it("accepts sparse hours, zero AQI and unknown pollutants", () => {
    const hours = fixture.hours.slice(0, 2).map((hour) => ({
      ...hour,
      aqi: hour.hour === 0 ? 0 : 501,
      pm25: null,
    }));
    expect(regionalForecastSchema.parse({ ...fixture, hours }).hours).toEqual(
      hours,
    );
  });

  it.each([
    ["invalid calendar date", { date: "2026-02-30" }],
    ["invalid retrieval timestamp", { fetchedAt: "yesterday" }],
    ["wrong source", { source: "sample" }],
    ["invalid region", { city: "unknown" }],
    ["empty hour list", { hours: [] }],
    ["unordered hours", { hours: [...fixture.hours].reverse() }],
    [
      "missing usable AQI",
      { hours: fixture.hours.map((hour) => ({ ...hour, aqi: null })) },
    ],
    ["malformed reading", { hours: [{ ...fixture.hours[0], pm25: "55" }] }],
    ["out-of-range hour", { hours: [{ ...fixture.hours[0], hour: 24 }] }],
  ])("rejects %s before it reaches the planner", (_label, changes) => {
    expect(
      regionalForecastSchema.safeParse({ ...fixture, ...changes }).success,
    ).toBe(false);
  });
});
