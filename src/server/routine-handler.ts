import { routineRequest } from "../domain/routine";
import { defaultModel } from "./gemini";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
  requireSameOrigin,
} from "./http";
import { createRoutineExtractor } from "./routine-service";

export function createRoutineHandler(
  extract = createRoutineExtractor(),
  getConfig = () => ({
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || defaultModel,
  }),
) {
  return async function POST(request: Request) {
    try {
      requireSameOrigin(request);
      const data = routineRequest.safeParse(await readJson(request, 4096));
      if (!data.success)
        throw new HttpError(
          400,
          "Enter a routine between 3 and 800 characters.",
        );
      const tasks = await extract(data.data.routine, getConfig());
      return jsonResponse({ tasks });
    } catch (error) {
      return errorResponse(
        error,
        "The routine could not be read. Add your activities manually.",
      );
    }
  };
}
