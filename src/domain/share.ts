import { z } from "zod";
import { formatLocales, messages, type Locale } from "../i18n/messages";
import type { Forecast } from "./air";
import type { Decision } from "./planner";
import { timeSchema } from "./routine";

export type PickupProposal = { message: string; whatsappUrl: string };
const planDateSchema = z.iso.date();

/** Derive a shareable invitation from the current carpool decision and its plan date. */
export function buildPickupProposal(
  decision: Decision,
  forecast: Pick<Forecast, "source" | "date"> | null,
  locale: Locale,
): PickupProposal | null {
  if (
    decision.kind !== "carpool" ||
    decision.original.kind !== "school_pickup" ||
    decision.original.travel !== "car" ||
    !decision.time ||
    !timeSchema.safeParse(decision.time).success ||
    decision.time !== decision.original.time
  ) {
    return null;
  }

  const text = messages[locale].share;
  const date = planDateSchema.safeParse(forecast?.date);
  const time = decision.time;
  let message: string;
  if (forecast?.source === "sample") {
    message = text.demoMessage(time);
  } else if (date.success) {
    // The feed supplies an IST calendar date. Format the date itself without shifting it.
    const day = new Intl.DateTimeFormat(formatLocales[locale], {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(`${date.data}T00:00:00Z`));
    message = text.datedMessage(day, time);
  } else {
    message = text.undatedMessage(time);
  }

  return {
    message,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`,
  };
}
