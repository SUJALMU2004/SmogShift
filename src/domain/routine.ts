import { z } from "zod";
import {
  activitySlot,
  minutesPerDay,
  overlaps,
  timeSchema,
  timeToMinutes,
} from "./slots";

export const activityKinds = [
  "outdoor_exercise",
  "outdoor_errand",
  "school_pickup",
  "burn_incense",
  "dry_sweeping",
  "other",
] as const;
export const travelModes = [
  "unspecified",
  "car",
  "transit",
  "walk",
  "cycle",
] as const;
export const sensitivityModes = ["household", "general", "sensitive"] as const;
export const maxTasks = 10;
export const minRoutineLength = 3;
export const maxRoutineLength = 800;
export const minTaskDuration = 1;
export const maxTaskDuration = 240;

export const routineRequest = z.strictObject({
  routine: z.string().trim().min(minRoutineLength).max(maxRoutineLength),
});
const durationSchema = z
  .number()
  .int()
  .min(minTaskDuration)
  .max(maxTaskDuration);

// Only these fields may cross the Gemini boundary.
export const taskDraftSchema = z.strictObject({
  kind: z.enum(activityKinds),
  time: timeSchema.nullable(),
  duration: durationSchema.nullable(),
  fixed: z.boolean(),
  travel: z.enum(travelModes),
  required: z.boolean().optional(),
  earliestStart: timeSchema.nullable().optional(),
  latestEnd: timeSchema.nullable().optional(),
});
export const extractionSchema = z.strictObject({
  tasks: z.array(taskDraftSchema).max(maxTasks),
});

const editableTaskSchema = taskDraftSchema.extend({
  id: z.string().min(1),
  sensitivity: z.enum(sensitivityModes).optional(),
  indoorAvailable: z.boolean().optional(),
});
const confirmedTaskSchema = editableTaskSchema.extend({
  time: timeSchema,
  duration: durationSchema,
});

export type TaskDraft = z.infer<typeof taskDraftSchema>;
export type EditableTask = z.infer<typeof editableTaskSchema>;
export type TaskChange = Partial<Omit<EditableTask, "id">>;
export type Task = z.infer<typeof confirmedTaskSchema>;
export type Preferences = { sensitive: boolean; carpool: boolean };
export type RoutineIssue =
  | { code: "count" }
  | {
      code: "activity" | "window" | "conflict";
      index: number;
    };
type Review = { ok: true; tasks: Task[] } | { ok: false; issue: RoutineIssue };

export const exampleRoutines = {
  en: "30-minute outdoor walk at 7 AM, can move it to 10–11 AM. School pickup by car at 3 PM for 25 minutes, fixed. Dry sweep at 6 PM for 10 minutes.",
  hi: "सुबह ७ बजे ३० मिनट टहलना है। इसे सुबह १० से ११ बजे के बीच कर सकते हैं। दोपहर ३ बजे गाड़ी से स्कूल से लेने जाना है, समय तय है, २५ मिनट लगेंगे। शाम ६ बजे १० मिनट झाड़ू लगानी है।",
};
export const exampleTasks: readonly EditableTask[] = [
  {
    id: "walk",
    kind: "outdoor_exercise",
    time: "07:00",
    duration: 30,
    fixed: false,
    travel: "unspecified",
    earliestStart: "10:00",
    latestEnd: "11:00",
    indoorAvailable: true,
  },
  {
    id: "pickup",
    kind: "school_pickup",
    time: "15:00",
    duration: 25,
    fixed: true,
    travel: "car",
  },
  {
    id: "sweeping",
    kind: "dry_sweeping",
    time: "18:00",
    duration: 10,
    fixed: false,
    travel: "unspecified",
  },
];

export function isOutdoor(task: Pick<TaskDraft, "kind">) {
  return task.kind === "outdoor_exercise" || task.kind === "outdoor_errand";
}

export function isFixed(task: Pick<TaskDraft, "kind" | "fixed">) {
  return task.kind === "school_pickup" || task.fixed;
}

export function isRequired(task: Pick<TaskDraft, "kind" | "required">) {
  return (
    task.kind === "school_pickup" || (task.required ?? task.kind === "other")
  );
}

/** An availability window applies to possible moves. The baseline time may be outside it. */
export function explicitWindow(
  task: Pick<TaskDraft, "earliestStart" | "latestEnd">,
) {
  return {
    start: task.earliestStart ? timeToMinutes(task.earliestStart) : 0,
    end: task.latestEnd ? timeToMinutes(task.latestEnd) : minutesPerDay,
  };
}

function activityIssue(task: Task): "activity" | "window" | null {
  if (activitySlot(task).end > minutesPerDay) return "activity";
  if (!isOutdoor(task) || isFixed(task)) return null;
  const { start, end } = explicitWindow(task);
  return end - start < task.duration ? "window" : null;
}

function conflictingIndex(tasks: readonly Task[]): number | undefined {
  const slots = tasks
    .map((task, index) => ({ index, ...activitySlot(task) }))
    .sort((a, b) => a.start - b.start);
  for (const [index, slot] of slots.entries()) {
    const next = slots[index + 1];
    if (next && overlaps(slot, next)) return next.index;
  }
  return undefined;
}

/** Validate the whole baseline before the planner uses it as a single schedule. */
export function reviewTasks(drafts: readonly EditableTask[]): Review {
  if (!drafts.length || drafts.length > maxTasks)
    return { ok: false, issue: { code: "count" } };

  const tasks: Task[] = [];
  const ids = new Set<string>();
  for (const [index, draft] of drafts.entries()) {
    const candidate = confirmedTaskSchema.safeParse(draft);
    if (!candidate.success || ids.has(candidate.data.id))
      return { ok: false, issue: { code: "activity", index } };
    const task = candidate.data;
    const code = activityIssue(task);
    if (code) return { ok: false, issue: { code, index } };
    ids.add(task.id);
    tasks.push(task);
  }

  const index = conflictingIndex(tasks);
  return index === undefined
    ? { ok: true, tasks }
    : { ok: false, issue: { code: "conflict", index } };
}
