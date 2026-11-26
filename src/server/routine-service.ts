import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { TaskDraft } from "../domain/routine";
import { readGeminiTasks, requestGemini, type GeminiConfig } from "./gemini";
import { HttpError } from "./http";
import { createRequestCache } from "./request-cache";

const attemptsPerMinute = 5;
const timeoutMs = 12_000;
const retryDelayMs = 1000;

function createAttemptBudget(clock: () => number) {
  const timestamps: number[] = [];
  return function reserve(): boolean {
    const now = clock();
    while ((timestamps[0] ?? Infinity) <= now - 60_000) timestamps.shift();
    if (timestamps.length >= attemptsPerMinute) return false;
    timestamps.push(now);
    return true;
  };
}

/** Limit provider attempts and cache only validated structured drafts. */
export function createRoutineExtractor(
  fetcher: typeof fetch = fetch,
  clock = Date.now,
) {
  const reserve = createAttemptBudget(clock);
  const get = createRequestCache<string, TaskDraft[]>({
    maxEntries: 32,
    ttlMs: 5 * 60_000,
    clock,
  });

  async function extract(routine: string, config: GeminiConfig) {
    if (!reserve())
      throw new HttpError(
        429,
        "The AI limit was reached. Try again in a minute or add activities manually.",
      );

    const signal = AbortSignal.timeout(timeoutMs);
    const request = () => requestGemini(fetcher, routine, config, signal);
    let response = await request();
    if (response.status === 503) {
      await response.body?.cancel().catch(() => undefined);
      // A deadline during backoff leaves the original unavailable response.
      await delay(retryDelayMs, undefined, { signal }).catch(() => undefined);
      if (!signal.aborted && reserve()) response = await request();
    }
    return readGeminiTasks(response);
  }

  return async (
    routine: string,
    { key, model }: { key: string | undefined; model: string },
  ): Promise<TaskDraft[]> => {
    if (!key)
      throw new HttpError(
        503,
        "Gemini is unavailable. Add your activities manually.",
      );

    const hash = createHash("sha256")
      .update(model)
      .update("\0")
      .update(routine)
      .digest("hex");
    return get(hash, () => extract(routine, { key, model }));
  };
}
