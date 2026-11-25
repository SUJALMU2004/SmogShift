import { expect, it, vi } from "vitest";
import { extractionSchema, reviewTasks } from "../../src/domain/routine";
import { createRoutineExtractor, defaultModel } from "../../src/server/gemini";
import { createRoutineHandler } from "../../src/server/routine-handler";
import { multilingualRoutines } from "../fixtures/routines";

it.each(multilingualRoutines)(
  "$language · $name",
  async ({ text, expected, reviewable }) => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      Response.json({
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [
              { type: "text", text: JSON.stringify({ tasks: expected }) },
            ],
          },
        ],
      }),
    );
    const handle = createRoutineHandler(
      createRoutineExtractor(fetcher),
      () => ({ key: "fixture-key", model: defaultModel }),
    );
    const response = await handle(
      new Request("http://localhost/api/routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routine: text }),
      }),
    );

    expect(response.status).toBe(200);
    const sent = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(sent.input).toBe(text);
    const returned = extractionSchema.parse(await response.json()).tasks;
    expect(returned).toEqual(expected);
    expect(
      reviewTasks(
        returned.map((task, index) => ({ ...task, id: String(index) })),
      ).ok,
    ).toBe(reviewable);
  },
);
