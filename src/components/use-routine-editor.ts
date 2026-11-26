import { useMemo, useRef, useState } from "react";
import {
  exampleRoutines,
  exampleTasks,
  maxTasks,
  reviewTasks,
  type EditableTask,
  type TaskChange,
} from "../domain/routine";
import { messages, type Locale } from "../i18n/messages";
import { useRoutineExtraction } from "./use-routine-extraction";

type ReviewState = { drafts: EditableTask[]; confirmed: boolean };

export function useRoutineEditor(locale: Locale) {
  const [routine, setRoutine] = useState(exampleRoutines[locale]);
  const [{ drafts, confirmed }, setReview] = useState<ReviewState>(() => ({
    drafts: [...exampleTasks],
    confirmed: true,
  }));
  const reviewed = useMemo(() => reviewTasks(drafts), [drafts]);
  const assistant = useRoutineExtraction(messages[locale]);
  const sequence = useRef(0);

  function nextId() {
    sequence.current += 1;
    return `task-${sequence.current}`;
  }

  function updateDrafts(
    update: (drafts: EditableTask[]) => EditableTask[],
    requireConfirmation: boolean,
  ) {
    assistant.reset();
    setReview((current) => ({
      drafts: update(current.drafts),
      confirmed: !requireConfirmation && current.confirmed,
    }));
  }

  function changeTask(
    id: string,
    change: TaskChange,
    requireConfirmation: boolean,
  ) {
    updateDrafts(
      (tasks) =>
        tasks.map((task) => (task.id === id ? { ...task, ...change } : task)),
      requireConfirmation,
    );
  }

  function addTask() {
    if (drafts.length >= maxTasks) return;
    const draft: EditableTask = {
      id: nextId(),
      kind: "other",
      time: null,
      duration: null,
      fixed: true,
      travel: "unspecified",
    };
    updateDrafts(
      (tasks) => (tasks.length < maxTasks ? [...tasks, draft] : tasks),
      true,
    );
  }

  function extractRoutine() {
    void assistant.extract(routine, (tasks) => {
      const activities = tasks.map((task) => ({ ...task, id: nextId() }));
      setReview({ drafts: activities, confirmed: false });
      return reviewTasks(activities).ok;
    });
  }

  function loadExample() {
    assistant.reset();
    setRoutine(exampleRoutines[locale]);
    setReview({ drafts: [...exampleTasks], confirmed: true });
  }

  function translateExample(next: Locale) {
    setRoutine((current) =>
      current === exampleRoutines[locale] ? exampleRoutines[next] : current,
    );
  }

  return {
    confirmed,
    reviewed,
    loadExample,
    translateExample,
    form: {
      drafts,
      routine,
      aiStatus: assistant.status,
      extracting: assistant.extracting,
      issue:
        (confirmed || assistant.needsReview) && !reviewed.ok
          ? reviewed.issue
          : null,
      onRoutine: setRoutine,
      onExtract: extractRoutine,
      onEdit: (id: string, change: TaskChange) => changeTask(id, change, true),
      onAdjust: (id: string, change: TaskChange) =>
        changeTask(id, change, false),
      onAdd: addTask,
      onRemove: (id: string) =>
        updateDrafts((tasks) => tasks.filter((task) => task.id !== id), true),
      onConfirm: () =>
        setReview((current) => ({ ...current, confirmed: true })),
    },
  };
}
