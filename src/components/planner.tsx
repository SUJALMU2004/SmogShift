"use client";

import { ArrowUpRight, RotateCcw, Wind } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CityId } from "../domain/air";
import { buildPlan } from "../domain/planner";
import {
  exampleRoutines,
  exampleTasks,
  maxTasks,
  reviewTasks,
  type EditableTask,
  type Preferences,
} from "../domain/routine";
import { sampleForecast } from "../domain/sample";
import { messages, type Locale } from "../i18n/messages";
import { ForecastPanel } from "./forecast-panel";
import { PlanComparison } from "./plan-comparison";
import { RoutineEditor } from "./routine-editor";
import { useRegionalForecast } from "./use-regional-forecast";
import { useRoutineExtraction } from "./use-routine-extraction";

const samplePreferences: Preferences = { sensitive: false, carpool: true };

export function Planner() {
  const [locale, setLocale] = useState<Locale>("en");
  const text = messages[locale];
  const [city, setCity] = useState<CityId>("delhi");
  const [sample, setSample] = useState(true);
  const [revision, setRevision] = useState(0);
  const [routine, setRoutine] = useState(exampleRoutines.en);
  const [drafts, setDrafts] = useState<EditableTask[]>([...exampleTasks]);
  const [confirmed, setConfirmed] = useState(true);
  const [preferences, setPreferences] = useState(samplePreferences);
  const assistant = useRoutineExtraction(text);
  const sequence = useRef(0);
  const regional = useRegionalForecast(city, !sample, revision);
  const exampleForecast = useMemo(() => sampleForecast(city), [city]);
  const forecast = sample ? exampleForecast : regional.forecast;
  const forecastStatus = sample
    ? "sample"
    : regional.loading
      ? "loading"
      : forecast
        ? "ready"
        : "unavailable";
  const reviewed = useMemo(() => reviewTasks(drafts), [drafts]);
  const plan = useMemo(
    () =>
      confirmed && reviewed.ok && !regional.loading
        ? buildPlan(reviewed.tasks, forecast, preferences)
        : null,
    [confirmed, reviewed, regional.loading, forecast, preferences],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function switchLocale(next: Locale) {
    if (routine === exampleRoutines[locale]) setRoutine(exampleRoutines[next]);
    setLocale(next);
  }

  function updateDrafts(
    update: (current: EditableTask[]) => EditableTask[],
    needsReview = true,
  ) {
    assistant.reset();
    if (needsReview) setConfirmed(false);
    setDrafts(update);
  }

  function edit(
    id: string,
    changes: Partial<EditableTask>,
    needsReview: boolean,
  ) {
    updateDrafts(
      (current) =>
        current.map((item) =>
          item.id === id ? { ...item, ...changes } : item,
        ),
      needsReview,
    );
  }

  function resetExample() {
    updateDrafts(() => [...exampleTasks]);
    setRoutine(exampleRoutines[locale]);
    setPreferences(samplePreferences);
    setSample(true);
    setConfirmed(true);
  }

  function useRegional() {
    if (sample) setPreferences((current) => ({ ...current, carpool: false }));
    setSample(false);
    setRevision((value) => value + 1);
  }

  function selectCity(next: CityId) {
    setCity(next);
    setRevision((value) => value + 1);
  }

  function nextId() {
    sequence.current += 1;
    return `task-${sequence.current}`;
  }

  function addTask() {
    if (drafts.length >= maxTasks) return;
    const id = nextId();
    updateDrafts((current) => [
      ...current,
      {
        id,
        kind: "other",
        time: null,
        duration: null,
        fixed: true,
        travel: "unspecified",
      },
    ]);
  }

  function extractRoutine() {
    void assistant.extract(routine, (tasks) => {
      const activities = tasks.map((task) => ({
        ...task,
        id: nextId(),
      }));
      setDrafts(activities);
      setConfirmed(false);
      return reviewTasks(activities).ok;
    });
  }

  return (
    <>
      <a className="skip-link" href="#content">
        {text.skip}
      </a>
      <header className="masthead">
        <div className="site-width masthead-inner">
          <Link className="brand" href="/" aria-label={text.home}>
            <span>
              <Wind size={23} aria-hidden />
            </span>
            SmogShift
          </Link>
          <div className="masthead-actions">
            <span className="header-context">{text.header}</span>
            <label className="language-field">
              <span className="sr-only">{text.language}</span>
              <select
                value={locale}
                onChange={(event) =>
                  switchLocale(event.target.value === "hi" ? "hi" : "en")
                }
              >
                <option value="en" lang="en">
                  English
                </option>
                <option value="hi" lang="hi">
                  हिन्दी
                </option>
              </select>
            </label>
          </div>
        </div>
      </header>
      <main className="site-width" id="content" tabIndex={-1}>
        <div className="intro">
          <div>
            <h1>{text.intro}</h1>
            <p>{text.introBody}</p>
          </div>
          <button
            className="button secondary example-button"
            type="button"
            onClick={resetExample}
          >
            <RotateCcw size={17} aria-hidden /> {text.loadExample}
          </button>
        </div>
        <ForecastPanel
          city={city}
          forecast={forecast}
          loading={regional.loading}
          error={Boolean(regional.error)}
          sample={sample}
          locale={locale}
          onCity={selectCity}
          onRegional={useRegional}
          onSample={() => setSample(true)}
        />
        {!sample && !regional.error && (
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
            text={text}
            routine={routine}
            drafts={drafts}
            preferences={preferences}
            extracting={assistant.extracting}
            aiStatus={assistant.status}
            issue={
              (confirmed || assistant.needsReview) && !reviewed.ok
                ? reviewed.issue
                : null
            }
            onRoutine={setRoutine}
            onExtract={extractRoutine}
            onEdit={(id, changes) => edit(id, changes, true)}
            onAdjust={(id, changes) => edit(id, changes, false)}
            onAdd={addTask}
            onRemove={(id) =>
              updateDrafts((current) =>
                current.filter((task) => task.id !== id),
              )
            }
            onPreferences={setPreferences}
            onConfirm={() => setConfirmed(true)}
          />
          <PlanComparison
            plan={plan}
            forecastStatus={forecastStatus}
            text={text}
          />
        </div>
      </main>
      <footer className="site-width footer">
        <span>{text.footer}</span>
        <a href="https://ews.tropmet.res.in/">
          {text.official} <ArrowUpRight size={14} aria-hidden />
        </a>
        <a href="https://ncdc.mohfw.gov.in/uploads/pdf/air7.pdf">
          {text.guidance} <ArrowUpRight size={14} aria-hidden />
        </a>
      </footer>
    </>
  );
}
