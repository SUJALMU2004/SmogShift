import { routineRequest } from "../domain/routine";
import { createRoutineExtractor, defaultModel } from "./gemini";
import { errorResponse, HttpError, readJson } from "./http";

export function createRoutineHandler(
  extract = createRoutineExtractor(),
  getConfig = () => ({
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || defaultModel,
  }),
) {
  return async function POST(request: Request) {
    try {
      const origin = request.headers.get("origin");
      const host = request.headers.get("host") || new URL(request.url).host;
      const sameOrigin = !origin || URL.parse(origin)?.host === host;
      if (
        request.headers.get("sec-fetch-site") === "cross-site" ||
        !sameOrigin
      ) {
        throw new HttpError(403, "Requests must come from SmogShift.");
      }
      const data = routineRequest.safeParse(await readJson(request, 4096));
      if (!data.success)
        throw new HttpError(
          400,
          "Enter a routine between 3 and 800 characters.",
        );
      const tasks = await extract(data.data.routine, getConfig());
      return Response.json(
        { tasks },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      return errorResponse(
        error,
        "The routine could not be read. Add your activities manually.",
      );
    }
  };
}
