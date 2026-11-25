import { describe, expect, it } from "vitest";
import { buildPlan, type Decision } from "../../src/domain/planner";
import { reviewTasks, exampleTasks } from "../../src/domain/routine";
import { sampleForecast } from "../../src/domain/sample";
import { buildPickupProposal } from "../../src/domain/share";

const reviewed = reviewTasks(exampleTasks);
if (!reviewed.ok) throw new Error("Invalid example routine");
const sample = sampleForecast("delhi");
const plan = buildPlan(reviewed.tasks, sample, {
  sensitive: false,
  carpool: true,
});
const pickup = plan.decisions.find(({ kind }) => kind === "carpool");
if (!pickup) throw new Error("No sample carpool");

const live = { source: "open-meteo" as const, date: "2026-11-26" };

describe("pickup proposal", () => {
  it("uses the live plan’s IST date and time and keeps the saving conditional", () => {
    const proposal = buildPickupProposal(pickup, live, "en");
    expect(proposal?.message).toContain("26 November 2026 at 15:00 IST");
    expect(proposal?.message).toContain(
      "If this would replace a separate drive",
    );
    expect(proposal?.message).not.toContain("demo");
    const url = new URL(proposal!.whatsappUrl);
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/");
    expect([...url.searchParams]).toEqual([["text", proposal?.message]]);
  });

  it("preserves the Hindi demo label and line breaks through URL encoding", () => {
    const proposal = buildPickupProposal(
      pickup,
      { ...sample, date: live.date },
      "hi",
    );
    expect(proposal?.message).toMatch(/^SmogShift डेमो · काल्पनिक स्कूल पिकअप\n\n/);
    expect(proposal?.message).toContain("15:00 IST");
    expect(proposal?.message).not.toContain("2026");
    expect(new URL(proposal!.whatsappUrl).searchParams.get("text")).toBe(
      proposal?.message,
    );
  });

  it.each([null, { ...live, date: "2026-02-30" }])(
    "asks for the date when there is no usable dated forecast (%j)",
    (forecast) => {
      const proposal = buildPickupProposal(pickup, forecast, "en");
      expect(proposal?.message).toContain("confirm the date and details");
      expect(proposal?.message).not.toMatch(/2026|fictional/);
    },
  );

  it.each<Partial<Decision>>([
    { kind: "kept" },
    { time: null },
    { time: "32:00" },
    { time: "16:00" },
    { original: { ...pickup.original, travel: "transit" } },
    { original: { ...pickup.original, kind: "outdoor_errand" } },
  ])("declines a decision that is not an eligible pickup (%j)", (changes) => {
    expect(
      buildPickupProposal({ ...pickup, ...changes }, live, "en"),
    ).toBeNull();
  });

  it("does not export private routine fields, identifiers, or the forecast location", () => {
    const original = {
      ...pickup.original,
      id: "PRIVATE-ID",
      sensitivity: "sensitive" as const,
      schoolAddress: "PRIVATE-ADDRESS",
    };
    const forecast = { ...live, city: "PRIVATE-LOCATION", hours: sample.hours };
    const proposal = buildPickupProposal(
      { ...pickup, original },
      forecast,
      "en",
    );
    expect(proposal).toEqual(buildPickupProposal(pickup, live, "en"));
  });
});
