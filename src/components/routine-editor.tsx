import { ArrowDown, ClipboardList, Plus, Sparkles } from "lucide-react";
import {
  maxRoutineLength,
  maxTasks,
  minRoutineLength,
  type EditableTask,
  type Preferences,
  type RoutineIssue,
  type TaskChange,
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
  onEdit: (id: string, values: TaskChange) => void;
  onAdjust: (id: string, values: TaskChange) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onPreferences: (preferences: Preferences) => void;
  onConfirm: () => void;
};

function draftIssue(
  issue: RoutineIssue | null,
  index: number,
  text: Messages,
): string | undefined {
  if (!issue || issue.code === "count" || issue.index !== index)
    return undefined;
  switch (issue.code) {
    case "activity":
      return text.issueActivity(index + 1);
    case "window":
      return text.issueWindow(index + 1);
    case "conflict":
      return text.issueConflict(index + 1);
  }
}

function RoutineInput({
  text,
  routine,
  extracting,
  aiStatus,
  onRoutine,
  onExtract,
}: Pick<
  Props,
  "text" | "routine" | "extracting" | "aiStatus" | "onRoutine" | "onExtract"
>) {
  const success = aiStatus?.kind === "success" ? aiStatus.message : "";
  return (
    <>
      <details className="ai-entry">
        <summary>
          <Sparkles size={16} aria-hidden /> {text.extractDetails}
        </summary>
        <div className="ai-fields">
          <label htmlFor="routine-text">{text.describe}</label>
          <textarea
            id="routine-text"
            value={routine}
            maxLength={maxRoutineLength}
            rows={3}
            aria-describedby="routine-languages routine-privacy"
            disabled={extracting}
            onChange={(event) => onRoutine(event.target.value)}
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
            disabled={extracting || routine.trim().length < minRoutineLength}
          >
            {extracting ? text.extracting : text.extract}
          </button>
        </div>
      </details>
      <p className="sr-only" role="status">
        {success}
      </p>
      {aiStatus?.kind === "error" && (
        <p className="inline-message" role="alert">
          {aiStatus.message}
        </p>
      )}
      {success && (
        <p className="inline-message success" aria-hidden="true">
          {success}
        </p>
      )}
    </>
  );
}

function HouseholdOptions({
  text,
  preferences,
  onPreferences,
}: Pick<Props, "text" | "preferences" | "onPreferences">) {
  return (
    <fieldset className="preferences">
      <legend>{text.household}</legend>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={preferences.sensitive}
          onChange={(event) =>
            onPreferences({ ...preferences, sensitive: event.target.checked })
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
  );
}

export function RoutineEditor(props: Props) {
  const {
    text,
    drafts,
    issue,
    extracting,
    hasPlan,
    onConfirm,
    onEdit,
    onAdjust,
    onAdd,
    onRemove,
  } = props;
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
        <RoutineInput
          text={text}
          routine={props.routine}
          extracting={extracting}
          aiStatus={props.aiStatus}
          onRoutine={props.onRoutine}
          onExtract={props.onExtract}
        />
        <div className="task-list">
          {drafts.map((task, index) => (
            <TaskEditor
              key={task.id}
              task={task}
              index={index}
              text={text}
              issue={draftIssue(issue, index, text)}
              onEdit={(change) => onEdit(task.id, change)}
              onAdjust={(change) => onAdjust(task.id, change)}
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
        <HouseholdOptions
          text={text}
          preferences={props.preferences}
          onPreferences={props.onPreferences}
        />
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
