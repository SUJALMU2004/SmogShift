import { z } from "zod";

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

export const routineRequest = z.strictObject({
  routine: z.string().trim().min(3).max(800),
});
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const durationSchema = z.number().int().min(1).max(240);

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

export type TaskDraft = z.infer<typeof taskDraftSchema>;
export type EditableTask = z.infer<typeof editableTaskSchema>;
export type Task = EditableTask & { time: string; duration: number };
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

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  return [Math.floor(minutes / 60), minutes % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

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
    end: task.latestEnd ? timeToMinutes(task.latestEnd) : 1440,
  };
}

/** Validate the whole baseline before the planner uses it as a single schedule. */
export function reviewTasks(drafts: readonly EditableTask[]): Review {
  if (!drafts.length || drafts.length > maxTasks)
    return { ok: false, issue: { code: "count" } };

  const tasks: Task[] = [];
  const ids = new Set<string>();
  for (const [index, draft] of drafts.entries()) {
    const candidate = editableTaskSchema.safeParse(draft);
    if (!candidate.success)
      return { ok: false, issue: { code: "activity", index } };
    const { id, time, duration } = candidate.data;
    if (
      time === null ||
      duration === null ||
      timeToMinutes(time) + duration > 1440 ||
      ids.has(id)
    ) {
      return { ok: false, issue: { code: "activity", index } };
    }
    if (isOutdoor(draft) && !isFixed(draft)) {
      const window = explicitWindow(draft);
      if (window.end - window.start < duration)
        return { ok: false, issue: { code: "window", index } };
    }
    ids.add(id);
    tasks.push({ ...candidate.data, time, duration });
  }

  const slots = tasks
    .map((task, index) => ({
      index,
      start: timeToMinutes(task.time),
      duration: task.duration,
    }))
    .sort((a, b) => a.start - b.start);
  for (const [index, slot] of slots.entries()) {
    const next = slots[index + 1];
    if (next && slot.start + slot.duration > next.start) {
      return { ok: false, issue: { code: "conflict", index: next.index } };
    }
  }
  return { ok: true, tasks };
}
