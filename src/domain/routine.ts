import { z } from "zod";

export const activities = {
  outdoor_exercise: "Outdoor exercise",
  outdoor_errand: "Outdoor errand",
  school_pickup: "School pickup",
  burn_incense: "Burn incense",
  dry_sweeping: "Dry sweeping",
  other: "Other commitment",
} as const;

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
export const maxTasks = 10;

export const routineRequest = z.strictObject({
  routine: z.string().trim().min(3).max(800),
});
export const taskDraftSchema = z.strictObject({
  kind: z.enum(activityKinds),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  duration: z.number().int().min(1).max(240).nullable(),
  fixed: z.boolean(),
  travel: z.enum(travelModes),
});
export const extractionSchema = z.strictObject({
  tasks: z.array(taskDraftSchema).max(maxTasks),
});

export type TaskDraft = z.infer<typeof taskDraftSchema>;
export type Task = TaskDraft & { id: string; time: string; duration: number };
export type EditableTask = TaskDraft & { id: string };
export type Preferences = { sensitive: boolean; carpool: boolean };

export const exampleRoutine =
  "30-minute outdoor walk at 7 AM. School pickup by car at 3 PM for 25 minutes, fixed. Burn incense at 7 PM for 10 minutes.";

export const exampleTasks: readonly EditableTask[] = [
  {
    id: "walk",
    kind: "outdoor_exercise",
    time: "07:00",
    duration: 30,
    fixed: false,
    travel: "unspecified",
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
    id: "incense",
    kind: "burn_incense",
    time: "19:00",
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
  const hours = Math.floor(minutes / 60);
  return [hours, minutes % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function confirmTasks(drafts: readonly EditableTask[]): Task[] {
  if (!drafts.length || drafts.length > maxTasks) {
    throw new Error("Add between 1 and 10 activities.");
  }

  return drafts.map(({ id, ...draft }, index) => {
    const parsed = taskDraftSchema.safeParse(draft);
    if (
      !parsed.success ||
      parsed.data.time === null ||
      parsed.data.duration === null ||
      timeToMinutes(parsed.data.time) + parsed.data.duration > 1440
    ) {
      throw new Error(
        `Activity ${index + 1} needs a valid start and a duration of 1–240 minutes ending by midnight.`,
      );
    }
    const { time, duration, ...rest } = parsed.data;
    return { id, time, duration, ...rest };
  });
}
