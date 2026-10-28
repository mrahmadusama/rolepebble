import { expect, test } from "@playwright/test";

import { resetData, sql } from "./support";

// Your data (E10): export, delete everything, then import the export again.
test.beforeAll(resetData);

test("exports, deletes everything and imports it all back", async ({ page }) => {
  const [before] = await sql<{ count: number }>(`SELECT count(*)::int AS count FROM "Application"`);

  await page.goto("/settings?section=data");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export" }).click()]);
  const file = (await download.path())!;

  await page.getByRole("button", { name: "Delete everything…" }).click();
  await page.getByRole("textbox", { name: "Type DELETE to confirm" }).fill("DELETE");
  await page.getByRole("button", { name: "Delete for good" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/applications");
  await expect(page.getByRole("heading", { name: "Your first application" })).toBeVisible();

  await page.goto("/settings?section=data");
  await page.locator("input[type=file]").setInputFiles(file);
  await page.getByRole("alertdialog").getByRole("button", { name: "Import and replace" }).click();
  await expect(page.getByText(/^Imported\. Your previous data is backed up as/)).toBeVisible({ timeout: 30_000 });

  const [after] = await sql<{ count: number }>(`SELECT count(*)::int AS count FROM "Application"`);
  expect(after.count).toBe(before.count);
  await page.goto("/applications");
  await expect(page.getByText("Kestrel Maps")).toBeVisible();
});
