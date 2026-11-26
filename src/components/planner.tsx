"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CityId } from "../domain/air";
import { buildPlan } from "../domain/planner";
import type { Preferences } from "../domain/routine";
import { sampleForecast } from "../domain/sample";
import { messages, type Locale } from "../i18n/messages";
import { ForecastPanel } from "./forecast-panel";
import { PlanComparison } from "./plan-comparison";
import { PlannerFooter, PlannerHeader } from "./planner-chrome";
import { RoutineEditor } from "./routine-editor";
import {
  useRegionalForecast,
  type ForecastView,
} from "./use-regional-forecast";
import { useRoutineEditor } from "./use-routine-editor";

const samplePreferences: Preferences = { sensitive: false, carpool: true };

export function Planner() {
  const [locale, setLocale] = useState<Locale>("en");
  const [city, setCity] = useState<CityId>("delhi");
  const [sample, setSample] = useState(true);
  const [revision, setRevision] = useState(0);
  const [preferences, setPreferences] = useState(samplePreferences);
  const text = messages[locale];
  const { form, confirmed, reviewed, translateExample, loadExample } =
    useRoutineEditor(locale);
  const regional = useRegionalForecast(city, !sample, revision);
  const example = useMemo(() => sampleForecast(city), [city]);
  const view: ForecastView = sample
    ? { status: "sample", forecast: example }
    : regional;
  const { status, forecast } = view;
  const plan = useMemo(
    () =>
      confirmed && reviewed.ok && status !== "loading"
        ? buildPlan(reviewed.tasks, forecast, preferences)
        : null,
    [confirmed, reviewed, status, forecast, preferences],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function showRegional() {
    if (sample) setPreferences((current) => ({ ...current, carpool: false }));
    setSample(false);
    setRevision((value) => value + 1);
  }

  return (
    <>
      <PlannerHeader
        locale={locale}
        onLanguage={(next) => {
          translateExample(next);
          setLocale(next);
        }}
      />
      <main className="site-width" id="content" tabIndex={-1}>
        <div className="intro">
          <div>
            <h1>{text.intro}</h1>
            <p>{text.introBody}</p>
          </div>
          <button
            className="button secondary example-button"
            type="button"
            onClick={() => {
              loadExample();
              setPreferences(samplePreferences);
              setSample(true);
            }}
          >
            <RotateCcw size={17} aria-hidden /> {text.loadExample}
          </button>
        </div>
        <ForecastPanel
          city={city}
          view={view}
          locale={locale}
          onCity={(next) => {
            setCity(next);
            setRevision((value) => value + 1);
          }}
          onRegional={showRegional}
          onSample={() => setSample(true)}
        />
        {status !== "sample" && status !== "unavailable" && (
          <button
            className="text-button sample-link"
            type="button"
            onClick={() => setSample(true)}
          >
            {text.useSample}
          </button>
        )}
        <div className="planner-grid">
          <RoutineEditor
            {...form}
            text={text}
            preferences={preferences}
            hasPlan={plan !== null}
            onPreferences={setPreferences}
          />
          <PlanComparison
            plan={plan}
            forecastStatus={status}
            forecast={forecast}
            locale={locale}
          />
        </div>
      </main>
      <PlannerFooter text={text} />
    </>
  );
}
