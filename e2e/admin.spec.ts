import { expect, test, type Browser, type Page } from "@playwright/test";

import { E2E_ADMIN, E2E_MEMBERS } from "../tests/e2e-users";
import { mailTo } from "../tests/mailpit";
import { signIn } from "./helpers";

async function as(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, email);
  return page;
}

test("disabling someone signs them out at once; enabling lets them back", async ({ browser }) => {
  const carol = await as(browser, E2E_MEMBERS.carol.email);
  const admin = await as(browser, E2E_ADMIN.email);

  await admin.getByRole("link", { name: "People" }).click();
  await admin.getByRole("button", { name: `Disable ${E2E_MEMBERS.carol.name}` }).click();
  await expect(admin.getByRole("button", { name: `Enable ${E2E_MEMBERS.carol.name}` })).toBeVisible();

  // Carol's very next request bounces to sign-in.
  await carol.reload();
  await expect(carol).toHaveURL(/\/login$/);

  // She gets the usual answer but no email.
  const before = (await mailTo(E2E_MEMBERS.carol.email)).length;
  await carol.getByLabel("Email address").fill(E2E_MEMBERS.carol.email);
  await carol.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(carol.getByRole("status")).toContainText("If that address has a Hearth account");
  await carol.waitForTimeout(1000);
  expect((await mailTo(E2E_MEMBERS.carol.email)).length).toBe(before);

  // Re-enabled, she can sign in again.
  await admin.getByRole("button", { name: `Enable ${E2E_MEMBERS.carol.name}` }).click();
  await expect(admin.getByRole("button", { name: `Disable ${E2E_MEMBERS.carol.name}` })).toBeVisible();
  await signIn(carol, E2E_MEMBERS.carol.email);
  await expect(carol.getByRole("heading", { name: `Welcome, ${E2E_MEMBERS.carol.name}` })).toBeVisible();

  // The report shows both changes, concerning Carol, and filters by action.
  await admin.getByRole("link", { name: "Activity" }).click();
  const events = admin.getByRole("table", { name: "Events" });
  await expect(events.getByRole("row").filter({ hasText: "USER_DISABLED" }).first()).toContainText(E2E_MEMBERS.carol.email);
  await expect(events.getByRole("row").filter({ hasText: "USER_ENABLED" }).first()).toContainText(E2E_MEMBERS.carol.email);

  await admin.getByLabel("Action").selectOption("USER_ENABLED");
  await admin.getByRole("button", { name: "Filter" }).click();
  await expect(admin).toHaveURL(/action=USER_ENABLED/);
  const rows = events.locator("tbody tr");
  await expect(rows.first()).toContainText("USER_ENABLED");
  for (const text of await rows.allInnerTexts()) expect(text).toContain("USER_ENABLED");

  const csv = await admin.request.get("/admin/activity/export?action=USER_DISABLED");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(csv.headers()["cache-control"]).toContain("no-store");
  expect(await csv.text()).toContain("USER_DISABLED");
});

test("members can't reach any admin page or the CSV export", async ({ browser }) => {
  const bob = await as(browser, E2E_MEMBERS.bob.email);
  for (const path of ["/admin/users", "/admin/activity", "/admin/invitations"]) {
    expect((await bob.goto(path))?.status(), path).toBe(404);
  }
  expect((await bob.request.get("/admin/activity/export")).status()).toBe(404);
  await expect(bob.getByRole("link", { name: "Activity" })).toHaveCount(0);
});
