import { expect, test } from "@playwright/test";

test("web shell mounts without an uncaught page error", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  await expect(page.locator("#root")).not.toBeEmpty();
  // Outside the Tauri shell the session falls back to the lock/open screen,
  // which still renders a stable <main>; the packaged window itself is covered
  // by scripts/verify-s06.mjs.
  await expect(page.locator("main")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
