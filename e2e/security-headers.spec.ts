import { expect, test } from "@playwright/test";

import { E2E_MEMBERS } from "../tests/e2e-users";
import { jpegWithExif } from "../tests/images";
import { signIn, trackCspViolations } from "./helpers";

test("every page gets a CSP with a fresh nonce that Next applies to its scripts", async ({ request }) => {
  const nonceOf = (csp: string) => csp.match(/'nonce-([^']+)'/)?.[1];

  const first = await request.get("/login");
  const second = await request.get("/login");
  const csp1 = first.headers()["content-security-policy"] ?? "";
  const csp2 = second.headers()["content-security-policy"] ?? "";

  expect(csp1).toContain("script-src 'self' 'nonce-");
  expect(csp1).toContain("frame-ancestors 'none'");
  expect(csp1).toContain("img-src 'self' data: blob: http://localhost:9000");
  expect(nonceOf(csp1)).toBeTruthy();
  expect(nonceOf(csp1)).not.toBe(nonceOf(csp2));

  const html = await first.text();
  const scripts = html.match(/<script\b[^>]*>/g) ?? [];
  expect(scripts.length).toBeGreaterThan(0);
  for (const tag of scripts) expect(tag).toContain(`nonce="${nonceOf(csp1)}"`);
});

test("sign-in, upload and viewing photos run with no CSP violations", async ({ page }) => {
  const violations = trackCspViolations(page);
  await signIn(page, E2E_MEMBERS.alice.email);

  await page.getByLabel("Title").fill("CSP check");
  await page.getByRole("button", { name: "Create album" }).click();
  await page.getByLabel("Add photos", { exact: true }).setInputFiles({
    name: "csp.jpg",
    mimeType: "image/jpeg",
    buffer: await jpegWithExif(),
  });
  await expect(page.getByText("Added 1 photo.")).toBeVisible();

  const thumb = page.locator("ul[aria-label=Photos] img").first();
  await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.locator("ul[aria-label=Photos] a").first().click();
  const full = page.locator("main img");
  await expect.poll(() => full.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // Let in-flight responses finish so the check sees everything the page loaded.
  await page.waitForLoadState("networkidle");
  expect(violations).toEqual([]);
});
