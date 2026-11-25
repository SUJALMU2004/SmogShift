"use client";

import { useEffect, useRef, useState } from "react";
import {
  extractionSchema,
  routineRequest,
  type TaskDraft,
} from "../domain/routine";
import type { Messages } from "../i18n/messages";

type Outcome =
  "ready" | "incomplete" | "unavailable" | "busy" | "empty" | "invalid";
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
    default:
      return null;
  }
}

function failure(status: number): Outcome {
  if (status === 429) return "busy";
  if (status === 422) return "empty";
  if (status === 400 || status === 413) return "invalid";
  return "unavailable";
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
    try {
      const response = await fetch("/api/routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (!controller.signal.aborted) setOutcome(failure(response.status));
        return;
      }
      const result = extractionSchema.parse(await response.json());
      if (controller.signal.aborted) return;
      if (!result.tasks.length) {
        setOutcome("empty");
        return;
      }
      setOutcome(onTasks(result.tasks) ? "ready" : "incomplete");
    } catch {
      if (!controller.signal.aborted) setOutcome("unavailable");
    } finally {
      if (active.current === controller) {
        active.current = null;
        if (!controller.signal.aborted) setExtracting(false);
      }
    }
  }

  return {
    extract,
    extracting,
    reset,
    status: feedback(outcome, text),
    needsReview: outcome === "incomplete",
  };
}
