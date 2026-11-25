import type { Decision } from "../domain/planner";
import type { Messages } from "../i18n/messages";

function decisionReason(reason: Decision["reason"], text: Messages) {
  switch (reason.code) {
    case "move":
      return text.moveReason(reason.peak, reason.newPeak, reason.cutoff);
    case "below":
      return text.belowReason(reason.peak, reason.cutoff);
    case "lockedHigh":
      return text.lockedHighReason(reason.peak, reason.cutoff);
    case "lockedIndoor":
      return text.lockedIndoorReason(reason.peak, reason.cutoff);
    case "indoor":
      return text.indoorReason(reason.peak, reason.cutoff);
    case "optionalDeferral":
      return text.optionalDeferralReason(reason.peak, reason.cutoff);
    case "requiredReview":
      return text.requiredReviewReason(reason.peak, reason.cutoff);
    default:
      return text[`${reason.code}Reason`];
  }
}

export function decisionCopy(decision: Decision, text: Messages) {
  const activity = text.activities[decision.original.kind];
  let title = activity;
  switch (decision.kind) {
    case "moved":
      title = text.rescheduleTitle(activity);
      break;
    case "indoors":
      title = text.indoorTitle;
      break;
    case "deferred":
      title = text.deferTitle;
      break;
    case "carpool":
      title = text.carpoolTitle;
      break;
    case "review":
      title = text.reviewTitle;
      break;
    case "source":
      title =
        decision.reason.code === "incense" ? text.incenseTitle : text.mopTitle;
      break;
  }
  return {
    title,
    reason: decisionReason(decision.reason, text),
    tag: text.decisionTags[decision.kind],
  };
}
