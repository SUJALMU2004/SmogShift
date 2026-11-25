import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { sampleForecast } from "../../src/domain/sample";

test("takes a Gemini routine through the regional forecast and updates the carpool impact", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests: string[] = [];
  await page.route("**/api/forecast?city=noida", async (route) => {
    requests.push("forecast");
    await route.fulfill({
      json: {
        ...sampleForecast("noida"),
        date: "2026-01-03",
        fetchedAt: "2026-01-02T10:00:00Z",
        source: "open-meteo",
      },
    });
  });
  await page.route("**/api/routine", async (route) => {
    requests.push("routine");
    expect(route.request().postDataJSON()).toEqual({
      routine:
        "Walk outdoors for 30 minutes at 7 AM. School pickup by car from 3 PM for 25 minutes.",
    });
    await route.fulfill({
      json: {
        tasks: [
          {
            kind: "outdoor_exercise",
            time: "07:00",
            duration: 30,
            fixed: false,
            travel: "unspecified",
          },
          {
            kind: "school_pickup",
            time: "15:00",
            duration: 25,
            fixed: true,
            travel: "car",
          },
        ],
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Region", exact: true })
    .selectOption("noida");
  await page.getByRole("button", { name: "Regional forecast" }).click();
  await expect(
    page.getByRole("heading", { name: "Tomorrow’s forecast" }),
  ).toBeVisible();
  await expect(page.getByText("~45 km grid")).toBeVisible();
  await page
    .getByText("Extract activities with Gemini", { exact: true })
    .click();
  await page
    .getByLabel("Describe your day")
    .fill(
      "Walk outdoors for 30 minutes at 7 AM. School pickup by car from 3 PM for 25 minutes.",
    );
  await page.getByRole("button", { name: "Extract with Gemini" }).click();
  await expect(
    page
      .getByText("Activities extracted. Review and compare your plans.")
      .first(),
  ).toBeAttached();
  await page.getByRole("button", { name: "Compare plans" }).click();
  const comparison = page.getByRole("region", { name: "Plan comparison" });
  await expect(
    comparison.getByText("Move exercise indoors", { exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Carpool is possible" }).check();
  await expect(
    comparison.getByText("Share the school pickup ride"),
  ).toBeVisible();
  await expect(comparison.getByText("1", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Carpool is possible" }).uncheck();
  await expect(
    comparison.getByText("Share the school pickup ride"),
  ).toHaveCount(0);
  await expect(comparison.getByText("Keep · 15:00")).toBeVisible();
  expect(requests).toEqual(["forecast", "routine"]);
  expect(errors).toEqual([]);
});

test("keeps the manual editor usable when the real AI route has no key and offers sample on forecast failure", async ({
  page,
}) => {
  await page.route("**/api/forecast?city=delhi", (route) =>
    route.fulfill({ status: 503, json: { error: "Forecast unavailable." } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Regional forecast" }).click();
  await expect(
    page.getByText("Forecast unavailable.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use sample forecast" }).click();
  await expect(
    page.getByText("Fictional readings for the demo."),
  ).toBeVisible();
  await page
    .getByText("Extract activities with Gemini", { exact: true })
    .click();
  await page.getByRole("button", { name: "Extract with Gemini" }).click();
  await expect(
    page.getByRole("region", { name: "Your routine" }).getByRole("alert"),
  ).toContainText("Add your activities manually.");
  await page.getByRole("button", { name: "Add activity" }).click();
  const activity = page.getByRole("group", { name: "Activity 4" });
  await activity.getByLabel("Start").fill("20:00");
  await activity.getByLabel("Minutes").fill("10");
  await page.getByRole("button", { name: "Compare plans" }).click();
  await expect(
    page
      .getByText("Other commitment", { exact: true })
      .filter({ visible: true })
      .last(),
  ).toBeVisible();
});

test("has keyboard navigation and no detected WCAG AA violations at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to planner" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByText("Read hourly values").click();
  await expect(page.getByRole("table")).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ target }) => target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});
