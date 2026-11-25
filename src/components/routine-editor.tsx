import { ArrowDown, ClipboardList, Plus, Sparkles } from "lucide-react";
import {
  maxTasks,
  type EditableTask,
  type Preferences,
  type RoutineIssue,
} from "../domain/routine";
import type { Messages } from "../i18n/messages";
import { TaskEditor } from "./task-editor";
import type { ExtractionStatus } from "./use-routine-extraction";

type Props = {
  text: Messages;
  routine: string;
  drafts: EditableTask[];
  preferences: Preferences;
  extracting: boolean;
  hasPlan: boolean;
  aiStatus: ExtractionStatus | null;
  issue: RoutineIssue | null;
  onRoutine: (routine: string) => void;
  onExtract: () => void;
  onEdit: (id: string, values: Partial<EditableTask>) => void;
  onAdjust: (id: string, values: Partial<EditableTask>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onPreferences: (preferences: Preferences) => void;
  onConfirm: () => void;
};

function issueMessage(
  issue: Exclude<RoutineIssue, { code: "count" }>,
  text: Messages,
) {
  const index = issue.index + 1;
  switch (issue.code) {
    case "activity":
      return text.issueActivity(index);
    case "window":
      return text.issueWindow(index);
    case "conflict":
      return text.issueConflict(index);
  }
}

export function RoutineEditor({
  text,
  drafts,
  preferences,
  issue,
  aiStatus,
  extracting,
  hasPlan,
  routine,
  onConfirm,
  onRoutine,
  onExtract,
  onEdit,
  onAdjust,
  onAdd,
  onRemove,
  onPreferences,
}: Props) {
  return (
    <section className="card editor" aria-labelledby="routine-heading">
      <div className="card-heading">
        <span className="section-icon">
          <ClipboardList size={20} aria-hidden />
        </span>
        <div>
          <h2 id="routine-heading">{text.routine}</h2>
          <p>{text.routineBody}</p>
        </div>
      </div>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <details className="ai-entry">
          <summary>
            <Sparkles size={16} aria-hidden /> {text.extractDetails}
          </summary>
          <div className="ai-fields">
            <label htmlFor="routine-text">{text.describe}</label>
            <textarea
              id="routine-text"
              value={routine}
              onChange={(event) => onRoutine(event.target.value)}
              maxLength={800}
              rows={3}
              aria-describedby="routine-languages routine-privacy"
              disabled={extracting}
            />
            <p className="subtle" id="routine-languages">
              {text.inputLanguages}
            </p>
            <p className="subtle" id="routine-privacy">
              {text.privacy}
            </p>
            <button
              className="button secondary"
              type="button"
              onClick={onExtract}
              disabled={extracting || routine.trim().length < 3}
            >
              {extracting ? text.extracting : text.extract}
            </button>
          </div>
        </details>
        <p className="sr-only" role="status">
          {aiStatus?.kind === "success" ? aiStatus.message : ""}
        </p>
        {aiStatus?.kind === "error" && (
          <p className="inline-message" role="alert">
            {aiStatus.message}
          </p>
        )}
        {aiStatus?.kind === "success" && (
          <p className="inline-message success" aria-hidden="true">
            {aiStatus.message}
          </p>
        )}

        <div className="task-list">
          {drafts.map((task, index) => (
            <TaskEditor
              key={task.id}
              task={task}
              index={index}
              text={text}
              issue={
                issue && issue.code !== "count" && issue.index === index
                  ? issueMessage(issue, text)
                  : undefined
              }
              onEdit={(changes) => onEdit(task.id, changes)}
              onAdjust={(changes) => onAdjust(task.id, changes)}
              onRemove={() => onRemove(task.id)}
            />
          ))}
        </div>
        <button
          className="text-button"
          type="button"
          onClick={onAdd}
          disabled={drafts.length >= maxTasks || extracting}
        >
          <Plus size={17} aria-hidden /> {text.add}
        </button>
        <fieldset className="preferences">
          <legend>{text.household}</legend>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={preferences.sensitive}
              onChange={(event) =>
                onPreferences({
                  ...preferences,
                  sensitive: event.target.checked,
                })
              }
            />
            {text.householdSensitive}
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={preferences.carpool}
              onChange={(event) =>
                onPreferences({ ...preferences, carpool: event.target.checked })
              }
            />
            {text.carpoolPossible}
          </label>
        </fieldset>
        {issue?.code === "count" && (
          <p className="inline-message" role="alert">
            {text.issueCount}
          </p>
        )}
        <div className="editor-actions">
          <button
            className="button primary"
            type="submit"
            disabled={extracting}
          >
            {text.compare}
          </button>
          {hasPlan && (
            <a className="button secondary" href="#comparison-heading">
              {text.jumpToPlan} <ArrowDown size={16} aria-hidden />
            </a>
          )}
        </div>
      </form>
    </section>
  );
}
