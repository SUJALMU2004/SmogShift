import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { sampleForecast } from "../../src/domain/sample";

async function expectAccessibleMobileLayout(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "wcag22a",
      "wcag22aa",
    ])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ target }) => target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
}

test("takes a Gemini routine through the regional forecast and updates the carpool impact", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests: string[] = [];
  const routine =
    "Subah 7 baje 30 min walk. 10 se 11 AM tak shift kar sakte hain. 3 PM school pickup by car, 25 min, fixed.";
  await page.clock.setFixedTime(new Date("2026-01-02T10:00:00Z"));
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
    expect(route.request().postDataJSON()).toEqual({ routine });
    await route.fulfill({
      json: {
        tasks: [
          {
            kind: "outdoor_exercise",
            time: "07:00",
            duration: 30,
            fixed: false,
            travel: "unspecified",
            earliestStart: "10:00",
            latestEnd: "11:00",
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
  await page.getByLabel("Describe your day").fill(routine);
  await page.getByRole("button", { name: "Extract with Gemini" }).click();
  await expect(
    page
      .getByText("Activities extracted. Review and compare your plans.")
      .first(),
  ).toBeAttached();
  await page.getByRole("button", { name: "Compare plans" }).click();
  const comparison = page.getByRole("region", { name: "Plan comparison" });
  const first = page.getByRole("group", { name: "Activity 1" });
  await expect(comparison.getByText("Reschedule · 10:00")).toBeVisible();
  await expect(
    comparison.getByText(/forecast peak goes from US AQI 210 to 120/),
  ).toBeVisible();
  await first.getByText("Activity options", { exact: true }).click();
  await first
    .getByRole("checkbox", { name: "This activity is required" })
    .check();
  await first
    .getByRole("combobox", { name: "Air sensitivity for this activity" })
    .selectOption("sensitive");
  await expect(comparison.getByText("Needs review · 07:00")).toBeVisible();
  await first
    .getByRole("checkbox", { name: "Indoor exercise is available" })
    .check();
  await expect(
    comparison.getByText("Move exercise indoors", { exact: true }),
  ).toBeVisible();
  await expect(comparison.getByText("30", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Carpool is possible" }).check();
  await expect(
    comparison.getByText("Share the school pickup ride", { exact: true }),
  ).toBeVisible();
  await expect(comparison.getByText("1", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Carpool is possible" }).uncheck();
  await expect(
    comparison.getByText("Share the school pickup ride", { exact: true }),
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

test("localizes a Hindi routine and keeps ambiguous times pending until reviewed", async ({
  page,
}) => {
  await page.route("**/api/routine", (route) =>
    route.fulfill({
      json: {
        tasks: [
          {
            kind: "outdoor_exercise",
            time: null,
            duration: 30,
            fixed: false,
            travel: "unspecified",
          },
        ],
      },
    }),
  );
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Display language" })
    .selectOption("hi");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await page.getByText("Gemini से गतिविधियाँ निकालें", { exact: true }).click();
  await page.getByLabel("अपनी दिनचर्या लिखें").fill("७ बजे ३० मिनट टहलना है।");
  await page.getByRole("button", { name: "Gemini से निकालें" }).click();
  const task = page.getByRole("group", { name: "गतिविधि 1" });
  await expect(task.getByLabel("शुरू होने का समय")).toHaveValue("");
  await page.getByRole("button", { name: "योजनाओं की तुलना करें" }).click();
  await expect(task.getByRole("alert")).toContainText("सही समय");
  await task.getByLabel("शुरू होने का समय").fill("07:00");
  await page.getByRole("button", { name: "योजनाओं की तुलना करें" }).click();
  await expect(
    page
      .getByRole("region", { name: "योजनाओं की तुलना" })
      .getByText("समय बदलें · 11:00"),
  ).toBeVisible();
  await expectAccessibleMobileLayout(page);
});

test("keeps the newest region when the previous request is still pending", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-01-02T10:00:00Z"));
  let finishDelhi!: () => void;
  let observeDelhi!: () => void;
  const waitForDelhi = new Promise<void>((resolve) => {
    observeDelhi = resolve;
  });
  const waitToSend = new Promise<void>((resolve) => {
    finishDelhi = resolve;
  });
  await page.route("**/api/forecast?city=delhi", async (route) => {
    observeDelhi();
    await waitToSend;
    await route
      .fulfill({ status: 503, json: { error: "Old request" } })
      .catch(() => {});
  });
  await page.route("**/api/forecast?city=gurugram", (route) =>
    route.fulfill({
      json: {
        ...sampleForecast("gurugram"),
        date: "2026-01-03",
        source: "open-meteo",
      },
    }),
  );
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Regional forecast" }).click();
    await waitForDelhi;
    await page
      .getByRole("combobox", { name: "Region" })
      .selectOption("gurugram");
    await expect(page.getByText("~45 km grid")).toBeVisible();
    finishDelhi();
    await expect(
      page.getByText("Forecast unavailable.", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Region" })).toHaveValue(
      "gurugram",
    );
  } finally {
    finishDelhi();
  }
});

test("has keyboard navigation and no detected WCAG AA violations at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to planner" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByText("Read hourly values").click();
  await expect(page.getByRole("table")).toBeVisible();
  await page
    .getByRole("group", { name: "Activity 1" })
    .getByText("Activity options", { exact: true })
    .click();
  await expectAccessibleMobileLayout(page);
});
