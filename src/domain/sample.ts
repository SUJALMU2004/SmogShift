import type { AirHour, CityId, Forecast } from "./air";

const sampleAqi = [
  239, 241, 247, 264, 272, 291, 312, 325, 311, 280, 227, 195, 174, 166, 158,
  164, 172, 185, 208, 231, 248, 251, 244, 240,
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
