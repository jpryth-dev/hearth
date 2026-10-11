import { expect, test, type Page } from "@playwright/test";

import { E2E_ADMIN } from "../tests/e2e-users";
import { clearMailbox, firstLink, waitForMail } from "../tests/mailpit";

test.beforeEach(clearMailbox);

async function signInByEmail(page: Page, email: string, expectedMailCount = 1) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("sign-in link is on its way");

  const [mail] = await waitForMail(email, expectedMailCount);
  await page.goto(firstLink(mail?.text ?? ""));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test("admin invites a member, who joins, signs out and signs back in", async ({ page, context }) => {
  // Admin signs in with an emailed link.
  await signInByEmail(page, E2E_ADMIN.email);
  await expect(page.getByRole("heading", { name: `Welcome, ${E2E_ADMIN.name}` })).toBeVisible();

  const [cookie] = (await context.cookies()).filter((c) => c.name === "hearth_session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");

  // Admin invites someone.
  await page.getByRole("link", { name: "Invitations" }).click();
  await page.getByLabel("Email address").fill("newbie@e2e.test");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByRole("status")).toHaveText("Invitation sent to newbie@e2e.test.");
  await expect(page.getByRole("listitem").filter({ hasText: "newbie@e2e.test" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The invitee accepts from the email.
  const [invite] = await waitForMail("newbie@e2e.test");
  const inviteLink = firstLink(invite?.text ?? "");
  await page.goto(inviteLink);
  await expect(page.getByText("newbie@e2e.test")).toBeVisible();
  await page.getByLabel("Your name, as family will see it").fill("Newbie");
  await page.getByRole("button", { name: "Join Hearth" }).click();
  await expect(page.getByRole("heading", { name: "Welcome, Newbie" })).toBeVisible();

  // A member has no admin link, and the admin page doesn't exist for them.
  await expect(page.getByRole("link", { name: "Invitations" })).toHaveCount(0);
  const adminPage = await page.goto("/admin/invitations");
  expect(adminPage?.status()).toBe(404);

  // The invitation link is spent.
  await page.goto(inviteLink);
  await expect(page.getByRole("heading", { name: "Invitation not valid" })).toBeVisible();

  // Sign out, then back in by link.
  await page.goto("/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await signInByEmail(page, "newbie@e2e.test", 2);
  await expect(page.getByRole("heading", { name: "Welcome, Newbie" })).toBeVisible();
});

test("an unknown address gets the same answer and no email", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("stranger@e2e.test");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("If that address has a Hearth account");

  await expect(waitForMail("stranger@e2e.test", 1, 1500)).rejects.toThrow();
});

test("a sign-in link works only once", async ({ page, browser }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(E2E_ADMIN.email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  const [mail] = await waitForMail(E2E_ADMIN.email);
  const link = firstLink(mail?.text ?? "");

  await page.goto(link);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);

  const other = await browser.newPage();
  await other.goto(link);
  await expect(other.getByRole("heading", { name: "Link not valid" })).toBeVisible();
  await other.close();
});
