import { expect, test } from "@playwright/test";

test("signed-out visitors land on the sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in to Hearth" })).toBeVisible();
});
