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
