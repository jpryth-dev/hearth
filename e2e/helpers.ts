import { expect, type Page } from "@playwright/test";

import { firstLink, mailTo, waitForMail } from "../tests/mailpit";

/** Signs in through the real flow: request a link, open it from Mailpit, confirm. */
export async function signIn(page: Page, email: string): Promise<void> {
  const before = (await mailTo(email)).length;
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("sign-in link is on its way");

  // Newest first.
  const [mail] = await waitForMail(email, before + 1);
  await page.goto(firstLink(mail?.text ?? ""));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/**
 * Collects Content-Security-Policy violations the browser reports, so a test
 * can assert a journey ran without any blocked scripts, styles or images.
 */
export function trackCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  return violations;
}

/** Creates an album from the home page and waits for its gallery. */
export async function createAlbum(page: Page, title: string): Promise<string> {
  await page.goto("/");
  await page.getByText("New album").click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create album" }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  return new URL(page.url()).pathname;
}

/** From an album's gallery, shares it via the Manage page and returns to the gallery. */
export async function shareAlbum(page: Page, albumPath: string, email: string): Promise<void> {
  await page.goto(`${albumPath}/manage`);
  await page.getByLabel("Member's email").fill(email);
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("status")).toHaveText("Shared.");
  await page.goto(albumPath);
}
