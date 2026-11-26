import { expect, it, vi } from "vitest";
import { createRequestCache } from "../../src/server/request-cache";

it("evicts the oldest entry and expires the remaining results", async () => {
  let now = 0;
  const get = createRequestCache<string, number>({
    maxEntries: 2,
    ttlMs: 100,
    clock: () => now,
  });
  const reload = vi.fn(async () => 42);
  await get("oldest", async () => 1);
  await get("second", async () => 2);
  await get("third", async () => 3);
  expect(await get("third", reload)).toBe(3);
  expect(reload).not.toHaveBeenCalled();
  expect(await get("oldest", reload)).toBe(42);
  now = 100;
  expect(await get("third", reload)).toBe(42);
  expect(reload).toHaveBeenCalledTimes(2);
});

it("allows a new request after a shared provider failure", async () => {
  const get = createRequestCache<string, string>({
    maxEntries: 2,
    ttlMs: 100,
    clock: () => 0,
  });
  const load = vi
    .fn<() => Promise<string>>()
    .mockRejectedValueOnce(new Error("Temporary failure"))
    .mockResolvedValueOnce("Recovered");
  const results = await Promise.allSettled([
    get("region", load),
    get("region", load),
  ]);
  expect(results.map((result) => result.status)).toEqual([
    "rejected",
    "rejected",
  ]);
  expect(load).toHaveBeenCalledTimes(1);
  expect(await get("region", load)).toBe("Recovered");
});
