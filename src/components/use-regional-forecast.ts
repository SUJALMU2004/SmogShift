"use client";

import { useEffect, useState } from "react";
import type { CityId, Forecast } from "../domain/air";

type Result = { city: CityId; revision: number } & (
  { forecast: Forecast; error?: never } | { error: string; forecast?: never }
);

export function useRegionalForecast(
  city: CityId,
  enabled: boolean,
  revision: number,
) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      try {
        const response = await fetch(`/api/forecast?city=${city}`, { signal });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Forecast unavailable.");
        if (!signal.aborted) setResult({ city, revision, forecast: body });
      } catch (error) {
        if (!signal.aborted) {
          setResult({
            city,
            revision,
            error:
              error instanceof Error ? error.message : "Forecast unavailable.",
          });
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [city, enabled, revision]);

  if (!enabled) return { loading: false, forecast: null, error: null };
  if (!result || result.city !== city || result.revision !== revision) {
    return { loading: true, forecast: null, error: null };
  }
  return {
    loading: false,
    forecast: result.forecast ?? null,
    error: result.error ?? null,
  };
}
