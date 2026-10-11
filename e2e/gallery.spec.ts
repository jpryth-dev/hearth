import sharp from "sharp";
import { expect, test } from "@playwright/test";

import { E2E_MEMBERS } from "../tests/e2e-users";
import { createAlbum, signIn } from "./helpers";

function colourPhoto(name: string, background: string) {
  return sharp({ create: { width: 300, height: 200, channels: 3, background } })
    .jpeg()
    .toBuffer()
    .then((buffer) => ({ name, mimeType: "image/jpeg", buffer }));
}

test("albums show a cover and count, open to a gallery, and photos page through like a feed", async ({ page }) => {
  await signIn(page, E2E_MEMBERS.carol.email);
  const albumPath = await createAlbum(page, "Picnic");

  // A prominent upload button, and an inviting empty state.
  const addPhotos = page.getByLabel("Add photos", { exact: true });
  await expect(page.getByText("No photos yet. Add some, or drop them here.")).toBeVisible();
  await addPhotos.setInputFiles([await colourPhoto("one.jpg", "#c00")]);
  await expect(page.getByText("Added 1 photo.")).toBeVisible();
  await addPhotos.setInputFiles([await colourPhoto("two.jpg", "#0c0")]);
  await expect(page.getByText("Added 1 photo.")).toBeVisible();
  await addPhotos.setInputFiles([await colourPhoto("three.jpg", "#00c")]);
  await expect(page.locator("ul[aria-label=Photos] li")).toHaveCount(3);
  await expect(page.getByText("Your album · 3 photos")).toBeVisible();

  // The album card shows a loaded cover and the count, and opens the gallery.
  await page.goto("/");
  const card = page.getByRole("link", { name: /Picnic/ });
  await expect(card).toContainText("Yours · 3 photos");
  await expect.poll(() => card.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await card.click();
  await expect(page).toHaveURL(new RegExp(`${albumPath}$`));

  // Newest first; arrows and keys move through the album.
  await page.locator("ul[aria-label=Photos] a").first().click();
  await expect(page.getByRole("heading", { name: "three.jpg" })).toBeVisible();
  await expect(page.getByText("1 of 3")).toBeVisible();
  await expect(page.getByRole("link", { name: "Previous photo" })).toHaveCount(0);

  await page.getByRole("link", { name: "Next photo" }).click();
  await expect(page.getByRole("heading", { name: "two.jpg" })).toBeVisible();
  await expect(page.getByText("2 of 3")).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("heading", { name: "one.jpg" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Next photo" })).toHaveCount(0);

  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("heading", { name: "two.jpg" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`${albumPath}$`));
});
