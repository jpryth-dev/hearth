import { expect, test, type Browser, type Page } from "@playwright/test";

import { E2E_ADMIN, E2E_MEMBERS } from "../tests/e2e-users";
import { createAlbum, signIn } from "./helpers";

async function as(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, email);
  return page;
}

async function expectNotFound(page: Page, url: string) {
  const response = await page.goto(url);
  expect(response?.status()).toBe(404);
}

test("an album is visible to its owner and grantees only, until revoked or deleted", async ({ browser }) => {
  const alice = await as(browser, E2E_MEMBERS.alice.email);

  // Alice creates an album; only she can see it.
  const albumUrl = await createAlbum(alice, "Lake trip");
  await expect(alice.getByText("Your album · 0 photos")).toBeVisible();
  await alice.getByRole("link", { name: "Manage album" }).click();
  await expect(alice.getByText("Only you can see this album.")).toBeVisible();

  const bob = await as(browser, E2E_MEMBERS.bob.email);
  await expectNotFound(bob, albumUrl);

  // Alice shares with Bob as a viewer.
  await alice.getByLabel("Member's email").fill(E2E_MEMBERS.bob.email);
  await alice.getByRole("button", { name: "Share" }).click();
  await expect(alice.getByRole("status")).toHaveText("Shared.");
  await expect(alice.getByText(`${E2E_MEMBERS.bob.email} · Can view`)).toBeVisible();

  // Bob sees it from his album list, read-only.
  await bob.goto("/");
  await bob.getByRole("link", { name: /Lake trip/ }).click();
  await expect(bob.getByRole("heading", { name: "Lake trip", level: 1 })).toBeVisible();
  await expect(bob.getByText("Shared by Alice · You can view")).toBeVisible();
  await expect(bob.getByRole("link", { name: "Manage album" })).toHaveCount(0);
  await expect(bob.getByLabel("Add photos", { exact: true })).toHaveCount(0);
  await expectNotFound(bob, `${albumUrl}/manage`);

  // Carol (no grant) and the admin (role grants nothing) get a 404.
  const carol = await as(browser, E2E_MEMBERS.carol.email);
  await expectNotFound(carol, albumUrl);
  const admin = await as(browser, E2E_ADMIN.email);
  await expectNotFound(admin, albumUrl);
  await expectNotFound(admin, `${albumUrl}/manage`);
  await admin.goto("/");
  await expect(admin.getByRole("link", { name: /Lake trip/ })).toHaveCount(0);

  // Alice removes Bob; his next request is refused.
  await alice.getByRole("button", { name: "Remove Bob" }).click();
  await expect(alice.getByText("Only you can see this album.")).toBeVisible();
  await expectNotFound(bob, albumUrl);

  // Alice deletes the album; it's gone for her too.
  await alice.getByRole("checkbox").check();
  await alice.getByRole("button", { name: "Delete album" }).click();
  await expect(alice).toHaveURL(/\/$/);
  await expect(alice.getByRole("link", { name: /Lake trip/ })).toHaveCount(0);
  await expectNotFound(alice, albumUrl);
});

test("malformed and unknown album ids are a plain 404", async ({ browser }) => {
  const alice = await as(browser, E2E_MEMBERS.alice.email);
  await expectNotFound(alice, "/albums/not-a-uuid");
  await expectNotFound(alice, `/albums/${crypto.randomUUID()}`);
});

test("signed-out visitors can't reach an album", async ({ page }) => {
  await page.goto(`/albums/${crypto.randomUUID()}`);
  await expect(page).toHaveURL(/\/login$/);
});
