import { ClipboardList, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  activities,
  activityKinds,
  maxTasks,
  travelModes,
  type EditableTask,
  type Preferences,
} from "../domain/routine";

type Props = {
  routine: string;
  drafts: EditableTask[];
  preferences: Preferences;
  extracting: boolean;
  aiStatus: string;
  error: string;
  onRoutine: (routine: string) => void;
  onExtract: () => void;
  onEdit: (id: string, values: Partial<EditableTask>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onPreferences: (preferences: Preferences) => void;
  onConfirm: () => void;
};

const travelLabels = {
  unspecified: "Unspecified",
  car: "Car",
  transit: "Public transit",
  walk: "Walk",
  cycle: "Cycle",
};

export function RoutineEditor(props: Props) {
  const { drafts, preferences } = props;
  return (
    <section className="card editor" aria-labelledby="routine-heading">
      <div className="card-heading">
        <span className="section-icon">
          <ClipboardList size={20} aria-hidden />
        </span>
        <div>
          <h2 id="routine-heading">Your routine</h2>
          <p>Add activities and lock the ones that can’t move.</p>
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          props.onConfirm();
        }}
      >
        <details className="ai-entry">
          <summary>
            <Sparkles size={16} aria-hidden /> Extract activities with Gemini
          </summary>
          <div className="ai-fields">
            <label htmlFor="routine-text">Describe your day</label>
            <textarea
              id="routine-text"
              value={props.routine}
              onChange={(event) => props.onRoutine(event.target.value)}
              maxLength={800}
              rows={3}
              aria-describedby="routine-privacy"
              disabled={props.extracting}
            />
            <p className="subtle" id="routine-privacy">
              This text is sent to Google. Use generic activities and leave out
              names, addresses, and health details.
            </p>
            <button
              className="button secondary"
              type="button"
              onClick={props.onExtract}
              disabled={props.extracting || props.routine.trim().length < 3}
            >
              {props.extracting ? "Extracting…" : "Extract with Gemini"}
            </button>
          </div>
        </details>
        <p className="sr-only" role="status">
          {props.aiStatus && !props.aiStatus.startsWith("Error:")
            ? props.aiStatus
            : ""}
        </p>
        {props.aiStatus.startsWith("Error:") ? (
          <p className="inline-message" role="alert">
            {props.aiStatus.slice(7)}
          </p>
        ) : (
          props.aiStatus && (
            <p className="inline-message success" aria-hidden="true">
              {props.aiStatus}
            </p>
          )
        )}
        <div className="task-list">
          {drafts.map((task, index) => (
            <fieldset className="task" key={task.id}>
              <legend className="sr-only">Activity {index + 1}</legend>
              <div className="task-top">
                <label className="task-kind">
                  <span className="sr-only">Activity type</span>
                  <select
                    value={task.kind}
                    onChange={(event) =>
                      props.onEdit(task.id, {
                        kind: event.target.value as EditableTask["kind"],
                      })
                    }
                  >
                    {activityKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {activities[kind]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => props.onRemove(task.id)}
                  aria-label={`Remove activity ${index + 1}`}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
              <div className="task-fields">
                <label>
                  Start
                  <input
                    type="time"
                    value={task.time ?? ""}
                    onChange={(event) =>
                      props.onEdit(task.id, {
                        time: event.target.value || null,
                      })
                    }
                  />
                </label>
                <label>
                  Minutes
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={task.duration ?? ""}
                    onChange={(event) =>
                      props.onEdit(task.id, {
                        duration:
                          event.target.value === ""
                            ? null
                            : event.target.valueAsNumber,
                      })
                    }
                  />
                </label>
                {task.kind === "school_pickup" && (
                  <label>
                    Travel
                    <select
                      value={task.travel}
                      onChange={(event) =>
                        props.onEdit(task.id, {
                          travel: event.target.value as EditableTask["travel"],
                        })
                      }
                    >
                      {travelModes.map((mode) => (
                        <option key={mode} value={mode}>
                          {travelLabels[mode]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="checkbox lock">
                  <input
                    type="checkbox"
                    checked={task.fixed || task.kind === "school_pickup"}
                    disabled={task.kind === "school_pickup"}
                    onChange={(event) =>
                      props.onEdit(task.id, { fixed: event.target.checked })
                    }
                  />{" "}
                  Fixed time
                </label>
              </div>
            </fieldset>
          ))}
        </div>
        <button
          className="text-button"
          type="button"
          onClick={props.onAdd}
          disabled={drafts.length >= maxTasks || props.extracting}
        >
          <Plus size={17} aria-hidden /> Add activity
        </button>
        <fieldset className="preferences">
          <legend>Household constraints</legend>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={preferences.sensitive}
              onChange={(event) =>
                props.onPreferences({
                  ...preferences,
                  sensitive: event.target.checked,
                })
              }
            />{" "}
            Someone is sensitive to air pollution
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={preferences.carpool}
              onChange={(event) =>
                props.onPreferences({
                  ...preferences,
                  carpool: event.target.checked,
                })
              }
            />{" "}
            Carpool is possible
          </label>
        </fieldset>
        {props.error && (
          <p className="inline-message" role="alert">
            {props.error}
          </p>
        )}
        <button
          className="button primary"
          type="submit"
          disabled={props.extracting}
        >
          Compare plans
        </button>
      </form>
    </section>
  );
}
