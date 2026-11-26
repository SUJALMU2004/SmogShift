import { CalendarDays } from "lucide-react";
import { memo } from "react";
import { aqiBand, type AirHour, type Forecast } from "../domain/air";
import { minutesToTime } from "../domain/slots";
import {
  formatLocales,
  messages,
  type Locale,
  type Messages,
} from "../i18n/messages";

const dayHours = Array.from({ length: 24 }, (_, hour) => hour);
type HourlyValues = ReadonlyMap<number, number | null>;

function formatReading(value: number | null | undefined): string {
  return value == null ? "—" : String(Math.round(value));
}

function hourLabel(hour: number): string {
  return minutesToTime(hour * 60);
}

function pickPeak(hours: readonly AirHour[]): AirHour | undefined {
  let peak: AirHour | undefined;
  for (const hour of hours) {
    if (hour.aqi !== null && hour.aqi > (peak?.aqi ?? -1)) peak = hour;
  }
  return peak;
}

function HourlyChart({
  values,
  peak,
  text,
}: {
  values: HourlyValues;
  peak: number;
  text: Messages;
}) {
  const scale = Math.max(300, peak);
  return (
    <div className="trend">
      <div className="trend-label">
        <span>{text.hourlyAqi}</span>
        <span>IST</span>
      </div>
      <div className="bars" aria-hidden="true">
        {dayHours.map((hour) => {
          const value = values.get(hour) ?? null;
          const height =
            value === null ? 5 : Math.max(6, (100 * value) / scale);
          return (
            <div
              className="bar-track"
              key={hour}
              title={`${hourLabel(hour)}: ${formatReading(value)}`}
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
  );
}

function HourlyTable({
  values,
  text,
}: {
  values: HourlyValues;
  text: Messages;
}) {
  return (
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
          {dayHours.map((hour) => {
            const value = values.get(hour) ?? null;
            return (
              <tr key={hour}>
                <th scope="row">{hourLabel(hour)}</th>
                <td>{formatReading(value)}</td>
                <td>{text.bands[aqiBand(value).label]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}

function Pollutants({
  peak,
  text,
}: {
  peak: AirHour | undefined;
  text: Messages;
}) {
  const readings = [
    { label: "PM₂.₅", value: peak?.pm25 },
    { label: "PM₁₀", value: peak?.pm10 },
    { label: "NO₂", value: peak?.no2 },
    { label: "O₃", value: peak?.o3 },
  ];
  return (
    <div className="pollutants">
      <strong>
        {peak ? `${text.peakAt} ${hourLabel(peak.hour)}` : text.peakAqi}{" "}
        <span>· µg/m³</span>
      </strong>
      <dl>
        {readings.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{formatReading(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SourceNote({
  forecast,
  locale,
}: {
  forecast: Forecast;
  locale: Locale;
}) {
  const text = messages[locale];
  if (forecast.source === "sample") return <span>{text.fictional}</span>;
  const time = new Intl.DateTimeFormat(formatLocales[locale], {
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(forecast.fetchedAt));
  return (
    <>
      <span>
        {text.regionalModel} ·{" "}
        <a href="https://open-meteo.com/en/docs/air-quality-api">Open-Meteo</a>{" "}
        / <a href="https://atmosphere.copernicus.eu/">CAMS</a> · {text.grid}
      </span>
      <span>
        {text.fetched} <time dateTime={forecast.fetchedAt}>{time} IST</time>
      </span>
    </>
  );
}

export const ForecastReadings = memo(function ForecastReadings({
  forecast,
  locale,
}: {
  forecast: Forecast;
  locale: Locale;
}) {
  const text = messages[locale];
  const values = new Map(forecast.hours.map(({ hour, aqi }) => [hour, aqi]));
  const peak = pickPeak(forecast.hours);
  const band = aqiBand(peak?.aqi ?? null);
  const date = forecast.date
    ? new Intl.DateTimeFormat(formatLocales[locale], {
        day: "numeric",
        month: "short",
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(`${forecast.date}T00:00:00Z`))
    : text.sampleDay;

  return (
    <>
      <div className="forecast-body">
        <div className="daily">
          <div className="date-line">
            <CalendarDays size={14} aria-hidden /> {date}
          </div>
          <div className="peak-number">
            <strong>{formatReading(peak?.aqi)}</strong>
            <span>{text.peakAqi}</span>
          </div>
          <span className={`band band-${band.tone}`}>
            {text.bands[band.label]}
          </span>
        </div>
        <HourlyChart values={values} peak={peak?.aqi ?? 0} text={text} />
        <Pollutants peak={peak} text={text} />
      </div>
      <div className="forecast-meta">
        <SourceNote forecast={forecast} locale={locale} />
        <HourlyTable values={values} text={text} />
      </div>
    </>
  );
});
