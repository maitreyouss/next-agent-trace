import { expect, test } from "@playwright/test";

test("quotes the opened refusal card", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Carte ouverte" }).click();

  const trace = page.getByRole("region", { name: "Trace de la requête" });
  await expect(trace).toContainText("ledger.open · refusal");
  await expect(trace).toContainText("stamp · rule quoted");
  await expect(trace).toContainText("200");
  const sentence = page.locator("[aria-live=polite]");
  await expect(sentence).toContainText("Si la carte n’est pas dans le registre");
  await expect(sentence).toContainText("240");
});

test("stops when the card is missing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pas de carte" }).click();

  await expect(page.getByText("Cette carte n’est pas dans le registre. L’agent s’arrête.")).toBeVisible();
  const trace = page.getByRole("region", { name: "Trace de la requête" });
  await expect(trace).toContainText("refused");
  await expect(trace).not.toContainText("stamp · rule quoted");
});

test("does not rebuild the card when the tool fails", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Outil en échec" }).click();

  await expect(
    page.getByText("L’outil a échoué. La carte n’est pas reconstruite de mémoire."),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Trace de la requête" })).toContainText("fallback");
});
