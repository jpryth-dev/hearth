import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { FAMILY_PHOTO_EXIF, jpegWithExif, solid } from "../../../tests/images";
import { FULL_MAX_EDGE, THUMB_MAX_EDGE } from "./limits";
import { processImage } from "./process";

async function expectNoMetadata(data: Buffer) {
  const meta = await sharp(data).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.exif).toBeUndefined();
  expect(meta.xmp).toBeUndefined();
  expect(meta.icc).toBeUndefined();
  expect(meta.orientation).toBeUndefined();
}

describe("processImage", () => {
  it("strips EXIF and GPS from both stored files but keeps it as metadata", async () => {
    const input = await jpegWithExif(FAMILY_PHOTO_EXIF);
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const result = await processImage(input);
    if (!result.ok) throw new Error(result.reason);

    await expectNoMetadata(result.image.full.data);
    await expectNoMetadata(result.image.thumb.data);
    expect(result.image.full.data.includes(Buffer.from("TestCam"))).toBe(false);

    expect(result.image.metadata).toMatchObject({
      takenAt: new Date("2024-07-04T15:30:00Z"),
      cameraMake: "TestCam",
      cameraModel: "T-1000",
      gpsLatitude: 51.5,
      gpsLongitude: -0.125,
    });
    expect(JSON.stringify(result.image.metadata.rawExif)).toContain("T-1000");
  });

  it("handles a photo with no EXIF at all", async () => {
    const result = await processImage(await solid("png"));
    if (!result.ok) throw new Error(result.reason);
    expect(result.image.metadata).toEqual({
      takenAt: null,
      cameraMake: null,
      cameraModel: null,
      gpsLatitude: null,
      gpsLongitude: null,
      rawExif: null,
    });
  });

  it.each(["png", "webp", "avif"] as const)("accepts %s", async (format) => {
    const result = await processImage(await solid(format));
    expect(result.ok).toBe(true);
  });

  it.each([
    ["svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>')],
    ["text", Buffer.from("definitely not an image")],
    ["a JPEG header then junk", Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)])],
  ])("rejects %s", async (_name, bytes) => {
    const result = await processImage(bytes);
    expect(result.ok).toBe(false);
  });

  it.each(["gif", "tiff"] as const)("rejects %s, which is outside the allowlist", async (format) => {
    expect(await processImage(await solid(format))).toEqual({ ok: false, reason: "unsupported_type" });
  });

  it("ignores what the file claims to be: a PNG named .jpg is judged as PNG", async () => {
    // processImage never sees a name or MIME type; this documents that the
    // bytes alone decide.
    const result = await processImage(await solid("png"));
    expect(result.ok && result.image.mimeType).toBe("image/webp");
  });

  it("rejects images over the pixel limit before decoding them", async () => {
    const huge = await sharp({ create: { width: 8000, height: 7000, channels: 3, background: "#000" } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(await processImage(huge)).toEqual({ ok: false, reason: "too_many_pixels" });
  });

  it("downsizes large images and makes a small thumbnail", async () => {
    const big = await sharp({ create: { width: 5000, height: 2500, channels: 3, background: "#123" } }).jpeg().toBuffer();
    const result = await processImage(big);
    if (!result.ok) throw new Error(result.reason);

    expect(result.image.full).toMatchObject({ width: FULL_MAX_EDGE, height: FULL_MAX_EDGE / 2 });
    const thumb = await sharp(result.image.thumb.data).metadata();
    expect(Math.max(thumb.width ?? 0, thumb.height ?? 0)).toBe(THUMB_MAX_EDGE);
  });

  it("applies the EXIF orientation, so sideways phone photos come out upright", async () => {
    const sideways = await sharp({ create: { width: 60, height: 40, channels: 3, background: "#fff" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await processImage(sideways);
    if (!result.ok) throw new Error(result.reason);
    expect(result.image.full).toMatchObject({ width: 40, height: 60 });
  });
});
