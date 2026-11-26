import { ArrowUpRight, CloudFog, MapPin, RotateCw } from "lucide-react";
import { cityIds, isCity, type CityId } from "../domain/air";
import { messages, type Locale, type Messages } from "../i18n/messages";
import { ForecastReadings } from "./forecast-readings";
import type { ForecastView } from "./use-regional-forecast";

type Props = {
  city: CityId;
  view: ForecastView;
  locale: Locale;
  onCity: (city: CityId) => void;
  onRegional: () => void;
  onSample: () => void;
};

function ForecastStatus({
  status,
  city,
  onSample,
  text,
}: {
  status: ForecastView["status"];
  city: CityId;
  onSample: () => void;
  text: Messages;
}) {
  const loading = status === "loading";
  const unavailable = status === "unavailable";
  const showNotice = loading || unavailable;
  const announcement = loading
    ? text.loadingForecast
    : unavailable
      ? text.forecastError
      : status === "ready"
        ? text.forecastLoaded(text.cities[city])
        : "";

  return (
    <div className={showNotice ? "forecast-state" : undefined}>
      <p className={showNotice ? undefined : "sr-only"} role="status">
        {announcement}
      </p>
      {unavailable && (
        <button className="forecast-action" type="button" onClick={onSample}>
          {text.useSample}
        </button>
      )}
    </div>
  );
}

export function ForecastPanel({
  city,
  view,
  locale,
  onCity,
  onRegional,
  onSample,
}: Props) {
  const text = messages[locale];
  const { status, forecast } = view;
  const sample = status === "sample";
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
          <button
            className="forecast-action"
            type="button"
            onClick={onRegional}
            disabled={status === "loading"}
          >
            {sample ? text.regionalForecast : text.refresh}
            {sample ? (
              <ArrowUpRight size={15} aria-hidden />
            ) : (
              <RotateCw size={14} aria-hidden />
            )}
          </button>
        </div>
      </div>
      <ForecastStatus
        status={status}
        city={city}
        onSample={onSample}
        text={text}
      />
      {forecast && <ForecastReadings forecast={forecast} locale={locale} />}
    </section>
  );
}
