export const cities = {
  delhi: { label: "Delhi", latitude: 28.614, longitude: 77.209 },
  noida: { label: "Noida", latitude: 28.5355, longitude: 77.391 },
  gurugram: { label: "Gurugram", latitude: 28.4595, longitude: 77.0266 },
} as const;

export type CityId = keyof typeof cities;
export const cityIds = Object.keys(cities) as CityId[];

export function isCity(value: string | null): value is CityId {
  return value !== null && Object.hasOwn(cities, value);
}

export type AirHour = {
  hour: number;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
};
export type Forecast = {
  city: CityId;
  date: string | null;
  fetchedAt: string | null;
  source: "open-meteo" | "sample";
  hours: AirHour[];
};

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

export function kolkataDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
