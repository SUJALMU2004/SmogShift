import { z } from "zod";
import {
  cities,
  tomorrowInKolkata,
  type AirHour,
  type CityId,
  type RegionalForecast,
} from "../domain/air";
import { HttpError } from "./http";

const fields = [
  "us_aqi",
  "pm2_5",
  "pm10",
  "nitrogen_dioxide",
  "ozone",
] as const;
const readings = z.array(z.number().nullable()).optional();
const payloadSchema = z.object({
  timezone: z.literal("Asia/Kolkata"),
  hourly: z.object({
    time: z.array(z.string()).max(72),
    us_aqi: readings,
    pm2_5: readings,
    pm10: readings,
    nitrogen_dioxide: readings,
    ozone: readings,
  }),
});
const timeoutMs = 6500;

/** Map raw CAMS readings to validated, ordered forecast hours. */
export function normalizeForecast(
  payload: unknown,
  city: CityId,
  now: Date,
): RegionalForecast {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success)
    throw new HttpError(502, "The forecast provider returned unreadable data.");

  const date = tomorrowInKolkata(now);
  const { hourly } = parsed.data;
  const byHour = new Map<number, AirHour>();
  for (const [index, timestamp] of hourly.time.entries()) {
    if (!timestamp.startsWith(date + "T")) continue;
    const time = timestamp.slice(date.length + 1);
    if (!/^([01]\d|2[0-3]):00$/.test(time)) continue;
    const hour = Number(time.slice(0, 2));
    if (byHour.has(hour))
      throw new HttpError(
        502,
        "The forecast provider returned duplicate hours.",
      );

    function reading(field: (typeof fields)[number]) {
      const series = hourly[field];
      const value =
        series?.length === hourly.time.length ? series[index] : null;
      return value != null && value >= 0 ? value : null;
    }

    byHour.set(hour, {
      hour,
      aqi: reading("us_aqi"),
      pm25: reading("pm2_5"),
      pm10: reading("pm10"),
      no2: reading("nitrogen_dioxide"),
      o3: reading("ozone"),
    });
  }

  const hours = [...byHour.values()].sort((a, b) => a.hour - b.hour);
  if (!hours.some(({ aqi }) => aqi !== null))
    throw new HttpError(502, "Tomorrow’s AQI forecast is unavailable.");
  return {
    city,
    date,
    source: "open-meteo",
    fetchedAt: now.toISOString(),
    hours,
  };
}

export async function fetchOpenMeteoForecast(
  city: CityId,
  now: Date,
  fetcher: typeof fetch,
): Promise<RegionalForecast> {
  const { latitude, longitude } = cities[city];
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  const date = tomorrowInKolkata(now);
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    domains: "cams_global",
    hourly: fields.join(","),
    timezone: "Asia/Kolkata",
    start_date: date,
    end_date: date,
  }).toString();

  let response: Response;
  try {
    response = await fetcher(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new HttpError(
      503,
      "The forecast provider could not be reached. Try again or load the sample.",
    );
  }
  if (!response.ok)
    throw new HttpError(
      503,
      "The forecast provider is unavailable. Try again or load the sample.",
    );

  const payload: unknown = await response.json().catch(() => null);
  return normalizeForecast(payload, city, now);
}
