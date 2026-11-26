import { describe, expect, it, vi } from "vitest";
import { createForecastHandler } from "../../src/server/forecast-handler";
import { createForecastService } from "../../src/server/forecast-service";
import { defaultModel } from "../../src/server/gemini";
import { normalizeForecast } from "../../src/server/open-meteo";
import { createRoutineHandler } from "../../src/server/routine-handler";
import { createRoutineExtractor } from "../../src/server/routine-service";

const now = new Date("2026-01-01T19:00:00Z");
const fixture = {
  timezone: "Asia/Kolkata",
  hourly: {
    time: ["2026-01-02T23:00", "2026-01-03T00:00", "2026-01-03T01:00"],
    us_aqi: [127, 0, 510],
    pm2_5: [22, null, 39],
    pm10: [56, 23, 64],
    ozone: [19, 24, 27],
  },
};
const config = { key: "fixture-key", model: defaultModel };
const tasks = [
  {
    kind: "outdoor_exercise",
    time: "07:00",
    duration: null,
    fixed: false,
    travel: "unspecified",
  },
];
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/routine", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const forecastRequest = (city: string) =>
  new Request(`http://localhost/api/forecast?city=${city}`);

function providerOutput(output: unknown) {
  return Response.json({
    status: "completed",
    steps: [
      { type: "thought" },
      {
        type: "model_output",
        content: [{ type: "text", text: JSON.stringify(output) }],
      },
    ],
  });
}

describe("forecast API with a mocked provider", () => {
  it("uses IST tomorrow, keeps zero and 500+, and preserves missing fields", () => {
    const forecast = normalizeForecast(fixture, "delhi", now);
    expect(forecast.date).toBe("2026-01-03");
    expect(forecast.hours).toMatchObject([
      { hour: 0, aqi: 0, pm25: null, no2: null },
      { hour: 1, aqi: 510, pm25: 39, no2: null },
    ]);
  });

  it("rejects an unknown city before fetching", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const get = createForecastHandler(
      createForecastService(fetcher, () => now),
    );
    expect((await get(forecastRequest("toString"))).status).toBe(400);
    expect((await get(forecastRequest("invalid"))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent requests and bounds freshness by time and city", async () => {
    let time = now;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(fixture));
    const get = createForecastHandler(
      createForecastService(fetcher, () => time),
    );
    const results = await Promise.all([
      get(forecastRequest("delhi")),
      get(forecastRequest("delhi")),
    ]);
    expect(results.map((response) => response.status)).toEqual([200, 200]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.searchParams.get("start_date")).toBe("2026-01-03");
    expect(url.searchParams.get("end_date")).toBe("2026-01-03");
    await get(forecastRequest("delhi"));
    expect(fetcher).toHaveBeenCalledTimes(1);
    await get(forecastRequest("noida"));
    expect(fetcher).toHaveBeenCalledTimes(2);
    time = new Date(now.getTime() + 15 * 60_000);
    await get(forecastRequest("delhi"));
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("handles timeouts and missing AQI independently", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"))
      .mockResolvedValueOnce(
        Response.json({
          ...fixture,
          hourly: { ...fixture.hourly, us_aqi: [null] },
        }),
      );
    const get = createForecastHandler(
      createForecastService(fetcher, () => now),
    );
    expect((await get(forecastRequest("delhi"))).status).toBe(503);
    expect((await get(forecastRequest("delhi"))).status).toBe(502);
  });

  it("rejects duplicate hours and suppresses upstream response text", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          ...fixture,
          hourly: {
            ...fixture.hourly,
            time: fixture.hourly.time.map(() => "2026-01-03T01:00"),
          },
        }),
      )
      .mockResolvedValueOnce(new Response("Provider details", { status: 429 }));
    const get = createForecastHandler(
      createForecastService(fetcher, () => now),
    );
    expect((await get(forecastRequest("delhi"))).status).toBe(502);
    const response = await get(forecastRequest("delhi"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("Provider details");
  });

  it("rejects a forecast completed after its date stops being tomorrow in IST", async () => {
    let time = new Date("2026-01-02T18:29:59Z");
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      time = new Date("2026-01-02T18:30:01Z");
      return Response.json(fixture);
    });
    const get = createForecastHandler(
      createForecastService(fetcher, () => time),
    );
    expect((await get(forecastRequest("delhi"))).status).toBe(503);
    expect((await get(forecastRequest("delhi"))).status).toBe(502);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const nextUrl = new URL(String(fetcher.mock.calls[1]?.[0]));
    expect(nextUrl.searchParams.get("start_date")).toBe("2026-01-04");
  });
});

describe("routine API with a mocked Gemini provider", () => {
  it("sends a server-side key, bounded schema and no tools, then validates and caches the extraction", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => providerOutput({ tasks }));
    const handle = createRoutineHandler(
      createRoutineExtractor(fetcher),
      () => config,
    );
    const input = { routine: "Walk outdoors at 7 AM." };
    const response = await handle(post(input, { origin: "http://localhost" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tasks });
    await handle(post(input));
    expect(fetcher).toHaveBeenCalledTimes(1);

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
    );
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe(config.key);
    expect(init?.redirect).toBe("error");
    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({
      input: input.routine,
      model: defaultModel,
      store: false,
      response_format: { mime_type: "application/json" },
    });
    expect(payload).not.toHaveProperty("tools");
  });

  it("shares the same provider request for simultaneous identical routines", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => providerOutput({ tasks }));
    const extract = createRoutineExtractor(fetcher);
    const input = "Walk outdoors at 7 AM.";
    await expect(
      Promise.all([extract(input, config), extract(input, config)]),
    ).resolves.toEqual([tasks, tasks]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("preserves pickup travel and treats an exercise walk as an outdoor activity", async () => {
    const [exercise] = tasks;
    const pickup = {
      kind: "school_pickup",
      time: "15:00",
      duration: 25,
      fixed: true,
      travel: "car",
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        providerOutput({ tasks: [{ ...exercise, travel: "walk" }, pickup] }),
      );
    const extract = createRoutineExtractor(fetcher);
    await expect(
      extract("Walk for exercise, then drive to school pickup.", config),
    ).resolves.toEqual([exercise, pickup]);
  });

  it("retries a temporary provider 503 once within the same deadline and quota", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockImplementation(async () => providerOutput({ tasks }));
    const extract = createRoutineExtractor(fetcher);
    await expect(extract("Walk outdoors.", config)).resolves.toEqual(tasks);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const firstSignal = fetcher.mock.calls[0]?.[1]?.signal;
    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal).toBe(fetcher.mock.calls[1]?.[1]?.signal);

    for (let i = 0; i < 3; i++) await extract(`Walk outside ${i}.`, config);
    await expect(extract("New walk routine.", config)).rejects.toMatchObject({
      status: 429,
    });
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("blocks invalid inputs, overly large bodies, and cross-site requests before calling Gemini", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handle = createRoutineHandler(
      createRoutineExtractor(fetcher),
      () => config,
    );
    expect((await handle(post({ routine: "x" }))).status).toBe(400);
    expect((await handle(post({ routine: "x".repeat(900) }))).status).toBe(400);
    expect((await handle(post({ routine: "x".repeat(4500) }))).status).toBe(
      413,
    );
    expect(
      (
        await handle(
          post(
            { routine: "walk outdoors" },
            { origin: "https://unrelated.example" },
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (await handle(post({ routine: "walk outdoors" }, { origin: "null" })))
        .status,
    ).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires matching schemes and accepts a normalized JSON media type", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => providerOutput({ tasks }));
    const handle = createRoutineHandler(
      createRoutineExtractor(fetcher),
      () => config,
    );
    const routine = { routine: "Walk at 7 AM." };
    const mixedScheme = await handle(
      post(routine, { origin: "https://localhost" }),
    );
    expect(mixedScheme.status).toBe(403);
    const crossSite = await handle(
      post(routine, { "sec-fetch-site": "cross-site" }),
    );
    expect(crossSite.status).toBe(403);
    const contentType = await handle(
      post(routine, { "Content-Type": "text/plain" }),
    );
    expect(contentType.status).toBe(415);
    expect(fetcher).not.toHaveBeenCalled();
    const valid = await handle(
      post(routine, {
        origin: "http://localhost",
        "Content-Type": "Application/JSON; charset=utf-8",
      }),
    );
    expect(valid.status).toBe(200);
    expect(valid.headers.get("Cache-Control")).toBe("no-store");
    expect(valid.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("handles unreadable and empty provider messages without exposing them", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("Unreadable provider response"))
      .mockResolvedValueOnce(providerOutput({ tasks: [] }));
    const handle = createRoutineHandler(
      createRoutineExtractor(fetcher),
      () => config,
    );
    const routine = { routine: "Walk at 7 AM." };
    const unreadable = await handle(post(routine));
    expect(unreadable.status).toBe(502);
    expect(await unreadable.text()).not.toContain(
      "Unreadable provider response",
    );
    expect((await handle(post(routine))).status).toBe(422);
  });

  it("rejects hallucinated fields and activities without returning provider text", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      providerOutput({
        tasks: [
          {
            ...tasks[0],
            kind: "unexpected",
            instructions: "untrusted content",
          },
        ],
      }),
    );
    const handle = createRoutineHandler(
      createRoutineExtractor(fetcher),
      () => config,
    );
    const response = await handle(post({ routine: "Walk outdoors at seven." }));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("untrusted content");
  });

  it("returns useful fallbacks for missing configuration, timeouts and provider quotas", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"))
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    const extract = createRoutineExtractor(fetcher);
    const input = { routine: "Take a walk." };
    expect(
      (
        await createRoutineHandler(extract, () => ({
          ...config,
          key: undefined,
        }))(post(input))
      ).status,
    ).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
    const configured = createRoutineHandler(extract, () => config);
    expect((await configured(post(input))).status).toBe(503);
    expect((await configured(post(input))).status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects model attempts to assign private household options", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () =>
      providerOutput({
        tasks: [
          { ...tasks[0], sensitivity: "sensitive", indoorAvailable: true },
        ],
      }),
    );
    const handle = createRoutineHandler(
      createRoutineExtractor(fetcher),
      () => config,
    );
    const response = await handle(post({ routine: "Subah walk karni hai." }));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("indoorAvailable");
  });

  it("limits uncached requests per process and lets the window expire", async () => {
    let time = 0;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => providerOutput({ tasks }));
    const handle = createRoutineHandler(
      createRoutineExtractor(fetcher, () => time),
      () => config,
    );
    for (let i = 0; i < 5; i++) {
      expect((await handle(post({ routine: `Take walk ${i}.` }))).status).toBe(
        200,
      );
    }
    expect((await handle(post({ routine: "Take a new walk." }))).status).toBe(
      429,
    );
    expect(fetcher).toHaveBeenCalledTimes(5);
    time = 60_001;
    expect((await handle(post({ routine: "Take a new walk." }))).status).toBe(
      200,
    );
  });
});
