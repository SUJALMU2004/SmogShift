import { expect, it } from "vitest";
import { createRoutineExtractor, defaultModel } from "../../src/server/gemini";
import { multilingualRoutines } from "../fixtures/routines";

const key = process.env.GEMINI_API_KEY?.trim();
const smokeRoutines = multilingualRoutines.filter(
  ({ name }) => name === "explicit morning with duration",
);
const extract = createRoutineExtractor();

it.skipIf(!key).each(smokeRoutines)(
  "live Gemini · $language",
  async ({ text, expected }) => {
    const tasks = await extract(text, {
      key,
      model: process.env.GEMINI_MODEL || defaultModel,
    });
    expect(tasks).toEqual(expected);
  },
  18_000,
);
