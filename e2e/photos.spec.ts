import { expect, test, type Browser, type Page } from "@playwright/test";

import { E2E_ADMIN, E2E_MEMBERS } from "../tests/e2e-users";
import { FAMILY_PHOTO_EXIF, jpegWithExif } from "../tests/images";
import { createAlbum, shareAlbum, signIn } from "./helpers";

async function as(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, email);
  return page;
}

async function expectNotFound(page: Page, url: string) {
  expect((await page.goto(url))?.status()).toBe(404);
}

/** True once the browser has actually decoded the image from its signed URL. */
async function expectImageLoaded(page: Page, selector: string) {
  await expect
    .poll(() => page.locator(selector).first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
}

test("photos are seen by the album's people only, and deletion hides them", async ({ browser }) => {
  const alice = await as(browser, E2E_MEMBERS.alice.email);
  const albumPath = await createAlbum(alice, "Garden");
  await shareAlbum(alice, albumPath, E2E_MEMBERS.bob.email);

  // Alice uploads a generated photo carrying camera and GPS EXIF, plus a fake.
  await alice.getByLabel("Add photos", { exact: true }).setInputFiles([
    { name: "roses.jpg", mimeType: "image/jpeg", buffer: await jpegWithExif(FAMILY_PHOTO_EXIF) },
    { name: "evil.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>") },
  ]);
  await expect(alice.getByText("Added 1 photo.")).toBeVisible();
  await expect(alice.getByText("evil.jpg: That file isn't a JPEG, PNG, WebP or AVIF image.")).toBeVisible();
  await expectImageLoaded(alice, "ul[aria-label=Photos] img");

  await alice.locator("ul[aria-label=Photos] a").first().click();
  await expect(alice.getByRole("heading", { name: "roses.jpg" })).toBeVisible();
  await expect(alice.getByText("1 of 1")).toBeVisible();
  await expect(alice.getByText("TestCam T-1000")).toBeVisible();
  await expectImageLoaded(alice, "main img");
  const photoPath = new URL(alice.url()).pathname;

  // Bob (viewer) sees it but can't delete or upload.
  const bob = await as(browser, E2E_MEMBERS.bob.email);
  await bob.goto(albumPath);
  await expect(bob.getByLabel("Add photos", { exact: true })).toHaveCount(0);
  await bob.goto(photoPath);
  await expectImageLoaded(bob, "main img");
  await expect(bob.getByRole("button", { name: "Delete photo" })).toHaveCount(0);

  // Carol and the admin can't reach the photo page.
  await expectNotFound(await as(browser, E2E_MEMBERS.carol.email), photoPath);
  await expectNotFound(await as(browser, E2E_ADMIN.email), photoPath);

  // Alice deletes it; it's gone for Bob too.
  await alice.getByRole("button", { name: "Delete photo" }).click();
  await expect(alice).toHaveURL(new RegExp(`${albumPath}$`));
  await expect(alice.getByText("No photos yet")).toBeVisible();
  await expectNotFound(bob, photoPath);
});

test("the upload endpoint refuses strangers, other origins and signed-out callers", async ({ browser, playwright }) => {
  const alice = await as(browser, E2E_MEMBERS.alice.email);
  const endpoint = `/api${await createAlbum(alice, "Locked")}/photos`;
  const photo = await jpegWithExif();
  const origin = "http://localhost:3100";

  const carol = await as(browser, E2E_MEMBERS.carol.email);
  const asCarol = await carol.request.post(endpoint, { data: photo, headers: { Origin: origin } });
  expect(asCarol.status()).toBe(404);

  const crossSite = await alice.request.post(endpoint, { data: photo, headers: { Origin: "https://evil.example" } });
  expect(crossSite.status()).toBe(403);

  const anonymous = await (await playwright.request.newContext({ baseURL: origin })).post(endpoint, {
    data: photo,
    headers: { Origin: origin },
  });
  expect(anonymous.status()).toBe(401);

  const ok = await alice.request.post(endpoint, { data: photo, headers: { Origin: origin, "X-Filename": "ok.jpg" } });
  expect(ok.status()).toBe(201);
});
