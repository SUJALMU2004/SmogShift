import { z } from "zod";

export const cityIds = ["delhi", "noida", "gurugram"] as const;
export type CityId = (typeof cityIds)[number];

export const cities = {
  delhi: { latitude: 28.614, longitude: 77.209 },
  noida: { latitude: 28.5355, longitude: 77.391 },
  gurugram: { latitude: 28.4595, longitude: 77.0266 },
} satisfies Record<CityId, { latitude: number; longitude: number }>;

export function isCity(value: string | null): value is CityId {
  return value !== null && Object.hasOwn(cities, value);
}

const reading = z.number().nonnegative().nullable();
const airHourSchema = z.strictObject({
  hour: z.number().int().min(0).max(23),
  aqi: reading,
  pm25: reading,
  pm10: reading,
  no2: reading,
  o3: reading,
});

/** Wire contract for the normalized forecast served by our API. */
export const regionalForecastSchema = z.strictObject({
  city: z.enum(cityIds),
  date: z.iso.date(),
  fetchedAt: z.iso.datetime(),
  source: z.literal("open-meteo"),
  hours: z
    .array(airHourSchema)
    .min(1)
    .max(24)
    .refine((hours) => hours.some(({ aqi }) => aqi !== null))
    .refine((hours) =>
      hours.every(({ hour }, index) => hour > (hours[index - 1]?.hour ?? -1)),
    ),
});

export type AirHour = z.infer<typeof airHourSchema>;
export type RegionalForecast = z.infer<typeof regionalForecastSchema>;
export type SampleForecast = {
  city: CityId;
  date: null;
  fetchedAt: null;
  source: "sample";
  hours: AirHour[];
};
export type Forecast = RegionalForecast | SampleForecast;

export function aqiBand(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0)
    return { label: "Unavailable", tone: "unknown" } as const;
  const aqi = Math.round(value);
  if (aqi <= 50) return { label: "Good", tone: "good" } as const;
  if (aqi <= 100) return { label: "Moderate", tone: "moderate" } as const;
  if (aqi <= 150)
    return {
      label: "Unhealthy for sensitive groups",
      tone: "sensitive",
    } as const;
  if (aqi <= 200) return { label: "Unhealthy", tone: "unhealthy" } as const;
  if (aqi <= 300)
    return { label: "Very unhealthy", tone: "very-unhealthy" } as const;
  if (aqi <= 500) return { label: "Hazardous", tone: "hazardous" } as const;
  return { label: "Beyond the AQI scale", tone: "hazardous" } as const;
}

/** Date of the next day in India Standard Time (UTC+05:30 year-round). */
export function tomorrowInKolkata(now: Date) {
  const day = 24 * 60 * 60_000;
  const offset = (5 * 60 + 30) * 60_000;
  return new Date(now.getTime() + day + offset).toISOString().slice(0, 10);
}
