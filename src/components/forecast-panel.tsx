import {
  ArrowUpRight,
  CalendarDays,
  CloudFog,
  MapPin,
  RotateCw,
} from "lucide-react";
import {
  aqiBand,
  cityIds,
  isCity,
  type CityId,
  type Forecast,
} from "../domain/air";
import { minutesToTime } from "../domain/routine";
import { formatLocales, messages, type Locale } from "../i18n/messages";

type Props = {
  city: CityId;
  forecast: Forecast | null;
  loading: boolean;
  error: boolean;
  sample: boolean;
  locale: Locale;
  onCity: (city: CityId) => void;
  onRegional: () => void;
  onSample: () => void;
};

const indices = Array.from({ length: 24 }, (_, index) => index);

function number(value: number | null | undefined) {
  return value == null ? "—" : String(Math.round(value));
}

function hourLabel(hour: number) {
  return minutesToTime(hour * 60);
}

export function ForecastPanel({
  city,
  forecast,
  loading,
  error,
  sample,
  locale,
  onCity,
  onRegional,
  onSample,
}: Props) {
  const text = messages[locale];
  const formatLocale = formatLocales[locale];
  const hours = new Map(forecast?.hours.map((point) => [point.hour, point]));
  const peak = forecast?.hours.reduce<Forecast["hours"][number] | undefined>(
    (best, item) => {
      if (item.aqi === null || (best?.aqi != null && best.aqi >= item.aqi))
        return best;
      return item;
    },
    undefined,
  );
  const band = aqiBand(peak?.aqi ?? null);
  const pollutants = [
    { label: "PM₂.₅", value: peak?.pm25 },
    { label: "PM₁₀", value: peak?.pm10 },
    { label: "NO₂", value: peak?.no2 },
    { label: "O₃", value: peak?.o3 },
  ];
  const forecastDate = forecast?.date
    ? new Intl.DateTimeFormat(formatLocale, {
        day: "numeric",
        month: "short",
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(`${forecast.date}T00:00:00Z`))
    : text.sampleDay;

  return (
    <section className="forecast" aria-labelledby="forecast-heading">
      <div className="forecast-toolbar">
        <div>
          <p className="eyebrow">
            <CloudFog size={17} aria-hidden /> {text.outlook}
          </p>
          <h2 id="forecast-heading">
            {sample ? text.sampleForecast : text.tomorrowForecast}
          </h2>
        </div>
        <div className="forecast-controls">
          <label className="location-field">
            <MapPin size={15} aria-hidden />
            <span className="sr-only">{text.region}</span>
            <select
              value={city}
              onChange={(event) => {
                if (isCity(event.target.value)) onCity(event.target.value);
              }}
            >
              {cityIds.map((id) => (
                <option key={id} value={id}>
                  {text.cities[id]}
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
              {text.regionalForecast} <ArrowUpRight size={15} aria-hidden />
            </button>
          ) : (
            <button
              className="forecast-action"
              type="button"
              onClick={onRegional}
              disabled={loading}
            >
              {text.refresh} <RotateCw size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true">
        {loading && <p className="forecast-state">{text.loadingForecast}</p>}
        {error && (
          <div className="forecast-state">
            <p>{text.forecastError}</p>
            <button
              className="forecast-action"
              type="button"
              onClick={onSample}
            >
              {text.useSample}
            </button>
          </div>
        )}
        {forecast && (
          <>
            <div className="forecast-body">
              <div className="daily">
                <div className="date-line">
                  <CalendarDays size={14} aria-hidden /> {forecastDate}
                </div>
                <div className="peak-number">
                  <strong>{number(peak?.aqi)}</strong>
                  <span>{text.peakAqi}</span>
                </div>
                <span className={`band band-${band.tone}`}>
                  {text.bands[band.label]}
                </span>
              </div>
              <div className="trend">
                <div className="trend-label">
                  <span>{text.hourlyAqi}</span>
                  <span>IST</span>
                </div>
                <div className="bars" aria-hidden="true">
                  {indices.map((hour) => {
                    const value = hours.get(hour)?.aqi ?? null;
                    const height =
                      value === null
                        ? 5
                        : Math.max(
                            6,
                            (100 * value) / Math.max(300, peak?.aqi ?? 0),
                          );
                    return (
                      <div
                        className="bar-track"
                        key={hour}
                        title={`${hourLabel(hour)}: ${number(value)}`}
                      >
                        <div
                          className={`bar bar-${aqiBand(value).tone}`}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="trend-label trend-times" aria-hidden="true">
                  {[0, 6, 12, 18, 23].map((hour) => (
                    <span key={hour}>{hourLabel(hour)}</span>
                  ))}
                </div>
              </div>
              <div className="pollutants">
                <strong>
                  {peak
                    ? `${text.peakAt} ${hourLabel(peak.hour)}`
                    : text.peakAqi}{" "}
                  <span>· µg/m³</span>
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
                <span>{text.fictional}</span>
              ) : (
                <span>
                  {text.regionalModel} ·{" "}
                  <a href="https://open-meteo.com/en/docs/air-quality-api">
                    Open-Meteo
                  </a>{" "}
                  / <a href="https://atmosphere.copernicus.eu/">CAMS</a> ·{" "}
                  {text.grid}
                </span>
              )}
              {forecast.fetchedAt && (
                <span>
                  {text.fetched}{" "}
                  {new Intl.DateTimeFormat(formatLocale, {
                    timeStyle: "short",
                    timeZone: "Asia/Kolkata",
                  }).format(new Date(forecast.fetchedAt))}{" "}
                  IST
                </span>
              )}
              <details className="readings">
                <summary>{text.hourlyValues}</summary>
                <table>
                  <caption className="sr-only">{text.forecastTable}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{text.localTime}</th>
                      <th scope="col">US AQI</th>
                      <th scope="col">{text.healthBand}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indices.map((hour) => {
                      const value = hours.get(hour)?.aqi ?? null;
                      return (
                        <tr key={hour}>
                          <th scope="row">{hourLabel(hour)}</th>
                          <td>{number(value)}</td>
                          <td>{text.bands[aqiBand(value).label]}</td>
                        </tr>
                      );
                    })}
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
