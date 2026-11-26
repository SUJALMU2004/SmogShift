"use client";

import { useEffect, useRef, useState } from "react";
import {
  extractionSchema,
  routineRequest,
  type TaskDraft,
} from "../domain/routine";
import type { Messages } from "../i18n/messages";

type Failure = "unavailable" | "busy" | "empty" | "invalid";
type Outcome = "ready" | "incomplete" | Failure;
type Submission = { tasks: TaskDraft[] } | { failure: Failure };
export type ExtractionStatus = { kind: "success" | "error"; message: string };

function feedback(
  outcome: Outcome | null,
  text: Messages,
): ExtractionStatus | null {
  switch (outcome) {
    case "ready":
      return { kind: "success", message: text.extracted };
    case "incomplete":
      return { kind: "success", message: text.needsConfirm };
    case "busy":
      return { kind: "error", message: text.aiBusy };
    case "empty":
      return { kind: "error", message: text.aiEmpty };
    case "invalid":
      return { kind: "error", message: text.aiInvalid };
    case "unavailable":
      return { kind: "error", message: text.aiUnavailable };
    case null:
      return null;
  }
}

function failureFor(status: number): Failure {
  if (status === 429) return "busy";
  if (status === 422) return "empty";
  if (status === 400 || status === 413) return "invalid";
  return "unavailable";
}

async function submit(
  routine: string,
  signal: AbortSignal,
): Promise<Submission> {
  try {
    const response = await fetch("/api/routine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routine }),
      signal,
    });
    if (!response.ok) return { failure: failureFor(response.status) };
    const parsed = extractionSchema.safeParse(await response.json());
    if (!parsed.success) return { failure: "unavailable" };
    if (!parsed.data.tasks.length) return { failure: "empty" };
    return { tasks: parsed.data.tasks };
  } catch {
    return { failure: "unavailable" };
  }
}

export function useRoutineExtraction(text: Messages) {
  const [extracting, setExtracting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => active.current?.abort(), []);

  function reset() {
    active.current?.abort();
    active.current = null;
    setExtracting(false);
    setOutcome(null);
  }

  async function extract(
    routine: string,
    onTasks: (tasks: TaskDraft[]) => boolean,
  ) {
    reset();
    const input = routineRequest.safeParse({ routine });
    if (!input.success) {
      setOutcome("invalid");
      return;
    }

    const controller = new AbortController();
    active.current = controller;
    setExtracting(true);
    const result = await submit(input.data.routine, controller.signal);
    if (controller.signal.aborted) return;

    active.current = null;
    setExtracting(false);
    if ("failure" in result) {
      setOutcome(result.failure);
      return;
    }
    setOutcome(onTasks(result.tasks) ? "ready" : "incomplete");
  }

  return {
    extract,
    extracting,
    reset,
    status: feedback(outcome, text),
    needsReview: outcome === "incomplete",
  };
}
