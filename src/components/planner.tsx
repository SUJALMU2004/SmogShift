"use client";

import { ArrowUpRight, RotateCcw, Wind } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type CityId } from "../domain/air";
import { buildPlan } from "../domain/planner";
import {
  confirmTasks,
  exampleRoutine,
  exampleTasks,
  extractionSchema,
  maxTasks,
  type EditableTask,
  type Preferences,
  type Task,
} from "../domain/routine";
import { sampleForecast } from "../domain/sample";
import { ForecastPanel } from "./forecast-panel";
import { PlanComparison } from "./plan-comparison";
import { RoutineEditor } from "./routine-editor";
import { useRegionalForecast } from "./use-regional-forecast";

const samplePreferences = { sensitive: false, carpool: true };

export function Planner() {
  const [city, setCity] = useState<CityId>("delhi");
  const [sample, setSample] = useState(true);
  const [revision, setRevision] = useState(0);
  const [routine, setRoutine] = useState(exampleRoutine);
  const [drafts, setDrafts] = useState<EditableTask[]>([...exampleTasks]);
  const [confirmed, setConfirmed] = useState<Task[] | null>(() =>
    confirmTasks(exampleTasks),
  );
  const [preferences, setPreferences] =
    useState<Preferences>(samplePreferences);
  const [extracting, setExtracting] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [error, setError] = useState("");
  const extraction = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const regional = useRegionalForecast(city, !sample, revision);
  const forecast = sample ? sampleForecast(city) : regional.forecast;
  const plan =
    confirmed && !regional.loading
      ? buildPlan(confirmed, forecast, preferences)
      : null;

  useEffect(() => () => extraction.current?.abort(), []);

  function updateDrafts(update: (current: EditableTask[]) => EditableTask[]) {
    extraction.current?.abort();
    setExtracting(false);
    setAiStatus("");
    setError("");
    setConfirmed(null);
    setDrafts(update);
  }

  function resetExample() {
    updateDrafts(() => [...exampleTasks]);
    setRoutine(exampleRoutine);
    setPreferences(samplePreferences);
    setSample(true);
    setConfirmed(confirmTasks(exampleTasks));
  }

  function useRegional() {
    if (sample) setPreferences((current) => ({ ...current, carpool: false }));
    setSample(false);
    setRevision((value) => value + 1);
  }

  function onCity(next: CityId) {
    setCity(next);
    setRevision((value) => value + 1);
  }

  function nextId() {
    sequence.current += 1;
    return `task-${sequence.current}`;
  }

  function confirm() {
    try {
      setConfirmed(confirmTasks(drafts));
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Review your activities.",
      );
      setConfirmed(null);
    }
  }

  async function extractRoutine() {
    extraction.current?.abort();
    const controller = new AbortController();
    extraction.current = controller;
    setExtracting(true);
    setAiStatus("");
    setError("");
    try {
      const response = await fetch("/api/routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routine: routine.trim() }),
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Unable to extract activities.");
      const result = extractionSchema.parse(body);
      if (!result.tasks.length)
        throw new Error("No activities were extracted.");
      if (controller.signal.aborted) return;
      setDrafts(result.tasks.map((task) => ({ ...task, id: nextId() })));
      setConfirmed(null);
      setAiStatus("Activities extracted. Review and compare your plans.");
    } catch (reason) {
      if (!controller.signal.aborted) {
        setAiStatus(
          `Error: ${reason instanceof Error ? reason.message : "Unable to extract activities. Use the editor below."}`,
        );
      }
    } finally {
      if (extraction.current === controller) {
        extraction.current = null;
        setExtracting(false);
      }
    }
  }

  return (
    <>
      <a className="skip-link" href="#content">
        Skip to planner
      </a>
      <header className="masthead">
        <div className="site-width masthead-inner">
          <Link className="brand" href="/" aria-label="SmogShift home">
            <span>
              <Wind size={23} aria-hidden />
            </span>
            SmogShift
          </Link>
          <span className="header-context">Delhi-NCR air planner</span>
        </div>
      </header>
      <main className="site-width" id="content" tabIndex={-1}>
        <div className="intro">
          <div>
            <h1>Plan around the smog.</h1>
            <p>
              Build a day with fewer high-pollution minutes and fewer
              unnecessary car trips.
            </p>
          </div>
          <button
            className="button secondary example-button"
            type="button"
            onClick={resetExample}
          >
            <RotateCcw size={17} aria-hidden /> Load example routine
          </button>
        </div>
        <ForecastPanel
          city={city}
          forecast={forecast}
          loading={regional.loading}
          error={regional.error}
          sample={sample}
          onCity={onCity}
          onRegional={useRegional}
          onSample={() => setSample(true)}
        />
        {!sample && !regional.error && (
          <button
            className="text-button sample-link"
            type="button"
            onClick={() => setSample(true)}
          >
            Use sample forecast
          </button>
        )}
        <div className="planner-grid">
          <RoutineEditor
            routine={routine}
            drafts={drafts}
            preferences={preferences}
            extracting={extracting}
            aiStatus={aiStatus}
            error={error}
            onRoutine={setRoutine}
            onExtract={() => {
              void extractRoutine();
            }}
            onEdit={(id, changes) =>
              updateDrafts((current) =>
                current.map((item) =>
                  item.id === id ? { ...item, ...changes } : item,
                ),
              )
            }
            onAdd={() => {
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
            }}
            onRemove={(id) =>
              updateDrafts((current) =>
                current.filter((task) => task.id !== id),
              )
            }
            onPreferences={setPreferences}
            onConfirm={confirm}
          />
          <PlanComparison
            plan={plan}
            sample={sample}
            forecastAvailable={Boolean(forecast)}
          />
        </div>
      </main>
      <footer className="site-width footer">
        <span>Air-quality planning for households in Delhi-NCR</span>
        <a href="https://ews.tropmet.res.in/">
          Official Delhi air bulletin <ArrowUpRight size={14} aria-hidden />
        </a>
        <a href="https://ncdc.mohfw.gov.in/uploads/pdf/air7.pdf">
          India NCDC guidance <ArrowUpRight size={14} aria-hidden />
        </a>
      </footer>
    </>
  );
}
