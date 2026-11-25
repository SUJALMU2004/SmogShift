import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { sampleForecast } from "../../src/domain/sample";

test("previews, copies, and opens the WhatsApp handoff without API calls or a trip status change", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          document.body.dataset.copiedMessage = text;
        },
      },
    });
  });
  await context.route("https://wa.me/**", (route) =>
    route.fulfill({ body: "WhatsApp redirect test" }),
  );
  const requests: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/api/")) requests.push(pathname);
  });

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  const jump = page.getByRole("link", { name: "Jump to plan" });
  await jump.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Plan comparison" }),
  ).toBeFocused();

  const summary = page.getByText("Share pickup proposal", { exact: true });
  const open = page.getByRole("link", { name: "Open WhatsApp" });
  await expect(open).toBeHidden();
  await summary.focus();
  await page.keyboard.press("Enter");
  const message = page.getByRole("textbox", { name: "Message preview" });
  await expect(message).toBeVisible();
  await expect(message).toHaveAttribute("readonly", "");
  const preview = await message.inputValue();
  expect(preview).toContain("SmogShift demo · fictional pickup");
  expect(preview).toContain("15:00 IST");
  expect(await open.getAttribute("rel")).toBe("noopener noreferrer");

  await page.getByRole("button", { name: "Copy message" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Message copied." }),
  ).toBeVisible();
  expect(await page.locator("body").getAttribute("data-copied-message")).toBe(
    preview,
  );
  const popupPromise = page.waitForEvent("popup");
  await open.click();
  const popup = await popupPromise;
  await expect(popup.getByText("WhatsApp redirect test")).toBeVisible();
  expect(new URL(popup.url()).searchParams.get("text")).toBe(preview);
  await popup.close();
  await expect(
    page
      .getByText("Round trips avoided if shared", { exact: true })
      .locator("..")
      .getByText("1", { exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([]);

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map(({ id }) => id)).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test("selects the preview when copy is denied and discards an obsolete invitation after editing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    });
  });

  await page.goto("/");
  const summary = page.getByText("Share pickup proposal", { exact: true });
  await summary.click();
  const preview = page.getByRole("textbox", { name: "Message preview" });
  await page.getByRole("button", { name: "Copy message" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Automatic copy is unavailable." }),
  ).toBeVisible();
  await expect(preview).toBeFocused();
  expect(
    await preview.evaluate((element: HTMLTextAreaElement) => [
      element.selectionStart,
      element.selectionEnd,
    ]),
  ).toEqual([0, (await preview.inputValue()).length]);

  const pickup = page.getByRole("group", { name: "Activity 2" });
  await pickup.getByLabel("Start", { exact: true }).fill("15:30");
  await expect(summary).toHaveCount(0);
  await page.getByRole("button", { name: "Compare plans" }).click();
  await expect(preview).toBeHidden();
  await summary.click();
  await expect(preview).toHaveValue(/15:30 IST/);
  await page.getByRole("checkbox", { name: "Carpool is possible" }).uncheck();
  await expect(summary).toHaveCount(0);
  await expect(
    page
      .getByText("Round trips avoided if shared", { exact: true })
      .locator("..")
      .getByText("0", { exact: true }),
  ).toBeVisible();
});

test("reopens the current dated message in Hindi after switching language", async ({
  page,
}) => {
  await page.route("**/api/forecast?city=delhi", (route) =>
    route.fulfill({
      json: {
        ...sampleForecast("delhi"),
        source: "open-meteo",
        date: "2026-11-26",
        fetchedAt: "2026-11-25T08:30:00Z",
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Regional forecast" }).click();
  await expect(page.getByText("~45 km grid")).toBeVisible();
  await page.getByRole("checkbox", { name: "Carpool is possible" }).check();
  await page.getByText("Share pickup proposal", { exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Message preview" }),
  ).toHaveValue(/26 November 2026/);
  await page
    .getByRole("combobox", { name: "Display language" })
    .selectOption("hi");
  const preview = page.getByRole("textbox", { name: "संदेश का पूर्वावलोकन" });
  await expect(preview).toBeHidden();
  await page.getByText("साझा यात्रा का प्रस्ताव भेजें", { exact: true }).click();
  await expect(preview).toHaveValue(/26 नवंबर 2026.*15:00 IST/);
  const href = await page
    .getByRole("link", { name: "WhatsApp खोलें" })
    .getAttribute("href");
  expect(new URL(href!).searchParams.get("text")).toBe(
    await preview.inputValue(),
  );
});
