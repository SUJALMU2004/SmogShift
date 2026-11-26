"use client";

import { useEffect, useState } from "react";
import {
  regionalForecastSchema,
  tomorrowInKolkata,
  type CityId,
  type RegionalForecast,
  type SampleForecast,
} from "../domain/air";

type Query = { city: CityId; date: string; revision: number };
type Result = Query & { forecast: RegionalForecast | null };
type RegionalView =
  | { status: "loading" | "unavailable"; forecast: null }
  | { status: "ready"; forecast: RegionalForecast };
export type ForecastView =
  RegionalView | { status: "sample"; forecast: SampleForecast };

function useTomorrowDate() {
  const [date, setDate] = useState(() => tomorrowInKolkata(new Date()));
  useEffect(() => {
    function refreshDate() {
      setDate(tomorrowInKolkata(new Date()));
    }
    const midnight = Date.parse(`${date}T00:00:00+05:30`);
    const timer = window.setTimeout(refreshDate, midnight - Date.now());
    document.addEventListener("visibilitychange", refreshDate);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshDate);
    };
  }, [date]);
  return date;
}

async function requestForecast(
  city: CityId,
  date: string,
  signal: AbortSignal,
) {
  try {
    const response = await fetch(`/api/forecast?city=${city}`, { signal });
    if (!response.ok) return null;
    const parsed = regionalForecastSchema.safeParse(await response.json());
    if (
      !parsed.success ||
      parsed.data.date !== date ||
      parsed.data.city !== city
    )
      return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function useRegionalForecast(
  city: CityId,
  enabled: boolean,
  revision: number,
): RegionalView {
  const date = useTomorrowDate();
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    async function load() {
      const forecast = await requestForecast(city, date, controller.signal);
      if (!controller.signal.aborted)
        setResult({ city, date, revision, forecast });
    }
    void load();
    return () => controller.abort();
  }, [city, date, enabled, revision]);

  if (
    !enabled ||
    !result ||
    result.city !== city ||
    result.revision !== revision ||
    result.date !== date
  ) {
    return { status: "loading", forecast: null };
  }
  if (!result.forecast) return { status: "unavailable", forecast: null };
  return { status: "ready", forecast: result.forecast };
}
