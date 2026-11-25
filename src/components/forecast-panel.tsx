import {
  ArrowUpRight,
  CalendarDays,
  CloudFog,
  MapPin,
  RotateCw,
} from "lucide-react";
import {
  aqiBand,
  cities,
  cityIds,
  type CityId,
  type Forecast,
} from "../domain/air";

type Props = {
  city: CityId;
  forecast: Forecast | null;
  loading: boolean;
  error: string | null;
  sample: boolean;
  onCity: (city: CityId) => void;
  onRegional: () => void;
  onSample: () => void;
};

function number(value: number | null | undefined) {
  return value == null ? "—" : String(Math.round(value));
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function forecastDate(date: string | null | undefined) {
  if (!date) return "Illustrative smog day";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function ForecastPanel({
  city,
  forecast,
  loading,
  error,
  sample,
  onCity,
  onRegional,
  onSample,
}: Props) {
  const hours = Array.from({ length: 24 }, (_, index) =>
    forecast?.hours.find(({ hour }) => hour === index),
  );
  const peak = forecast?.hours.reduce<(typeof hours)[number]>((best, item) => {
    if (item.aqi === null || (best?.aqi != null && best.aqi >= item.aqi))
      return best;
    return item;
  }, undefined);
  const band = aqiBand(peak?.aqi ?? null);
  const pollutants = [
    { label: "PM₂.₅", value: peak?.pm25 },
    { label: "PM₁₀", value: peak?.pm10 },
    { label: "NO₂", value: peak?.no2 },
    { label: "O₃", value: peak?.o3 },
  ];

  return (
    <section className="forecast" aria-labelledby="forecast-heading">
      <div className="forecast-toolbar">
        <div>
          <p className="eyebrow">
            <CloudFog size={17} aria-hidden /> Regional air outlook
          </p>
          <h2 id="forecast-heading">
            {sample ? "Sample forecast" : "Tomorrow’s forecast"}
          </h2>
        </div>
        <div className="forecast-controls">
          <label className="location-field">
            <MapPin size={15} aria-hidden />
            <span className="sr-only">Region</span>
            <select
              value={city}
              onChange={(event) => onCity(event.target.value as CityId)}
            >
              {cityIds.map((id) => (
                <option key={id} value={id}>
                  {cities[id].label}
                </option>
              ))}
            </select>
          </label>
          {sample ? (
            <button
              className="forecast-action"
              type="button"
              onClick={onRegional}
            >
              Regional forecast <ArrowUpRight size={15} aria-hidden />
            </button>
          ) : (
            <button
              className="forecast-action"
              type="button"
              onClick={onRegional}
              disabled={loading}
            >
              Refresh <RotateCw size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true">
        {loading && (
          <p className="forecast-state">Loading regional forecast…</p>
        )}
        {error && (
          <div className="forecast-state">
            <p>{error}</p>
            <button
              className="forecast-action"
              type="button"
              onClick={onSample}
            >
              Use sample forecast
            </button>
          </div>
        )}
        {forecast && (
          <>
            <div className="forecast-body">
              <div className="daily">
                <div className="date-line">
                  <CalendarDays size={14} aria-hidden />{" "}
                  {forecastDate(forecast.date)}
                </div>
                <div className="peak-number">
                  <strong>{number(peak?.aqi)}</strong>
                  <span>Peak US AQI</span>
                </div>
                <span className={`band band-${band.tone}`}>{band.label}</span>
              </div>
              <div className="trend">
                <div className="trend-label">
                  <span>Hourly US AQI</span>
                  <span>IST</span>
                </div>
                <div className="bars" aria-hidden="true">
                  {hours.map((point, index) => {
                    const value = point?.aqi ?? null;
                    const tone = aqiBand(value).tone;
                    return (
                      <div
                        className="bar-track"
                        key={index}
                        title={`${hourLabel(index)}: ${number(value)}`}
                      >
                        <div
                          className={`bar bar-${tone}`}
                          style={{
                            height: `${value === null ? 5 : Math.max(6, (100 * value) / Math.max(300, peak?.aqi ?? 0))}%`,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="trend-label trend-times" aria-hidden="true">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:00</span>
                </div>
              </div>
              <div className="pollutants">
                <strong>
                  At {peak ? hourLabel(peak.hour) : "peak"} <span>· µg/m³</span>
                </strong>
                <dl>
                  {pollutants.map(({ label, value }) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{number(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <div className="forecast-meta">
              {sample ? (
                <span>Fictional readings for the demo.</span>
              ) : (
                <span>
                  Regional model ·{" "}
                  <a href="https://open-meteo.com/en/docs/air-quality-api">
                    Open-Meteo
                  </a>{" "}
                  / <a href="https://atmosphere.copernicus.eu/">CAMS</a> · ~45
                  km grid
                </span>
              )}
              {forecast.fetchedAt && (
                <span>
                  Fetched{" "}
                  {new Intl.DateTimeFormat("en-IN", {
                    timeStyle: "short",
                    timeZone: "Asia/Kolkata",
                  }).format(new Date(forecast.fetchedAt))}{" "}
                  IST
                </span>
              )}
              <details className="readings">
                <summary>Read hourly values</summary>
                <table>
                  <caption className="sr-only">
                    Hourly US AQI forecast in local time
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Time (IST)</th>
                      <th scope="col">US AQI</th>
                      <th scope="col">Health band</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hours.map((point, index) => (
                      <tr key={index}>
                        <th scope="row">{hourLabel(index)}</th>
                        <td>{number(point?.aqi)}</td>
                        <td>{aqiBand(point?.aqi ?? null).label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
