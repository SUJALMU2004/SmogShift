import { Trash2 } from "lucide-react";
import {
  activityKinds,
  isFixed,
  maxTaskDuration,
  minTaskDuration,
  travelModes,
  type EditableTask,
  type TaskChange,
} from "../domain/routine";
import type { Messages } from "../i18n/messages";
import { ActivityOptions } from "./activity-options";

type Props = {
  task: EditableTask;
  index: number;
  text: Messages;
  issue?: string;
  onEdit: (changes: TaskChange) => void;
  onAdjust: (changes: TaskChange) => void;
  onRemove: () => void;
};

function TaskHeading({
  task,
  text,
  index,
  onEdit,
  onRemove,
}: Omit<Props, "issue" | "onAdjust">) {
  return (
    <div className="task-top">
      <label className="task-kind">
        <span className="sr-only">{text.activityType}</span>
        <select
          value={task.kind}
          onChange={(event) => {
            const kind = activityKinds.find(
              (value) => value === event.target.value,
            );
            if (kind) onEdit({ kind });
          }}
        >
          {activityKinds.map((kind) => (
            <option key={kind} value={kind}>
              {text.activities[kind]}
            </option>
          ))}
        </select>
      </label>
      <button
        className="icon-button"
        type="button"
        onClick={onRemove}
        aria-label={text.remove(index + 1)}
      >
        <Trash2 size={16} aria-hidden />
      </button>
    </div>
  );
}

function TimingFields({
  task,
  text,
  onEdit,
}: Pick<Props, "task" | "text" | "onEdit">) {
  return (
    <>
      <label>
        {text.start}
        <input
          type="time"
          value={task.time ?? ""}
          aria-invalid={task.time === null || undefined}
          onChange={(event) => onEdit({ time: event.target.value || null })}
        />
        {task.time === null && (
          <span className="field-note">{text.needsTime}</span>
        )}
      </label>
      <label>
        {text.minutes}
        <input
          type="number"
          min={minTaskDuration}
          max={maxTaskDuration}
          value={task.duration ?? ""}
          aria-invalid={task.duration === null || undefined}
          onChange={(event) => {
            const value = event.currentTarget.valueAsNumber;
            onEdit({ duration: Number.isFinite(value) ? value : null });
          }}
        />
        {task.duration === null && (
          <span className="field-note">{text.needsDuration}</span>
        )}
      </label>
    </>
  );
}

function TravelField({
  task,
  text,
  onAdjust,
}: Pick<Props, "task" | "text" | "onAdjust">) {
  return (
    <label>
      {text.travel}
      <select
        value={task.travel}
        onChange={(event) => {
          const travel = travelModes.find(
            (value) => value === event.target.value,
          );
          if (travel) onAdjust({ travel });
        }}
      >
        {travelModes.map((mode) => (
          <option key={mode} value={mode}>
            {text.travelModes[mode]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TaskEditor({
  task,
  index,
  text,
  issue,
  onEdit,
  onAdjust,
  onRemove,
}: Props) {
  const pickup = task.kind === "school_pickup";
  const issueId = `activity-${task.id}-issue`;

  return (
    <fieldset className="task" aria-describedby={issue ? issueId : undefined}>
      <legend className="sr-only">{text.activity(index + 1)}</legend>
      <TaskHeading
        task={task}
        text={text}
        index={index}
        onEdit={onEdit}
        onRemove={onRemove}
      />
      <div className="task-fields">
        <TimingFields task={task} text={text} onEdit={onEdit} />
        {pickup && <TravelField task={task} text={text} onAdjust={onAdjust} />}
        <label className="checkbox lock">
          <input
            type="checkbox"
            checked={isFixed(task)}
            disabled={pickup}
            onChange={(event) => onAdjust({ fixed: event.target.checked })}
          />
          {text.fixed}
        </label>
      </div>
      {!pickup && (
        <ActivityOptions task={task} text={text} onAdjust={onAdjust} />
      )}
      {issue && (
        <p className="inline-message" id={issueId} role="alert">
          {issue}
        </p>
      )}
    </fieldset>
  );
}
