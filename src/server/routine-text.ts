const hindiHourBeforeDuration =
  /(?<![\p{L}\p{N}:])([\d०-९]{1,2}\s+(?:बजे|baje))\s+(?=[\d०-९]{1,3}\s*(?:मिनट|minutes?|mins?)(?![\p{L}\p{M}\p{N}]))/giu;

/** Delimit adjacent clock and duration phrases before sending the routine to Gemini. */
export function separateClockAndDuration(routine: string): string {
  return routine.replace(hindiHourBeforeDuration, "$1, ");
}
