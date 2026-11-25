"use client";

import { useEffect, useState } from "react";
import { tomorrowInKolkata, type CityId, type Forecast } from "../domain/air";

type Result = {
  city: CityId;
  revision: number;
  date: string;
  forecast: Forecast | null;
};

export function useRegionalForecast(
  city: CityId,
  enabled: boolean,
  revision: number,
) {
  const [result, setResult] = useState<Result | null>(null);
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

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      let forecast: Forecast | null = null;
      try {
        const response = await fetch(`/api/forecast?city=${city}`, { signal });
        if (response.ok) {
          const data: Forecast = await response.json();
          if (
            data?.date === date &&
            data.city === city &&
            data.source === "open-meteo"
          )
            forecast = data;
        }
      } catch {
        // Network and decoding failures use the forecast-unavailable state.
      }
      if (!signal.aborted) setResult({ city, revision, date, forecast });
    }

    void load();
    return () => controller.abort();
  }, [city, enabled, revision, date]);

  if (!enabled) return { loading: false, forecast: null, error: false };
  if (
    !result ||
    result.city !== city ||
    result.revision !== revision ||
    result.date !== date
  ) {
    return { loading: true, forecast: null, error: false };
  }
  return {
    loading: false,
    forecast: result.forecast,
    error: result.forecast === null,
  };
}
