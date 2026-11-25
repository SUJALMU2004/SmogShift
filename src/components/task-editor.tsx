import { SlidersHorizontal, Trash2 } from "lucide-react";
import {
  activityKinds,
  isFixed,
  isOutdoor,
  isRequired,
  sensitivityModes,
  travelModes,
  type EditableTask,
} from "../domain/routine";
import type { Messages } from "../i18n/messages";

type Props = {
  task: EditableTask;
  index: number;
  text: Messages;
  issue?: string;
  onEdit: (changes: Partial<EditableTask>) => void;
  onAdjust: (changes: Partial<EditableTask>) => void;
  onRemove: () => void;
};

export function TaskEditor({
  task,
  index,
  text,
  issue,
  onEdit,
  onAdjust,
  onRemove,
}: Props) {
  const fixed = isFixed(task);
  const pickup = task.kind === "school_pickup";
  const outdoor = isOutdoor(task);
  const issueId = `activity-${task.id}-issue`;
  const errorDescription = issue ? issueId : undefined;

  return (
    <fieldset className="task" aria-describedby={errorDescription}>
      <legend className="sr-only">{text.activity(index + 1)}</legend>
      <div className="task-top">
        <label className="task-kind">
          <span className="sr-only">{text.activityType}</span>
          <select
            value={task.kind}
            onChange={(event) =>
              onEdit({ kind: event.target.value as EditableTask["kind"] })
            }
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
      <div className="task-fields">
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
            min={1}
            max={240}
            value={task.duration ?? ""}
            aria-invalid={task.duration === null || undefined}
            onChange={(event) =>
              onEdit({
                duration: Number.isFinite(event.target.valueAsNumber)
                  ? event.target.valueAsNumber
                  : null,
              })
            }
          />
          {task.duration === null && (
            <span className="field-note">{text.needsDuration}</span>
          )}
        </label>
        {pickup && (
          <label>
            {text.travel}
            <select
              value={task.travel}
              onChange={(event) =>
                onAdjust({
                  travel: event.target.value as EditableTask["travel"],
                })
              }
            >
              {travelModes.map((mode) => (
                <option key={mode} value={mode}>
                  {text.travelModes[mode]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="checkbox lock">
          <input
            type="checkbox"
            checked={fixed}
            disabled={pickup}
            onChange={(event) => onAdjust({ fixed: event.target.checked })}
          />
          {text.fixed}
        </label>
      </div>

      {!pickup && (
        <details className="activity-options">
          <summary>
            <SlidersHorizontal size={14} aria-hidden /> {text.activityOptions}
          </summary>
          <div className="option-fields">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={isRequired(task)}
                onChange={(event) =>
                  onAdjust({ required: event.target.checked })
                }
              />
              {text.required}
            </label>
            {outdoor && (
              <>
                <label>
                  {text.sensitivity}
                  <select
                    value={task.sensitivity ?? "household"}
                    onChange={(event) =>
                      onAdjust({
                        sensitivity: event.target
                          .value as EditableTask["sensitivity"],
                      })
                    }
                  >
                    {sensitivityModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {text.sensitivityModes[mode]}
                      </option>
                    ))}
                  </select>
                </label>
                {!fixed && (
                  <>
                    <div className="window-fields">
                      <label>
                        {text.earliest}
                        <input
                          type="time"
                          value={task.earliestStart ?? ""}
                          aria-describedby={`window-${task.id}`}
                          onChange={(event) =>
                            onAdjust({
                              earliestStart: event.target.value || null,
                            })
                          }
                        />
                      </label>
                      <label>
                        {text.latest}
                        <input
                          type="time"
                          value={task.latestEnd ?? ""}
                          aria-describedby={`window-${task.id}`}
                          onChange={(event) =>
                            onAdjust({ latestEnd: event.target.value || null })
                          }
                        />
                      </label>
                    </div>
                    <p className="subtle" id={`window-${task.id}`}>
                      {text.windowHint}
                    </p>
                  </>
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
            )}
          </div>
        </details>
      )}
      {issue && (
        <p className="inline-message" id={issueId} role="alert">
          {issue}
        </p>
      )}
    </fieldset>
  );
}
