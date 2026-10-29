import { expect, test } from "@playwright/test";

test("quotes the opened refusal card", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Card opened" }).click();

  const trace = page.getByRole("region", { name: "Request trace" });
  await expect(trace).toContainText("ledger.open · refusal");
  await expect(trace).toContainText("stamp · rule quoted");
  await expect(trace).toContainText("200");
  const sentence = page.locator("[aria-live=polite]");
  await expect(sentence).toContainText("Refusal is kept by Trace");
  await expect(sentence).toContainText("240");
});

test("stops when the card is missing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "No card" }).click();

  await expect(page.getByText("That card is not in the ledger. The run stops.")).toBeVisible();
  const trace = page.getByRole("region", { name: "Request trace" });
  await expect(trace).toContainText("refused");
  await expect(trace).not.toContainText("stamp · rule quoted");
});

test("does not rebuild the card when the tool fails", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tool failed" }).click();

  await expect(
    page.getByText("The tool failed. The card is not rebuilt from memory."),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Request trace" })).toContainText("fallback");
});
