import {
  cityIds,
  tomorrowInKolkata,
  type CityId,
  type RegionalForecast,
} from "../domain/air";
import { HttpError } from "./http";
import { fetchOpenMeteoForecast } from "./open-meteo";
import { createRequestCache } from "./request-cache";

export function createForecastService(
  fetcher: typeof fetch = fetch,
  clock = () => new Date(),
) {
  const get = createRequestCache<string, RegionalForecast>({
    ttlMs: 15 * 60_000,
    maxEntries: cityIds.length,
    clock: () => clock().getTime(),
  });

  return (city: CityId): Promise<RegionalForecast> => {
    const now = clock();
    const date = tomorrowInKolkata(now);
    return get(`${city}:${date}`, async () => {
      const forecast = await fetchOpenMeteoForecast(city, now, fetcher);
      if (tomorrowInKolkata(clock()) !== forecast.date) {
        throw new HttpError(
          503,
          "The forecast day changed. Refresh and try again.",
        );
      }
      return forecast;
    });
  };
}
