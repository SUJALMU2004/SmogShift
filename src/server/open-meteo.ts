import { z } from "zod";
import {
  cities,
  kolkataDate,
  type AirHour,
  type CityId,
  type Forecast,
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
const cacheDuration = 15 * 60_000;

function tomorrow(now: Date) {
  // India Standard Time has no daylight-saving transitions.
  return kolkataDate(new Date(now.getTime() + 86_400_000));
}

export function normalizeForecast(
  payload: unknown,
  city: CityId,
  now: Date,
): Forecast {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success)
    throw new HttpError(502, "The forecast provider returned unreadable data.");

  const date = tomorrow(now);
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

export function createForecastService(
  fetcher: typeof fetch = fetch,
  clock = () => new Date(),
) {
  const cache = new Map<CityId, { forecast: Forecast; expires: number }>();
  const pending = new Map<string, Promise<Forecast>>();

  async function fetchForecast(city: CityId, now: Date) {
    const { latitude, longitude } = cities[city];
    const url = new URL(
      "https://air-quality-api.open-meteo.com/v1/air-quality",
    );
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      domains: "cams_global",
      hourly: fields.join(","),
      timezone: "Asia/Kolkata",
      start_date: tomorrow(now),
      end_date: tomorrow(now),
    }).toString();

    let response: Response;
    try {
      response = await fetcher(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(6500),
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

    const forecast = normalizeForecast(
      await response.json().catch(() => null),
      city,
      now,
    );
    if (tomorrow(clock()) === forecast.date) {
      cache.set(city, { forecast, expires: now.getTime() + cacheDuration });
    }
    return forecast;
  }

  return async (city: CityId): Promise<Forecast> => {
    const now = clock();
    const date = tomorrow(now);
    const cached = cache.get(city);
    if (
      cached &&
      cached.expires > now.getTime() &&
      cached.forecast.date === date
    )
      return cached.forecast;

    const key = `${city}:${date}`;
    const active = pending.get(key);
    if (active) return active;
    const loading = fetchForecast(city, now).finally(() => pending.delete(key));
    pending.set(key, loading);
    return loading;
  };
}
