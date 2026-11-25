import type { AirHour, CityId, Forecast } from "./air";

// Fictional demo: the 10:00 window is below 151 but above 100.
const sampleAqi = [
  180, 183, 186, 191, 195, 200, 205, 210, 193, 165, 120, 115, 108, 112, 130,
  148, 163, 177, 194, 207, 217, 223, 217, 210,
];

export function sampleForecast(city: CityId): Forecast {
  const hours: AirHour[] = sampleAqi.map((aqi, hour) => ({
    hour,
    aqi,
    pm25: Math.round(aqi * 0.68),
    pm10: Math.round(aqi * 1.15),
    no2: 24 + (hour % 8),
    o3: 37 + (hour % 9),
  }));
  return { city, date: null, fetchedAt: null, source: "sample", hours };
}
