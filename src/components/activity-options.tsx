import { SlidersHorizontal } from "lucide-react";
import {
  isFixed,
  isOutdoor,
  isRequired,
  sensitivityModes,
  type EditableTask,
  type TaskChange,
} from "../domain/routine";
import type { Messages } from "../i18n/messages";

type Props = {
  task: EditableTask;
  text: Messages;
  onAdjust: (changes: TaskChange) => void;
};

function MoveWindowFields({ task, text, onAdjust }: Props) {
  const id = `window-${task.id}`;
  const fields = [
    { key: "earliestStart", label: text.earliest },
    { key: "latestEnd", label: text.latest },
  ] as const;

  return (
    <>
      <div className="window-fields">
        {fields.map(({ key, label }) => (
          <label key={key}>
            {label}
            <input
              type="time"
              value={task[key] ?? ""}
              aria-describedby={id}
              onChange={(event) =>
                onAdjust({ [key]: event.target.value || null })
              }
            />
          </label>
        ))}
      </div>
      <p className="subtle" id={id}>
        {text.windowHint}
      </p>
    </>
  );
}

function OutdoorOptions({ task, text, onAdjust }: Props) {
  return (
    <>
      <label>
        {text.sensitivity}
        <select
          value={task.sensitivity ?? "household"}
          onChange={(event) => {
            const sensitivity = sensitivityModes.find(
              (value) => value === event.target.value,
            );
            if (sensitivity) onAdjust({ sensitivity });
          }}
        >
          {sensitivityModes.map((mode) => (
            <option key={mode} value={mode}>
              {text.sensitivityModes[mode]}
            </option>
          ))}
        </select>
      </label>
      {!isFixed(task) && (
        <MoveWindowFields task={task} text={text} onAdjust={onAdjust} />
      )}
      {task.kind === "outdoor_exercise" && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={task.indoorAvailable ?? false}
            onChange={(event) =>
              onAdjust({ indoorAvailable: event.target.checked })
            }
          />
          {text.indoorAvailable}
        </label>
      )}
    </>
  );
}

export function ActivityOptions({ task, text, onAdjust }: Props) {
  return (
    <details className="activity-options">
      <summary>
        <SlidersHorizontal size={14} aria-hidden /> {text.activityOptions}
      </summary>
      <div className="option-fields">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={isRequired(task)}
            onChange={(event) => onAdjust({ required: event.target.checked })}
          />
          {text.required}
        </label>
        {isOutdoor(task) && (
          <OutdoorOptions task={task} text={text} onAdjust={onAdjust} />
        )}
      </div>
    </details>
  );
}
